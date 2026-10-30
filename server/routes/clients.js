/**
 * Clients Management Routes
 */
const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { v4: uuidv4 } = require('uuid');

// GET /api/clients - list clients (optional company_id and search q)
router.get('/', (req, res) => {
  try {
    const { company_id, q, search } = req.query;
    const queryTerm = (search || q || '').trim();
    let sql = `
      SELECT c.*, comp.name as company_name,
        COALESCE(SUM(CASE WHEN inv.status != 'paid' AND inv.status != 'cancelled' THEN (inv.total - inv.amount_paid) ELSE 0 END), 0) as outstanding_balance,
        COUNT(inv.id) as total_invoices
      FROM clients c
      LEFT JOIN companies comp ON c.company_id = comp.id
      LEFT JOIN invoices inv ON c.id = inv.client_id
      WHERE 1=1
    `;
    const params = [];

    if (company_id && company_id !== 'all') {
      sql += ' AND c.company_id = ?';
      params.push(company_id);
    }

    if (queryTerm) {
      sql += ' AND (c.name LIKE ? OR c.business_name LIKE ? OR c.email LIKE ?)';
      const term = `%${queryTerm}%`;
      params.push(term, term, term);
    }

    sql += ' GROUP BY c.id ORDER BY c.created_at DESC';

    const clients = db.prepare(sql).all(...params);
    res.json({ success: true, data: clients, clients });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/clients/:id - client details with invoices and payment history
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const client = db.prepare(`
      SELECT c.*, comp.name as company_name, comp.currency
      FROM clients c
      LEFT JOIN companies comp ON c.company_id = comp.id
      WHERE c.id = ?
    `).get(id);

    if (!client) {
      return res.status(404).json({ success: false, error: 'Client not found' });
    }

    // Invoices for this client
    const invoices = db.prepare(`
      SELECT id, invoice_number, invoice_date, due_date, total, amount_paid, status, currency
      FROM invoices
      WHERE client_id = ?
      ORDER BY invoice_date DESC
    `).all(id);

    // Calculate balance
    let totalInvoiced = 0;
    let totalPaid = 0;
    invoices.forEach(inv => {
      if (inv.status !== 'cancelled') {
        totalInvoiced += inv.total;
        totalPaid += inv.amount_paid;
      }
    });

    const payload = {
      ...client,
      total_invoiced: totalInvoiced,
      total_paid: totalPaid,
      outstanding_balance: Math.max(0, totalInvoiced - totalPaid),
      invoices
    };

    res.json({
      success: true,
      data: payload,
      client: payload
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/clients - create client
router.post('/', (req, res) => {
  try {
    const { company_id, name, business_name, email, phone, address, tax_id, notes } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Client name is required' });
    }
    if (!company_id) {
      return res.status(400).json({ success: false, error: 'Company ID is required' });
    }

    const id = 'client_' + uuidv4().slice(0, 12);

    db.prepare(`
      INSERT INTO clients (id, company_id, name, business_name, email, phone, address, tax_id, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, company_id, name.trim(), business_name ? business_name.trim() : '',
      email ? email.trim() : '', phone ? phone.trim() : '',
      address || '', tax_id || '', notes || ''
    );

    const created = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
    res.status(201).json({ success: true, data: created, client: created });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/clients/:id - update client
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Client not found' });
    }

    const fields = ['company_id', 'name', 'business_name', 'email', 'phone', 'address', 'tax_id', 'notes'];
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
      db.prepare(`UPDATE clients SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    const updated = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
    res.json({ success: true, client: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/clients/:id - delete client
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Client not found' });
    }

    db.prepare('DELETE FROM clients WHERE id = ?').run(id);
    res.json({ success: true, message: 'Client deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
