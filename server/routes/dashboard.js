/**
 * Dashboard Routes for AutoInvoice Pro
 * Provides aggregated stats (Outstanding, Overdue, Paid, Clients count),
 * recent invoices, and chart data, filtered by company or across all companies.
 */
const express = require('express');
const router = express.Router();
const { db } = require('../db');

// GET /api/dashboard/stats?company_id=...
router.get('/stats', (req, res) => {
  try {
    const { company_id } = req.query;
    const isAll = !company_id || company_id === 'all';

    let outstandingQuery = `
      SELECT 
        COUNT(*) as count, 
        COALESCE(SUM(total - amount_paid), 0) as total_amount 
      FROM invoices 
      WHERE status IN ('sent', 'partially_paid', 'draft')
    `;
    let overdueQuery = `
      SELECT 
        COUNT(*) as count, 
        COALESCE(SUM(total - amount_paid), 0) as total_amount 
      FROM invoices 
      WHERE (status = 'overdue' OR (due_date < date('now') AND status NOT IN ('paid', 'cancelled')))`
    ;
    let paidQuery = `
      SELECT 
        COUNT(*) as count, 
        COALESCE(SUM(amount_paid), 0) as total_amount 
      FROM invoices 
      WHERE amount_paid > 0
    `;
    let clientsQuery = `
      SELECT COUNT(*) as count FROM clients
    `;

    const params = [];
    if (!isAll) {
      outstandingQuery += ` AND company_id = ?`;
      overdueQuery += ` AND company_id = ?`;
      paidQuery += ` AND company_id = ?`;
      clientsQuery += ` WHERE company_id = ?`;
      params.push(company_id);
    }

    const outstanding = isAll 
      ? db.prepare(outstandingQuery).get()
      : db.prepare(outstandingQuery).get(company_id);

    const overdue = isAll
      ? db.prepare(overdueQuery).get()
      : db.prepare(overdueQuery).get(company_id);

    const paid = isAll
      ? db.prepare(paidQuery).get()
      : db.prepare(paidQuery).get(company_id);

    const clients = isAll
      ? db.prepare(clientsQuery).get()
      : db.prepare(clientsQuery).get(company_id);

    // Get currency symbol/code for selected company
    let currency = 'USD';
    if (!isAll) {
      const comp = db.prepare('SELECT currency FROM companies WHERE id = ?').get(company_id);
      if (comp) currency = comp.currency;
    }

    res.json({
      success: true,
      data: {
        currency,
        outstanding: {
          count: outstanding.count,
          amount: outstanding.total_amount
        },
        overdue: {
          count: overdue.count,
          amount: overdue.total_amount
        },
        paid: {
          count: paid.count,
          amount: paid.total_amount
        },
        clients: {
          count: clients.count
        }
      }
    });
  } catch (err) {
    console.error('Error fetching dashboard stats:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/dashboard/recent-invoices?company_id=...&limit=10
router.get('/recent-invoices', (req, res) => {
  try {
    const { company_id, limit = 10 } = req.query;
    const isAll = !company_id || company_id === 'all';

    let query = `
      SELECT 
        i.*,
        c.name as company_name,
        c.currency as company_currency,
        cl.name as client_name,
        cl.email as client_email,
        cl.business_name as client_business_name
      FROM invoices i
      JOIN companies c ON i.company_id = c.id
      JOIN clients cl ON i.client_id = cl.id
    `;

    const params = [];
    if (!isAll) {
      query += ` WHERE i.company_id = ?`;
      params.push(company_id);
    }

    query += ` ORDER BY i.created_at DESC LIMIT ?`;
    params.push(parseInt(limit, 10));

    const invoices = db.prepare(query).all(...params);

    res.json({
      success: true,
      data: invoices
    });
  } catch (err) {
    console.error('Error fetching recent invoices:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/dashboard/monthly-breakdown?company_id=...
router.get('/monthly-breakdown', (req, res) => {
  try {
    const { company_id } = req.query;
    const isAll = !company_id || company_id === 'all';

    let query = `
      SELECT 
        strftime('%Y-%m', invoice_date) as month,
        COUNT(*) as invoice_count,
        COALESCE(SUM(total), 0) as total_invoiced,
        COALESCE(SUM(amount_paid), 0) as total_collected
      FROM invoices
    `;

    const params = [];
    if (!isAll) {
      query += ` WHERE company_id = ?`;
      params.push(company_id);
    }

    query += ` GROUP BY strftime('%Y-%m', invoice_date) ORDER BY month DESC LIMIT 6`;

    const breakdown = db.prepare(query).all(...params);

    res.json({
      success: true,
      data: breakdown
    });
  } catch (err) {
    console.error('Error fetching monthly breakdown:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
