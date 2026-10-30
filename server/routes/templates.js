/**
 * Invoice Templates Management Routes
 */
const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure upload storage for PDF templates and background images
const uploadDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, 'file_' + Date.now() + '_' + uuidv4().slice(0, 8) + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit
});

// GET /api/templates - list templates for company (or all)
router.get('/', (req, res) => {
  try {
    const { company_id } = req.query;
    let sql = `
      SELECT t.*, comp.name as company_name,
        (SELECT COUNT(*) FROM invoices WHERE template_id = t.id) as usage_count
      FROM invoice_templates t
      LEFT JOIN companies comp ON t.company_id = comp.id
      WHERE 1=1
    `;
    const params = [];

    if (company_id && company_id !== 'all') {
      sql += ' AND t.company_id = ?';
      params.push(company_id);
    }

    sql += ' ORDER BY t.is_default DESC, t.created_at DESC';

    const templates = db.prepare(sql).all(...params);
    res.json({ success: true, data: templates, templates });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/templates/:id - single template with config
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const template = db.prepare(`
      SELECT t.*, comp.name as company_name, comp.currency,
        (SELECT COUNT(*) FROM invoices WHERE template_id = t.id) as usage_count
      FROM invoice_templates t
      LEFT JOIN companies comp ON t.company_id = comp.id
      WHERE t.id = ?
    `).get(id);

    if (!template) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }

    let parsedConfig = {};
    try {
      parsedConfig = JSON.parse(template.config_json || '{}');
    } catch (e) {}

    const payload = {
      ...template,
      config: parsedConfig
    };

    res.json({
      success: true,
      data: payload,
      template: payload
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/templates - create new template
router.post('/', (req, res) => {
  try {
    const { company_id, name, type, is_default, config_json, bg_image_url } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Template name is required' });
    }
    if (!company_id) {
      return res.status(400).json({ success: false, error: 'Company ID is required' });
    }

    const id = 'tmpl_' + uuidv4().slice(0, 12);
    const tmplType = type || 'designer';
    const makeDefault = is_default ? 1 : 0;

    if (makeDefault) {
      // Unset previous default for this specific company only
      db.prepare('UPDATE invoice_templates SET is_default = 0 WHERE company_id = ?').run(company_id);
    }

    const configStr = typeof config_json === 'object' ? JSON.stringify(config_json) : (config_json || '{}');

    db.prepare(`
      INSERT INTO invoice_templates (id, company_id, name, type, is_default, config_json, bg_image_url)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, company_id, name.trim(), tmplType, makeDefault, configStr, bg_image_url || '');

    const created = db.prepare('SELECT * FROM invoice_templates WHERE id = ?').get(id);
    res.status(201).json({ success: true, template: created });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/templates/:id - update template
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM invoice_templates WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }

    const { name, is_default, config_json, bg_image_url } = req.body;
    const updates = [];
    const values = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name.trim());
    }

    if (is_default !== undefined) {
      const val = is_default ? 1 : 0;
      if (val === 1) {
        db.prepare('UPDATE invoice_templates SET is_default = 0 WHERE company_id = ?').run(existing.company_id);
      }
      updates.push('is_default = ?');
      values.push(val);
    }

    if (config_json !== undefined) {
      const configStr = typeof config_json === 'object' ? JSON.stringify(config_json) : config_json;
      updates.push('config_json = ?');
      values.push(configStr);
    }

    if (bg_image_url !== undefined) {
      updates.push('bg_image_url = ?');
      values.push(bg_image_url);
    }

    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')");
      values.push(id);
      db.prepare(`UPDATE invoice_templates SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    const updated = db.prepare('SELECT * FROM invoice_templates WHERE id = ?').get(id);
    res.json({ success: true, template: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/templates/:id/set-default - set default template for company
router.post('/:id/set-default', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM invoice_templates WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }

    // Only update templates belonging to this company!
    db.prepare('UPDATE invoice_templates SET is_default = 0 WHERE company_id = ?').run(existing.company_id);
    db.prepare('UPDATE invoice_templates SET is_default = 1, updated_at = datetime("now") WHERE id = ?').run(id);

    res.json({ success: true, message: `Set "${existing.name}" as default template for company` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/templates/:id/duplicate - duplicate template
router.post('/:id/duplicate', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM invoice_templates WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }

    const newId = 'tmpl_' + uuidv4().slice(0, 12);
    const newName = `${existing.name} (Copy)`;

    db.prepare(`
      INSERT INTO invoice_templates (id, company_id, name, type, is_default, config_json, bg_image_url, pdf_file_path)
      VALUES (?, ?, ?, ?, 0, ?, ?, ?)
    `).run(newId, existing.company_id, newName, existing.type, existing.config_json, existing.bg_image_url, existing.pdf_file_path);

    const duplicated = db.prepare('SELECT * FROM invoice_templates WHERE id = ?').get(newId);
    res.status(201).json({ success: true, template: duplicated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/templates/:id - delete template
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM invoice_templates WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }

    db.prepare('DELETE FROM invoice_templates WHERE id = ?').run(id);
    res.json({ success: true, message: 'Template deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/templates/upload-pdf - upload user's existing invoice PDF for template mapping
router.post('/upload-pdf', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No PDF file uploaded' });
    }

    const { PDFDocument } = require('pdf-lib');
    const pdfBytes = fs.readFileSync(req.file.path);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pageCount = pdfDoc.getPageCount();
    const firstPage = pdfDoc.getPage(0);
    const { width, height } = firstPage.getSize();

    res.json({
      success: true,
      file_path: `/uploads/${path.basename(req.file.path)}`,
      page_count: pageCount,
      dimensions: { width, height }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to process PDF: ' + err.message });
  }
});

module.exports = router;
