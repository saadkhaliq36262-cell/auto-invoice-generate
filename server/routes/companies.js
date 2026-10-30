/**
 * Companies Management Routes
 */
const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { v4: uuidv4 } = require('uuid');

// GET /api/companies - list all active companies (or all if query include_archived=true)
router.get('/', (req, res) => {
  try {
    const includeArchived = req.query.include_archived === 'true';
    let query = 'SELECT * FROM companies WHERE is_archived = 0 ORDER BY is_default DESC, name ASC';
    if (includeArchived) {
      query = 'SELECT * FROM companies ORDER BY is_archived ASC, is_default DESC, name ASC';
    }
    const companies = db.prepare(query).all();
    res.json({ success: true, data: companies, companies });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/companies/:id - single company details
router.get('/:id', (req, res) => {
  try {
    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);
    if (!company) {
      return res.status(404).json({ success: false, error: 'Company not found' });
    }
    res.json({ success: true, data: company, company });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/companies - create company
router.post('/', (req, res) => {
  try {
    const {
      name, logo, address, email, phone, website, tax_id,
      bank_name, account_name, account_number, iban, swift,
      currency, invoice_prefix, next_invoice_number, payment_terms
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Company name is required' });
    }

    const id = 'comp_' + uuidv4().slice(0, 12);
    const prefix = invoice_prefix ? invoice_prefix.trim() : 'INV-';
    const nextNum = parseInt(next_invoice_number, 10) || 1;

    db.prepare(`
      INSERT INTO companies (
        id, name, logo, address, email, phone, website, tax_id,
        bank_name, account_name, account_number, iban, swift,
        currency, invoice_prefix, next_invoice_number, payment_terms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, name.trim(), logo || '', address || '', email || '', phone || '', website || '', tax_id || '',
      bank_name || '', account_name || '', account_number || '', iban || '', swift || '',
      currency || 'USD', prefix, nextNum, payment_terms || 'Net 14'
    );

    // Create a default Classic template for this new company
    const tmplId = 'tmpl_' + uuidv4().slice(0, 12);
    db.prepare(`
      INSERT INTO invoice_templates (id, company_id, name, type, is_default, config_json)
      VALUES (?, ?, ?, ?, 1, ?)
    `).run(tmplId, id, 'Modern Minimal', 'preset', JSON.stringify({ style: 'modern' }));

    const created = db.prepare('SELECT * FROM companies WHERE id = ?').get(id);
    res.status(201).json({ success: true, data: created, company: created });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/companies/:id - update company
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM companies WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Company not found' });
    }

    const fields = [
      'name', 'logo', 'address', 'email', 'phone', 'website', 'tax_id',
      'bank_name', 'account_name', 'account_number', 'iban', 'swift',
      'currency', 'invoice_prefix', 'next_invoice_number', 'payment_terms'
    ];

    const updates = [];
    const values = [];

    fields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(req.body[field]);
      }
    });

    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')");
      values.push(id);
      db.prepare(`UPDATE companies SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    const updated = db.prepare('SELECT * FROM companies WHERE id = ?').get(id);
    res.json({ success: true, company: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/companies/:id/archive - toggle archive status
router.post('/:id/archive', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM companies WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Company not found' });
    }

    const newArchived = existing.is_archived ? 0 : 1;
    db.prepare("UPDATE companies SET is_archived = ?, updated_at = datetime('now') WHERE id = ?").run(newArchived, id);

    res.json({ success: true, is_archived: newArchived });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/companies/:id/set-default - set default company
router.post('/:id/set-default', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('UPDATE companies SET is_default = 0').run();
    db.prepare('UPDATE companies SET is_default = 1 WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/companies/:id - delete company and cascades
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM companies WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Company not found' });
    }

    db.prepare('DELETE FROM companies WHERE id = ?').run(id);
    res.json({ success: true, message: 'Company and associated records deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
