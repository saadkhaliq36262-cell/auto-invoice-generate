/**
 * In-App AI Assistant Route for AutoInvoice Pro
 * Processes natural language prompts into database operations, queries, and SaaS actions.
 */
const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { v4: uuidv4 } = require('uuid');

// POST /api/assistant/chat
router.post('/chat', async (req, res) => {
  try {
    const { message, company_id } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, error: 'Message cannot be empty' });
    }

    const query = message.trim().toLowerCase();
    const isAll = !company_id || company_id === 'all';

    let reply = '';
    let action = null;
    let records = [];

    // 1. Invoices & Balances queries
    if (query.includes('overdue')) {
      let sql = `
        SELECT i.*, c.name as company_name, cl.name as client_name 
        FROM invoices i
        JOIN companies c ON i.company_id = c.id
        JOIN clients cl ON i.client_id = cl.id
        WHERE (i.status = 'overdue' OR (i.due_date < date('now') AND i.status NOT IN ('paid', 'cancelled')))
      `;
      const params = [];
      if (!isAll) {
        sql += ` AND i.company_id = ?`;
        params.push(company_id);
      }
      records = db.prepare(sql).all(...params);

      const totalOverdue = records.reduce((acc, row) => acc + (row.total - row.amount_paid), 0);
      if (records.length === 0) {
        reply = `Great news! You currently have zero overdue invoices${!isAll ? ' for this company' : ''}.`;
      } else {
        reply = `You have ${records.length} overdue invoice(s) totaling **${records[0].currency} ${totalOverdue.toFixed(2)}**:\n\n` +
          records.map(r => `• **${r.invoice_number}** – ${r.client_name}: ${r.currency} ${(r.total - r.amount_paid).toFixed(2)} (Due: ${r.due_date})`).join('\n');
        action = { type: 'navigate', path: '#invoices?filter=overdue', label: 'View Overdue Invoices' };
      }

    } else if (query.includes('outstanding') || query.includes('unpaid')) {
      let sql = `
        SELECT i.*, c.name as company_name, cl.name as client_name 
        FROM invoices i
        JOIN companies c ON i.company_id = c.id
        JOIN clients cl ON i.client_id = cl.id
        WHERE i.status IN ('draft', 'sent', 'partially_paid', 'overdue')
      `;
      const params = [];
      if (!isAll) {
        sql += ` AND i.company_id = ?`;
        params.push(company_id);
      }
      records = db.prepare(sql).all(...params);
      const totalOutstanding = records.reduce((acc, row) => acc + (row.total - row.amount_paid), 0);

      reply = `You have ${records.length} outstanding invoice(s) with an unpaid balance of **${records[0]?.currency || '$'} ${totalOutstanding.toFixed(2)}**.\n\n` +
        records.slice(0, 5).map(r => `• **${r.invoice_number}** – ${r.client_name}: ${r.currency} ${(r.total - r.amount_paid).toFixed(2)} [Status: ${r.status}]`).join('\n');
      if (records.length > 5) {
        reply += `\n...and ${records.length - 5} more.`;
      }
      action = { type: 'navigate', path: '#invoices?filter=unpaid', label: 'View All Invoices' };

    } else if (query.includes('client') || query.includes('customer')) {
      let sql = `SELECT * FROM clients`;
      const params = [];
      if (!isAll) {
        sql += ` WHERE company_id = ?`;
        params.push(company_id);
      }
      records = db.prepare(sql).all(...params);

      reply = `You have ${records.length} registered client(s)${!isAll ? ' under the active company' : ' across all companies'}:\n\n` +
        records.slice(0, 6).map(c => `• **${c.name}** (${c.email || 'No email'}) - ${c.business_name || 'Individual'}`).join('\n');
      action = { type: 'navigate', path: '#clients', label: 'Manage Clients' };

    } else if (query.includes('company') || query.includes('companies')) {
      const companies = db.prepare('SELECT id, name, currency, is_default FROM companies ORDER BY name').all();
      reply = `You have ${companies.length} company profiles configured in AutoInvoice Pro:\n\n` +
        companies.map(c => `• **${c.name}** [${c.currency}] ${c.is_default ? '*(Default)*' : ''}`).join('\n');
      action = { type: 'open_modal', modal: 'company_manager', label: 'Manage Companies' };

    } else if (query.includes('template')) {
      let sql = `SELECT t.*, c.name as company_name FROM invoice_templates t JOIN companies c ON t.company_id = c.id`;
      const params = [];
      if (!isAll) {
        sql += ` WHERE t.company_id = ?`;
        params.push(company_id);
      }
      records = db.prepare(sql).all(...params);
      reply = `You have ${records.length} template(s) available:\n\n` +
        records.map(t => `• **${t.name}** (${t.type}) for *${t.company_name}* ${t.is_default ? '⭐ Default' : ''}`).join('\n');
      action = { type: 'navigate', path: '#templates', label: 'Open Template Library' };

    } else if (query.includes('create invoice') || query.includes('new invoice') || query.includes('generate invoice')) {
      reply = `I can help you create a new invoice right away! Would you like to use the visual form or the quick text parser?`;
      action = { type: 'navigate', path: '#invoices/new', label: 'Go to Invoice Creator' };

    } else if (query.includes('mcp') || query.includes('model context')) {
      reply = `AutoInvoice Pro is equipped with a high-performance Streamable MCP server running at **/mcp** with 30+ tools. You can connect Cursor, Claude Desktop, or Windsurf directly using your API tokens.`;
      action = { type: 'navigate', path: '#settings?tab=mcp', label: 'Open MCP Settings' };

    } else {
      // General stats summary fallback
      const comp = !isAll ? db.prepare('SELECT name, currency FROM companies WHERE id = ?').get(company_id) : null;
      const countInv = db.prepare('SELECT COUNT(*) as c FROM invoices').get().c;
      const countCli = db.prepare('SELECT COUNT(*) as c FROM clients').get().c;

      reply = `I'm your **AutoInvoice Pro AI Assistant**. Currently managing ${countInv} invoices and ${countCli} clients${comp ? ` for ${comp.name}` : ''}.\n\nTry asking me:\n- *"What are my overdue invoices?"*\n- *"Show me my client list"*\n- *"What templates do I have?"*\n- *"How do I connect MCP?"*`;
    }

    res.json({
      success: true,
      data: {
        reply,
        action,
        records
      }
    });
  } catch (err) {
    console.error('Error in AI Assistant:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
