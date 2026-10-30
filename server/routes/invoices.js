/**
 * Invoices Management Routes
 */
const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { v4: uuidv4 } = require('uuid');

// GET /api/invoices - list invoices with filters
router.get('/', (req, res) => {
  try {
    const { company_id, status, client_id, q } = req.query;
    let sql = `
      SELECT inv.*, 
        c.name as client_name, c.email as client_email, c.business_name as client_business_name,
        comp.name as company_name, comp.currency as company_currency,
        t.name as template_name
      FROM invoices inv
      JOIN clients c ON inv.client_id = c.id
      JOIN companies comp ON inv.company_id = comp.id
      LEFT JOIN invoice_templates t ON inv.template_id = t.id
      WHERE 1=1
    `;
    const params = [];

    if (company_id && company_id !== 'all') {
      sql += ' AND inv.company_id = ?';
      params.push(company_id);
    }

    if (status && status !== 'all') {
      sql += ' AND inv.status = ?';
      params.push(status.toLowerCase());
    }

    if (client_id) {
      sql += ' AND inv.client_id = ?';
      params.push(client_id);
    }

    if (q && q.trim()) {
      sql += ' AND (inv.invoice_number LIKE ? OR c.name LIKE ? OR c.business_name LIKE ?)';
      const term = `%${q.trim()}%`;
      params.push(term, term, term);
    }

    sql += ' ORDER BY inv.invoice_date DESC, inv.created_at DESC';

    const invoices = db.prepare(sql).all(...params);
    res.json({ success: true, data: invoices, invoices });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/invoices/next-number - calculate next invoice number for company
router.get('/next-number', (req, res) => {
  try {
    const { company_id } = req.query;
    if (!company_id) return res.status(400).json({ success: false, error: 'company_id required' });
    const company = db.prepare('SELECT invoice_prefix, next_invoice_number FROM companies WHERE id = ?').get(company_id);
    if (!company) return res.status(404).json({ success: false, error: 'Company not found' });
    const prefix = company.invoice_prefix || 'INV-';
    const seq = company.next_invoice_number || 1;
    const nextNumber = `${prefix}${String(seq).padStart(4, '0')}`;
    res.json({ success: true, data: { next_invoice_number: nextNumber, prefix, sequence: seq } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/invoices/:id - full invoice details
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const invoice = db.prepare(`
      SELECT inv.*, 
        c.name as client_name, c.email as client_email, c.phone as client_phone, 
        c.address as client_address, c.tax_id as client_tax_id, c.business_name as client_business_name,
        comp.name as company_name, comp.logo as company_logo, comp.address as company_address,
        comp.email as company_email, comp.phone as company_phone, comp.website as company_website,
        comp.tax_id as company_tax_id, comp.bank_name, comp.account_name, comp.account_number,
        comp.iban, comp.swift,
        t.name as template_name, t.type as template_type, t.config_json as template_config
      FROM invoices inv
      JOIN clients c ON inv.client_id = c.id
      JOIN companies comp ON inv.company_id = comp.id
      LEFT JOIN invoice_templates t ON inv.template_id = t.id
      WHERE inv.id = ?
    `).get(id);

    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    // Get items
    const items = db.prepare(`
      SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order ASC
    `).all(id);

    // Get payments
    const payments = db.prepare(`
      SELECT * FROM payments WHERE invoice_id = ? ORDER BY payment_date DESC
    `).all(id);

    const fullInvoice = {
      ...invoice,
      items,
      payments
    };
    res.json({
      success: true,
      data: fullInvoice,
      invoice: fullInvoice
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/invoices - create invoice
router.post('/', (req, res) => {
  try {
    const {
      company_id, client_id, invoice_number, invoice_date, due_date, currency,
      payment_terms, template_id, status, items, discount_type, discount_value,
      tax_rate, shipping, notes, payment_details
    } = req.body;

    if (!company_id) return res.status(400).json({ success: false, error: 'Company ID is required' });
    if (!client_id) return res.status(400).json({ success: false, error: 'Client ID is required' });

    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(company_id);
    if (!company) return res.status(404).json({ success: false, error: 'Company not found' });

    // Determine invoice number
    let finalInvNum = invoice_number ? invoice_number.trim() : '';
    if (!finalInvNum) {
      const prefix = company.invoice_prefix || 'INV-';
      const seq = company.next_invoice_number || 1;
      finalInvNum = `${prefix}${String(seq).padStart(4, '0')}`;
      // Advance company next_invoice_number
      db.prepare('UPDATE companies SET next_invoice_number = next_invoice_number + 1 WHERE id = ?').run(company_id);
    }

    // Select default template if not specified
    let finalTemplateId = template_id;
    if (!finalTemplateId) {
      const defTemplate = db.prepare('SELECT id FROM invoice_templates WHERE company_id = ? AND is_default = 1').get(company_id);
      finalTemplateId = defTemplate ? defTemplate.id : null;
    }

    // Calculate line items and totals
    const lineItems = Array.isArray(items) && items.length > 0 ? items : [
      { description: 'Consulting Services', quantity: 1, unit_price: 100.0, tax_rate: 0 }
    ];

    let subtotal = 0;
    lineItems.forEach(item => {
      const qty = parseFloat(item.quantity) || 1;
      const price = parseFloat(item.unit_price) || 0;
      subtotal += (qty * price);
    });

    const discType = discount_type || 'fixed';
    const discVal = parseFloat(discount_value) || 0;
    let discAmount = discType === 'percentage' ? (subtotal * discVal) / 100 : Math.min(discVal, subtotal);

    const taxableAmount = Math.max(0, subtotal - discAmount);
    const taxR = parseFloat(tax_rate) || 0;
    const taxAmount = (taxableAmount * taxR) / 100;
    const shippingFee = parseFloat(shipping) || 0;
    const total = Math.max(0, taxableAmount + taxAmount + shippingFee);

    const invoiceId = 'inv_' + uuidv4().slice(0, 12);
    const today = new Date().toISOString().split('T')[0];
    const defaultDue = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];

    db.prepare(`
      INSERT INTO invoices (
        id, company_id, client_id, invoice_number, invoice_date, due_date, currency,
        payment_terms, template_id, status, subtotal, tax_rate, tax_amount,
        discount_type, discount_value, discount_amount, shipping, total, amount_paid,
        notes, payment_details
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).run(
      invoiceId, company_id, client_id, finalInvNum, invoice_date || today, due_date || defaultDue,
      currency || company.currency || 'USD', payment_terms || company.payment_terms || 'Net 14',
      finalTemplateId, status || 'draft', subtotal, taxR, taxAmount,
      discType, discVal, discAmount, shippingFee, total,
      notes || '', payment_details || ''
    );

    // Insert line items
    const insertItem = db.prepare(`
      INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price, tax_rate, amount, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    lineItems.forEach((item, index) => {
      const itemId = 'item_' + uuidv4().slice(0, 12);
      const qty = parseFloat(item.quantity) || 1;
      const price = parseFloat(item.unit_price) || 0;
      const itemTax = parseFloat(item.tax_rate) || 0;
      const amt = qty * price;
      insertItem.run(itemId, invoiceId, item.description || '', qty, price, itemTax, amt, index + 1);
    });

    const created = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId);
    res.status(201).json({ success: true, data: created, invoice: created });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/invoices/:id - update invoice
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ success: false, error: 'Invoice not found' });

    const {
      company_id, client_id, invoice_number, invoice_date, due_date, currency,
      payment_terms, template_id, status, items, discount_type, discount_value,
      tax_rate, shipping, notes, payment_details
    } = req.body;

    // Recalculate if items provided
    let subtotal = existing.subtotal;
    let discAmount = existing.discount_amount;
    let taxAmount = existing.tax_amount;
    let total = existing.total;

    const discType = discount_type !== undefined ? discount_type : existing.discount_type;
    const discVal = discount_value !== undefined ? parseFloat(discount_value) : existing.discount_value;
    const taxR = tax_rate !== undefined ? parseFloat(tax_rate) : existing.tax_rate;
    const shippingFee = shipping !== undefined ? parseFloat(shipping) : existing.shipping;

    if (Array.isArray(items)) {
      subtotal = 0;
      items.forEach(item => {
        const qty = parseFloat(item.quantity) || 1;
        const price = parseFloat(item.unit_price) || 0;
        subtotal += (qty * price);
      });

      discAmount = discType === 'percentage' ? (subtotal * discVal) / 100 : Math.min(discVal, subtotal);
      const taxable = Math.max(0, subtotal - discAmount);
      taxAmount = (taxable * taxR) / 100;
      total = Math.max(0, taxable + taxAmount + shippingFee);

      // Replace line items
      db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(id);
      const insertItem = db.prepare(`
        INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price, tax_rate, amount, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      items.forEach((item, index) => {
        const itemId = 'item_' + uuidv4().slice(0, 12);
        const qty = parseFloat(item.quantity) || 1;
        const price = parseFloat(item.unit_price) || 0;
        const itemTax = parseFloat(item.tax_rate) || 0;
        const amt = qty * price;
        insertItem.run(itemId, id, item.description || '', qty, price, itemTax, amt, index + 1);
      });
    }

    db.prepare(`
      UPDATE invoices SET 
        company_id = COALESCE(?, company_id),
        client_id = COALESCE(?, client_id),
        invoice_number = COALESCE(?, invoice_number),
        invoice_date = COALESCE(?, invoice_date),
        due_date = COALESCE(?, due_date),
        currency = COALESCE(?, currency),
        payment_terms = COALESCE(?, payment_terms),
        template_id = COALESCE(?, template_id),
        status = COALESCE(?, status),
        subtotal = ?,
        discount_type = ?,
        discount_value = ?,
        discount_amount = ?,
        tax_rate = ?,
        tax_amount = ?,
        shipping = ?,
        total = ?,
        notes = COALESCE(?, notes),
        payment_details = COALESCE(?, payment_details),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      company_id, client_id, invoice_number, invoice_date, due_date, currency,
      payment_terms, template_id, status,
      subtotal, discType, discVal, discAmount, taxR, taxAmount, shippingFee, total,
      notes, payment_details,
      id
    );

    const updated = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
    res.json({ success: true, invoice: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/invoices/:id/status - update status
router.post('/:id/status', (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) return res.status(400).json({ success: false, error: 'Status is required' });

    const validStatuses = ['draft', 'sent', 'paid', 'partially_paid', 'overdue', 'cancelled'];
    if (!validStatuses.includes(status.toLowerCase())) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    const updates = ['status = ?', "updated_at = datetime('now')"];
    const params = [status.toLowerCase()];

    if (status.toLowerCase() === 'paid') {
      const inv = db.prepare('SELECT total FROM invoices WHERE id = ?').get(id);
      if (inv) {
        updates.push('amount_paid = ?');
        params.push(inv.total);
      }
    }

    params.push(id);
    db.prepare(`UPDATE invoices SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    const updated = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
    res.json({ success: true, invoice: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/invoices/:id/duplicate - duplicate invoice
router.post('/:id/duplicate', (req, res) => {
  try {
    const { id } = req.params;
    const orig = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
    if (!orig) return res.status(404).json({ success: false, error: 'Invoice not found' });

    const company = db.prepare('SELECT invoice_prefix, next_invoice_number FROM companies WHERE id = ?').get(orig.company_id);
    const prefix = company ? company.invoice_prefix : 'INV-';
    const seq = company ? company.next_invoice_number : 1;
    const newInvNum = `${prefix}${String(seq).padStart(4, '0')}`;
    if (company) {
      db.prepare('UPDATE companies SET next_invoice_number = next_invoice_number + 1 WHERE id = ?').run(orig.company_id);
    }

    const newId = 'inv_' + uuidv4().slice(0, 12);
    const today = new Date().toISOString().split('T')[0];
    const defaultDue = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];

    db.prepare(`
      INSERT INTO invoices (
        id, company_id, client_id, invoice_number, invoice_date, due_date, currency,
        payment_terms, template_id, status, subtotal, tax_rate, tax_amount,
        discount_type, discount_value, discount_amount, shipping, total, amount_paid,
        notes, payment_details
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).run(
      newId, orig.company_id, orig.client_id, newInvNum, today, defaultDue, orig.currency,
      orig.payment_terms, orig.template_id, orig.subtotal, orig.tax_rate, orig.tax_amount,
      orig.discount_type, orig.discount_value, orig.discount_amount, orig.shipping, orig.total,
      orig.notes, orig.payment_details
    );

    // Duplicate line items
    const origItems = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(id);
    const insertItem = db.prepare(`
      INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price, tax_rate, amount, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    origItems.forEach((item, idx) => {
      insertItem.run('item_' + uuidv4().slice(0, 12), newId, item.description, item.quantity, item.unit_price, item.tax_rate, item.amount, idx + 1);
    });

    const duplicated = db.prepare('SELECT * FROM invoices WHERE id = ?').get(newId);
    res.status(201).json({ success: true, data: { ...duplicated, invoice_id: newId }, invoice: duplicated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/invoices/:id - delete invoice
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ success: false, error: 'Invoice not found' });

    db.prepare('DELETE FROM invoices WHERE id = ?').run(id);
    res.json({ success: true, message: 'Invoice deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
