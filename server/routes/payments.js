/**
 * Payments Routes for AutoInvoice Pro
 * Handles recording manual/partial payments, updating invoice status, and transaction history.
 */
const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { v4: uuidv4 } = require('uuid');

// GET /api/payments?company_id=...
router.get('/', (req, res) => {
  try {
    const { company_id } = req.query;
    const isAll = !company_id || company_id === 'all';

    let query = `
      SELECT 
        p.*,
        i.invoice_number,
        i.total as invoice_total,
        i.currency,
        c.name as company_name,
        cl.name as client_name
      FROM payments p
      JOIN invoices i ON p.invoice_id = i.id
      JOIN companies c ON p.company_id = c.id
      JOIN clients cl ON i.client_id = cl.id
    `;
    const params = [];
    if (!isAll) {
      query += ` WHERE p.company_id = ?`;
      params.push(company_id);
    }
    query += ` ORDER BY p.payment_date DESC, p.created_at DESC`;

    const payments = db.prepare(query).all(...params);
    res.json({ success: true, data: payments });
  } catch (err) {
    console.error('Error fetching payments:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/payments/invoice/:invoice_id
router.get('/invoice/:invoice_id', (req, res) => {
  try {
    const { invoice_id } = req.params;
    const payments = db.prepare(`
      SELECT * FROM payments WHERE invoice_id = ? ORDER BY payment_date DESC, created_at DESC
    `).all(invoice_id);

    res.json({ success: true, data: payments });
  } catch (err) {
    console.error('Error fetching invoice payments:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/payments
router.post('/', (req, res) => {
  try {
    const {
      invoice_id,
      amount,
      payment_date,
      payment_method = 'Bank Transfer',
      reference_number = '',
      notes = ''
    } = req.body;

    if (!invoice_id || amount === undefined || amount === null) {
      return res.status(400).json({ success: false, error: 'invoice_id and amount are required' });
    }

    const payAmount = parseFloat(amount);
    if (isNaN(payAmount) || payAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Payment amount must be greater than zero' });
    }

    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoice_id);
    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    const paymentId = 'pay_' + uuidv4().replace(/-/g, '').slice(0, 16);
    const dateStr = payment_date || new Date().toISOString().split('T')[0];

    // Insert payment
    db.prepare(`
      INSERT INTO payments (
        id, invoice_id, company_id, payment_date, amount, payment_method, reference_number, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      paymentId,
      invoice_id,
      invoice.company_id,
      dateStr,
      payAmount,
      payment_method,
      reference_number,
      notes
    );

    // Calculate total paid so far
    const sumRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total_paid FROM payments WHERE invoice_id = ?
    `).get(invoice_id);
    const newTotalPaid = sumRow.total_paid;

    // Determine status: paid if newTotalPaid >= invoice.total, partially_paid if > 0, else sent
    let newStatus = invoice.status;
    if (newTotalPaid >= invoice.total) {
      newStatus = 'paid';
    } else if (newTotalPaid > 0) {
      newStatus = 'partially_paid';
    }

    db.prepare(`
      UPDATE invoices 
      SET amount_paid = ?, status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(newTotalPaid, newStatus, invoice_id);

    // Log audit
    db.prepare(`
      INSERT INTO audit_logs (id, company_id, action, entity_type, entity_id, details)
      VALUES (?, ?, 'payment_recorded', 'invoice', ?, ?)
    `).run(
      'log_' + uuidv4().slice(0, 12),
      invoice.company_id,
      invoice_id,
      `Recorded payment of ${payAmount} via ${payment_method}. Ref: ${reference_number}`
    );

    res.json({
      success: true,
      data: {
        payment_id: paymentId,
        invoice_id,
        amount_paid: newTotalPaid,
        balance_remaining: Math.max(0, invoice.total - newTotalPaid),
        status: newStatus
      }
    });
  } catch (err) {
    console.error('Error recording payment:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/payments/:id
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(id);
    if (!payment) {
      return res.status(404).json({ success: false, error: 'Payment not found' });
    }

    db.prepare('DELETE FROM payments WHERE id = ?').run(id);

    // Recalculate invoice amount_paid
    const sumRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total_paid FROM payments WHERE invoice_id = ?
    `).get(payment.invoice_id);
    const newTotalPaid = sumRow.total_paid;

    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(payment.invoice_id);
    let newStatus = 'sent';
    if (newTotalPaid >= invoice.total) {
      newStatus = 'paid';
    } else if (newTotalPaid > 0) {
      newStatus = 'partially_paid';
    } else {
      newStatus = 'sent';
    }

    db.prepare(`
      UPDATE invoices 
      SET amount_paid = ?, status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(newTotalPaid, newStatus, payment.invoice_id);

    res.json({ success: true, message: 'Payment deleted and invoice updated' });
  } catch (err) {
    console.error('Error deleting payment:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
