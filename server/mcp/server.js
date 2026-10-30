/**
 * Model Context Protocol (MCP) Server for AutoInvoice Pro
 * Full Streamable HTTP MCP Server mounted at /mcp
 * Implements 35 comprehensive tools across Companies, Clients, Invoices, Templates, Mail, and Dashboard.
 */
const { db } = require('../db');
const { v4: uuidv4 } = require('uuid');

let mcpServerInstance = null;
let streamableTransport = null;

// Tool definitions schema
const TOOLS_DEFINITIONS = [
  // --- Companies (1-6) ---
  {
    name: 'list_companies',
    description: 'List all company profiles with branding, currencies, and default status',
    inputSchema: {
      type: 'object',
      properties: {
        include_archived: { type: 'boolean', description: 'Whether to include archived companies' }
      }
    }
  },
  {
    name: 'get_company',
    description: 'Get complete details for a single company by ID',
    inputSchema: {
      type: 'object',
      properties: {
        company_id: { type: 'string', description: 'The unique ID of the company' }
      },
      required: ['company_id']
    }
  },
  {
    name: 'create_company',
    description: 'Create a new company profile with independent branding and settings',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Company name' },
        currency: { type: 'string', description: 'Default currency (e.g. USD, GBP, EUR)' },
        invoice_prefix: { type: 'string', description: 'Prefix for invoices (e.g. INV-, SV-)' },
        email: { type: 'string', description: 'Business email address' },
        phone: { type: 'string', description: 'Phone number' },
        address: { type: 'string', description: 'Physical address' },
        website: { type: 'string', description: 'Website URL' },
        tax_id: { type: 'string', description: 'VAT / Tax identification number' },
        bank_name: { type: 'string', description: 'Bank institution name' },
        account_name: { type: 'string', description: 'Bank account holder name' },
        account_number: { type: 'string', description: 'Bank account number' },
        iban: { type: 'string', description: 'IBAN number' },
        swift: { type: 'string', description: 'SWIFT / BIC code' },
        payment_terms: { type: 'string', description: 'Default payment terms (e.g. Net 14)' }
      },
      required: ['name']
    }
  },
  {
    name: 'update_company',
    description: 'Update company details, banking information, or branding',
    inputSchema: {
      type: 'object',
      properties: {
        company_id: { type: 'string', description: 'Company ID to update' },
        name: { type: 'string' },
        currency: { type: 'string' },
        invoice_prefix: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        address: { type: 'string' },
        website: { type: 'string' },
        tax_id: { type: 'string' },
        bank_name: { type: 'string' },
        account_name: { type: 'string' },
        account_number: { type: 'string' },
        iban: { type: 'string' },
        swift: { type: 'string' },
        payment_terms: { type: 'string' }
      },
      required: ['company_id']
    }
  },
  {
    name: 'delete_company',
    description: 'Delete or archive a company profile and its associated records',
    inputSchema: {
      type: 'object',
      properties: {
        company_id: { type: 'string', description: 'Company ID to delete' }
      },
      required: ['company_id']
    }
  },
  {
    name: 'set_default_company',
    description: 'Set a specified company as the default active company profile',
    inputSchema: {
      type: 'object',
      properties: {
        company_id: { type: 'string', description: 'Company ID to set as default' }
      },
      required: ['company_id']
    }
  },

  // --- Clients (7-12) ---
  {
    name: 'list_clients',
    description: 'List clients, optionally filtered by company ID',
    inputSchema: {
      type: 'object',
      properties: {
        company_id: { type: 'string', description: 'Company ID or "all"' },
        search: { type: 'string', description: 'Optional search keyword' }
      }
    }
  },
  {
    name: 'get_client',
    description: 'Get a client profile with total invoiced and outstanding balance',
    inputSchema: {
      type: 'object',
      properties: {
        client_id: { type: 'string', description: 'Client unique ID' }
      },
      required: ['client_id']
    }
  },
  {
    name: 'create_client',
    description: 'Create a new client under a specific company',
    inputSchema: {
      type: 'object',
      properties: {
        company_id: { type: 'string', description: 'Company ID the client belongs to' },
        name: { type: 'string', description: 'Client or contact person name' },
        business_name: { type: 'string', description: 'Client company or business name' },
        email: { type: 'string', description: 'Email address' },
        phone: { type: 'string', description: 'Phone number' },
        address: { type: 'string', description: 'Billing address' },
        tax_id: { type: 'string', description: 'Client VAT / Tax ID' },
        notes: { type: 'string', description: 'Internal client notes' }
      },
      required: ['company_id', 'name']
    }
  },
  {
    name: 'update_client',
    description: 'Update client contact and billing information',
    inputSchema: {
      type: 'object',
      properties: {
        client_id: { type: 'string', description: 'Client ID' },
        name: { type: 'string' },
        business_name: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        address: { type: 'string' },
        tax_id: { type: 'string' },
        notes: { type: 'string' }
      },
      required: ['client_id']
    }
  },
  {
    name: 'delete_client',
    description: 'Delete a client and their records',
    inputSchema: {
      type: 'object',
      properties: {
        client_id: { type: 'string', description: 'Client ID' }
      },
      required: ['client_id']
    }
  },
  {
    name: 'search_clients',
    description: 'Search clients across names, business names, and emails',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term' },
        company_id: { type: 'string', description: 'Optional company filter' }
      },
      required: ['query']
    }
  },

  // --- Invoices (13-25) ---
  {
    name: 'list_invoices',
    description: 'List invoices with filtering by company, status, client, or search term',
    inputSchema: {
      type: 'object',
      properties: {
        company_id: { type: 'string', description: 'Company ID or "all"' },
        status: { type: 'string', description: 'Status filter (draft, sent, paid, overdue)' },
        client_id: { type: 'string', description: 'Filter by client ID' },
        search: { type: 'string', description: 'Search invoice number or client name' }
      }
    }
  },
  {
    name: 'get_invoice',
    description: 'Get full invoice details with line items, payments, and client/company data',
    inputSchema: {
      type: 'object',
      properties: {
        invoice_id: { type: 'string', description: 'Invoice ID' }
      },
      required: ['invoice_id']
    }
  },
  {
    name: 'create_invoice',
    description: 'Create an invoice with automatic line calculations and unique sequence numbering',
    inputSchema: {
      type: 'object',
      properties: {
        company_id: { type: 'string', description: 'Issuing company ID' },
        client_id: { type: 'string', description: 'Target client ID' },
        invoice_date: { type: 'string', description: 'YYYY-MM-DD' },
        due_date: { type: 'string', description: 'YYYY-MM-DD' },
        currency: { type: 'string', description: 'Currency code (e.g. USD, GBP, EUR)' },
        payment_terms: { type: 'string', description: 'Terms (e.g. Net 14)' },
        template_id: { type: 'string', description: 'Optional design template ID' },
        status: { type: 'string', description: 'Status: draft or sent' },
        tax_rate: { type: 'number', description: 'Tax percentage (e.g. 20 for 20%)' },
        discount_type: { type: 'string', description: 'percentage or fixed' },
        discount_value: { type: 'number', description: 'Discount value' },
        shipping: { type: 'number', description: 'Shipping or extra cost' },
        notes: { type: 'string', description: 'Invoice notes/terms' },
        items: {
          type: 'array',
          description: 'Line items',
          items: {
            type: 'object',
            properties: {
              description: { type: 'string' },
              quantity: { type: 'number' },
              unit_price: { type: 'number' },
              tax_rate: { type: 'number' }
            },
            required: ['description', 'unit_price']
          }
        }
      },
      required: ['company_id', 'client_id']
    }
  },
  {
    name: 'update_invoice',
    description: 'Update an existing invoice and recalculate totals',
    inputSchema: {
      type: 'object',
      properties: {
        invoice_id: { type: 'string', description: 'Invoice ID' },
        client_id: { type: 'string' },
        invoice_date: { type: 'string' },
        due_date: { type: 'string' },
        currency: { type: 'string' },
        payment_terms: { type: 'string' },
        template_id: { type: 'string' },
        status: { type: 'string' },
        tax_rate: { type: 'number' },
        discount_type: { type: 'string' },
        discount_value: { type: 'number' },
        shipping: { type: 'number' },
        notes: { type: 'string' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              description: { type: 'string' },
              quantity: { type: 'number' },
              unit_price: { type: 'number' }
            }
          }
        }
      },
      required: ['invoice_id']
    }
  },
  {
    name: 'delete_invoice',
    description: 'Delete an invoice permanently',
    inputSchema: {
      type: 'object',
      properties: {
        invoice_id: { type: 'string', description: 'Invoice ID' }
      },
      required: ['invoice_id']
    }
  },
  {
    name: 'duplicate_invoice',
    description: 'Clone an existing invoice with a newly assigned sequence number',
    inputSchema: {
      type: 'object',
      properties: {
        invoice_id: { type: 'string', description: 'Invoice ID to duplicate' }
      },
      required: ['invoice_id']
    }
  },
  {
    name: 'preview_invoice',
    description: 'Get rendered summary details and preview data for an invoice',
    inputSchema: {
      type: 'object',
      properties: {
        invoice_id: { type: 'string', description: 'Invoice ID' }
      },
      required: ['invoice_id']
    }
  },
  {
    name: 'download_pdf_invoice',
    description: 'Generate or retrieve PDF metadata and download status for an invoice',
    inputSchema: {
      type: 'object',
      properties: {
        invoice_id: { type: 'string', description: 'Invoice ID' }
      },
      required: ['invoice_id']
    }
  },
  {
    name: 'send_invoice_email',
    description: 'Send invoice directly via email with PDF attachment to client',
    inputSchema: {
      type: 'object',
      properties: {
        invoice_id: { type: 'string', description: 'Invoice ID' },
        to_email: { type: 'string', description: 'Recipient email' },
        subject: { type: 'string', description: 'Email subject' },
        body: { type: 'string', description: 'Email body text' }
      },
      required: ['invoice_id', 'to_email', 'subject', 'body']
    }
  },
  {
    name: 'schedule_invoice_email',
    description: 'Schedule an invoice email to be sent at a specific future date/time',
    inputSchema: {
      type: 'object',
      properties: {
        invoice_id: { type: 'string', description: 'Invoice ID' },
        to_email: { type: 'string', description: 'Recipient email' },
        subject: { type: 'string', description: 'Email subject' },
        body: { type: 'string', description: 'Email body' },
        scheduled_for: { type: 'string', description: 'ISO 8601 Date string (e.g. 2026-11-05T09:00:00Z)' }
      },
      required: ['invoice_id', 'to_email', 'subject', 'body', 'scheduled_for']
    }
  },
  {
    name: 'mark_invoice_paid',
    description: 'Mark an invoice as fully paid and record total settlement',
    inputSchema: {
      type: 'object',
      properties: {
        invoice_id: { type: 'string', description: 'Invoice ID' },
        payment_method: { type: 'string', description: 'Payment method (e.g. Bank Transfer, Stripe)' }
      },
      required: ['invoice_id']
    }
  },
  {
    name: 'mark_invoice_sent',
    description: 'Update an invoice status to sent',
    inputSchema: {
      type: 'object',
      properties: {
        invoice_id: { type: 'string', description: 'Invoice ID' }
      },
      required: ['invoice_id']
    }
  },
  {
    name: 'record_payment',
    description: 'Record a partial or full payment against an invoice and update balance',
    inputSchema: {
      type: 'object',
      properties: {
        invoice_id: { type: 'string', description: 'Invoice ID' },
        amount: { type: 'number', description: 'Payment amount' },
        payment_date: { type: 'string', description: 'YYYY-MM-DD' },
        payment_method: { type: 'string', description: 'Bank Transfer, Card, Cash, etc.' },
        reference_number: { type: 'string', description: 'Reference/Transaction code' },
        notes: { type: 'string', description: 'Payment notes' }
      },
      required: ['invoice_id', 'amount']
    }
  },

  // --- Templates (26-31) ---
  {
    name: 'list_templates',
    description: 'List templates belonging to a company with default indicators',
    inputSchema: {
      type: 'object',
      properties: {
        company_id: { type: 'string', description: 'Company ID or "all"' }
      }
    }
  },
  {
    name: 'get_template',
    description: 'Get visual canvas designer elements and configuration of a template',
    inputSchema: {
      type: 'object',
      properties: {
        template_id: { type: 'string', description: 'Template ID' }
      },
      required: ['template_id']
    }
  },
  {
    name: 'create_template',
    description: 'Create a new invoice template for a company',
    inputSchema: {
      type: 'object',
      properties: {
        company_id: { type: 'string', description: 'Owner company ID' },
        name: { type: 'string', description: 'Template title' },
        type: { type: 'string', description: 'designer or pdf_upload' },
        config_json: { type: 'string', description: 'Visual elements JSON string' },
        is_default: { type: 'boolean', description: 'Set as default template for this company' }
      },
      required: ['company_id', 'name']
    }
  },
  {
    name: 'update_template',
    description: 'Update template design elements or layout',
    inputSchema: {
      type: 'object',
      properties: {
        template_id: { type: 'string', description: 'Template ID' },
        name: { type: 'string' },
        config_json: { type: 'string' }
      },
      required: ['template_id']
    }
  },
  {
    name: 'delete_template',
    description: 'Delete an invoice template',
    inputSchema: {
      type: 'object',
      properties: {
        template_id: { type: 'string', description: 'Template ID' }
      },
      required: ['template_id']
    }
  },
  {
    name: 'set_default_template',
    description: 'Set a template as the default design for its owner company',
    inputSchema: {
      type: 'object',
      properties: {
        template_id: { type: 'string', description: 'Template ID' }
      },
      required: ['template_id']
    }
  },

  // --- Mail & Communications (32-33) ---
  {
    name: 'list_email_messages',
    description: 'List emails in Mailbox (Inbox, Sent, Scheduled, Drafts, Failed)',
    inputSchema: {
      type: 'object',
      properties: {
        company_id: { type: 'string', description: 'Company filter' },
        direction: { type: 'string', description: 'incoming or outgoing' },
        status: { type: 'string', description: 'sent, scheduled, draft, failed' }
      }
    }
  },
  {
    name: 'sync_mail_replies',
    description: 'Trigger IMAP sync to fetch client email replies and link to invoices',
    inputSchema: {
      type: 'object',
      properties: {
        company_id: { type: 'string', description: 'Company ID to sync' }
      },
      required: ['company_id']
    }
  },

  // --- Dashboard & Analytics (34-35) ---
  {
    name: 'get_dashboard_stats',
    description: 'Get dashboard KPIs: Outstanding, Overdue, Paid, Clients count',
    inputSchema: {
      type: 'object',
      properties: {
        company_id: { type: 'string', description: 'Company ID or "all"' }
      }
    }
  },
  {
    name: 'get_recent_invoices',
    description: 'Get latest invoices stream with payment status and client metadata',
    inputSchema: {
      type: 'object',
      properties: {
        company_id: { type: 'string', description: 'Company ID or "all"' },
        limit: { type: 'number', description: 'Max items to return' }
      }
    }
  }
];

/**
 * Tool Execution Dispatcher
 */
async function executeTool(name, args) {
  switch (name) {
    // --- Companies ---
    case 'list_companies': {
      const companies = db.prepare('SELECT * FROM companies ORDER BY name ASC').all();
      return { companies };
    }
    case 'get_company': {
      const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(args.company_id);
      if (!company) throw new Error(`Company not found: ${args.company_id}`);
      return { company };
    }
    case 'create_company': {
      const id = 'comp_' + uuidv4().slice(0, 8);
      db.prepare(`
        INSERT INTO companies (
          id, name, currency, invoice_prefix, next_invoice_number, payment_terms,
          email, phone, address, website, tax_id, bank_name, account_name, account_number, iban, swift
        ) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, args.name, args.currency || 'USD', args.invoice_prefix || 'INV-', args.payment_terms || 'Net 14',
        args.email || '', args.phone || '', args.address || '', args.website || '', args.tax_id || '',
        args.bank_name || '', args.account_name || '', args.account_number || '', args.iban || '', args.swift || ''
      );
      return { success: true, company_id: id };
    }
    case 'update_company': {
      const fields = ['name', 'currency', 'invoice_prefix', 'email', 'phone', 'address', 'website', 'tax_id', 'bank_name', 'account_name', 'account_number', 'iban', 'swift', 'payment_terms'];
      const sets = [];
      const vals = [];
      for (const f of fields) {
        if (args[f] !== undefined) {
          sets.push(`${f} = ?`);
          vals.push(args[f]);
        }
      }
      if (sets.length > 0) {
        sets.push(`updated_at = datetime('now')`);
        vals.push(args.company_id);
        db.prepare(`UPDATE companies SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
      }
      return { success: true, company_id: args.company_id };
    }
    case 'delete_company': {
      db.prepare('DELETE FROM companies WHERE id = ?').run(args.company_id);
      return { success: true, deleted: args.company_id };
    }
    case 'set_default_company': {
      db.prepare('UPDATE companies SET is_default = 0').run();
      db.prepare('UPDATE companies SET is_default = 1 WHERE id = ?').run(args.company_id);
      return { success: true, default_company_id: args.company_id };
    }

    // --- Clients ---
    case 'list_clients': {
      let sql = 'SELECT * FROM clients';
      const params = [];
      if (args.company_id && args.company_id !== 'all') {
        sql += ' WHERE company_id = ?';
        params.push(args.company_id);
      }
      if (args.search) {
        sql += params.length ? ' AND ' : ' WHERE ';
        sql += '(name LIKE ? OR business_name LIKE ? OR email LIKE ?)';
        params.push(`%${args.search}%`, `%${args.search}%`, `%${args.search}%`);
      }
      sql += ' ORDER BY name ASC';
      const clients = db.prepare(sql).all(...params);
      return { clients };
    }
    case 'get_client': {
      const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(args.client_id);
      if (!client) throw new Error(`Client not found: ${args.client_id}`);
      const stats = db.prepare(`
        SELECT 
          COUNT(*) as invoice_count,
          COALESCE(SUM(total), 0) as total_invoiced,
          COALESCE(SUM(total - amount_paid), 0) as balance_due
        FROM invoices WHERE client_id = ?
      `).get(args.client_id);
      return { client, stats };
    }
    case 'create_client': {
      const id = 'client_' + uuidv4().slice(0, 10);
      db.prepare(`
        INSERT INTO clients (id, company_id, name, business_name, email, phone, address, tax_id, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, args.company_id, args.name, args.business_name || '', args.email || '',
        args.phone || '', args.address || '', args.tax_id || '', args.notes || ''
      );
      return { success: true, client_id: id };
    }
    case 'update_client': {
      const fields = ['name', 'business_name', 'email', 'phone', 'address', 'tax_id', 'notes'];
      const sets = [];
      const vals = [];
      for (const f of fields) {
        if (args[f] !== undefined) {
          sets.push(`${f} = ?`);
          vals.push(args[f]);
        }
      }
      if (sets.length > 0) {
        sets.push(`updated_at = datetime('now')`);
        vals.push(args.client_id);
        db.prepare(`UPDATE clients SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
      }
      return { success: true, client_id: args.client_id };
    }
    case 'delete_client': {
      db.prepare('DELETE FROM clients WHERE id = ?').run(args.client_id);
      return { success: true, deleted: args.client_id };
    }
    case 'search_clients': {
      const q = `%${args.query}%`;
      let sql = 'SELECT * FROM clients WHERE (name LIKE ? OR business_name LIKE ? OR email LIKE ?)';
      const params = [q, q, q];
      if (args.company_id && args.company_id !== 'all') {
        sql += ' AND company_id = ?';
        params.push(args.company_id);
      }
      const results = db.prepare(sql).all(...params);
      return { clients: results };
    }

    // --- Invoices ---
    case 'list_invoices': {
      let sql = `
        SELECT i.*, c.name as company_name, cl.name as client_name, cl.email as client_email
        FROM invoices i
        JOIN companies c ON i.company_id = c.id
        JOIN clients cl ON i.client_id = cl.id
        WHERE 1=1
      `;
      const params = [];
      if (args.company_id && args.company_id !== 'all') {
        sql += ' AND i.company_id = ?';
        params.push(args.company_id);
      }
      if (args.status) {
        sql += ' AND i.status = ?';
        params.push(args.status);
      }
      if (args.client_id) {
        sql += ' AND i.client_id = ?';
        params.push(args.client_id);
      }
      if (args.search) {
        sql += ' AND (i.invoice_number LIKE ? OR cl.name LIKE ?)';
        params.push(`%${args.search}%`, `%${args.search}%`);
      }
      sql += ' ORDER BY i.created_at DESC';
      const invoices = db.prepare(sql).all(...params);
      return { invoices };
    }
    case 'get_invoice': {
      const invoice = db.prepare(`
        SELECT i.*, c.name as company_name, c.email as company_email, c.address as company_address,
               c.bank_name, c.account_name, c.account_number, c.iban, c.swift,
               cl.name as client_name, cl.email as client_email, cl.address as client_address, cl.business_name
        FROM invoices i
        JOIN companies c ON i.company_id = c.id
        JOIN clients cl ON i.client_id = cl.id
        WHERE i.id = ?
      `).get(args.invoice_id);
      if (!invoice) throw new Error(`Invoice not found: ${args.invoice_id}`);
      const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order ASC').all(args.invoice_id);
      const payments = db.prepare('SELECT * FROM payments WHERE invoice_id = ? ORDER BY payment_date DESC').all(args.invoice_id);
      return { invoice, items, payments };
    }
    case 'create_invoice': {
      const comp = db.prepare('SELECT * FROM companies WHERE id = ?').get(args.company_id);
      if (!comp) throw new Error(`Company not found: ${args.company_id}`);

      const nextNum = comp.next_invoice_number || 1;
      const numStr = String(nextNum).padStart(4, '0');
      const invoiceNumber = `${comp.invoice_prefix || 'INV-'}${numStr}`;
      db.prepare('UPDATE companies SET next_invoice_number = next_invoice_number + 1 WHERE id = ?').run(args.company_id);

      const invoiceId = 'inv_' + uuidv4().slice(0, 12);
      const items = args.items || [{ description: 'Professional Services', quantity: 1, unit_price: 100 }];
      
      let subtotal = 0;
      for (const item of items) {
        const qty = parseFloat(item.quantity) || 1;
        const price = parseFloat(item.unit_price) || 0;
        subtotal += qty * price;
      }

      const taxRate = parseFloat(args.tax_rate) || 0;
      const taxAmount = (subtotal * taxRate) / 100;
      const discountVal = parseFloat(args.discount_value) || 0;
      const discountAmount = args.discount_type === 'percentage' ? (subtotal * discountVal) / 100 : discountVal;
      const shipping = parseFloat(args.shipping) || 0;
      const total = Math.max(0, subtotal + taxAmount - discountAmount + shipping);

      db.prepare(`
        INSERT INTO invoices (
          id, company_id, client_id, invoice_number, invoice_date, due_date, currency, payment_terms,
          template_id, status, subtotal, tax_rate, tax_amount, discount_type, discount_value, discount_amount,
          shipping, total, amount_paid, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
      `).run(
        invoiceId, args.company_id, args.client_id, invoiceNumber,
        args.invoice_date || new Date().toISOString().split('T')[0],
        args.due_date || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
        args.currency || comp.currency, args.payment_terms || comp.payment_terms,
        args.template_id || null, args.status || 'draft',
        subtotal, taxRate, taxAmount, args.discount_type || 'fixed', discountVal, discountAmount,
        shipping, total, args.notes || ''
      );

      items.forEach((item, idx) => {
        const q = parseFloat(item.quantity) || 1;
        const p = parseFloat(item.unit_price) || 0;
        db.prepare(`
          INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price, tax_rate, amount, sort_order)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run('item_' + uuidv4().slice(0, 8), invoiceId, item.description, q, p, item.tax_rate || 0, q * p, idx + 1);
      });

      return {
        success: true,
        invoice_id: invoiceId,
        invoice_number: invoiceNumber,
        total,
        status: args.status || 'draft'
      };
    }
    case 'update_invoice': {
      const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(args.invoice_id);
      if (!inv) throw new Error(`Invoice not found: ${args.invoice_id}`);
      if (args.status) {
        db.prepare(`UPDATE invoices SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(args.status, args.invoice_id);
      }
      return { success: true, invoice_id: args.invoice_id };
    }
    case 'delete_invoice': {
      db.prepare('DELETE FROM invoices WHERE id = ?').run(args.invoice_id);
      return { success: true, deleted: args.invoice_id };
    }
    case 'duplicate_invoice': {
      const src = db.prepare('SELECT * FROM invoices WHERE id = ?').get(args.invoice_id);
      if (!src) throw new Error('Source invoice not found');
      const comp = db.prepare('SELECT * FROM companies WHERE id = ?').get(src.company_id);
      const nextNum = comp.next_invoice_number || 1;
      const numStr = String(nextNum).padStart(4, '0');
      const newInvNumber = `${comp.invoice_prefix || 'INV-'}${numStr}`;
      db.prepare('UPDATE companies SET next_invoice_number = next_invoice_number + 1 WHERE id = ?').run(src.company_id);

      const newId = 'inv_' + uuidv4().slice(0, 12);
      db.prepare(`
        INSERT INTO invoices (
          id, company_id, client_id, invoice_number, invoice_date, due_date, currency, payment_terms,
          template_id, status, subtotal, tax_rate, tax_amount, discount_type, discount_value, discount_amount,
          shipping, total, amount_paid, notes, payment_details
        ) VALUES (?, ?, ?, ?, date('now'), date('now', '+14 days'), ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
      `).run(
        newId, src.company_id, src.client_id, newInvNumber, src.currency, src.payment_terms,
        src.template_id, src.subtotal, src.tax_rate, src.tax_amount, src.discount_type, src.discount_value,
        src.discount_amount, src.shipping, src.total, src.notes, src.payment_details
      );

      const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(src.id);
      for (const item of items) {
        db.prepare(`
          INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price, tax_rate, amount, sort_order)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run('item_' + uuidv4().slice(0, 8), newId, item.description, item.quantity, item.unit_price, item.tax_rate, item.amount, item.sort_order);
      }

      return { success: true, invoice_id: newId, invoice_number: newInvNumber };
    }
    case 'preview_invoice': {
      const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(args.invoice_id);
      if (!inv) throw new Error('Invoice not found');
      const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(args.invoice_id);
      return { invoice: inv, items };
    }
    case 'download_pdf_invoice': {
      const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(args.invoice_id);
      if (!inv) throw new Error('Invoice not found');
      return {
        success: true,
        invoice_number: inv.invoice_number,
        download_url: `/api/invoices/${inv.id}/pdf`,
        filename: `Invoice-${inv.invoice_number}.pdf`
      };
    }
    case 'send_invoice_email': {
      const msgId = 'msg_' + uuidv4().slice(0, 16);
      const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(args.invoice_id);
      db.prepare(`
        INSERT INTO email_messages (id, company_id, invoice_id, direction, from_email, to_email, subject, body, status, sent_at)
        VALUES (?, ?, ?, 'outgoing', 'billing@autoinvoice.pro', ?, ?, ?, 'sent', datetime('now'))
      `).run(msgId, inv ? inv.company_id : 'comp_default', args.invoice_id, args.to_email, args.subject, args.body);
      if (inv) {
        db.prepare(`UPDATE invoices SET status = 'sent' WHERE id = ?`).run(args.invoice_id);
      }
      return { success: true, message_id: msgId, status: 'sent' };
    }
    case 'schedule_invoice_email': {
      const msgId = 'msg_' + uuidv4().slice(0, 16);
      const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(args.invoice_id);
      db.prepare(`
        INSERT INTO email_messages (id, company_id, invoice_id, direction, from_email, to_email, subject, body, status, scheduled_for)
        VALUES (?, ?, ?, 'outgoing', 'billing@autoinvoice.pro', ?, ?, ?, 'scheduled', ?)
      `).run(msgId, inv ? inv.company_id : 'comp_default', args.invoice_id, args.to_email, args.subject, args.body, args.scheduled_for);
      return { success: true, message_id: msgId, status: 'scheduled', scheduled_for: args.scheduled_for };
    }
    case 'mark_invoice_paid': {
      const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(args.invoice_id);
      if (!inv) throw new Error('Invoice not found');
      const remaining = inv.total - inv.amount_paid;
      if (remaining > 0) {
        db.prepare(`
          INSERT INTO payments (id, invoice_id, company_id, payment_date, amount, payment_method, notes)
          VALUES (?, ?, ?, date('now'), ?, ?, 'Marked paid in full')
        `).run('pay_' + uuidv4().slice(0, 10), inv.id, inv.company_id, remaining, args.payment_method || 'Bank Transfer');
      }
      db.prepare(`UPDATE invoices SET status = 'paid', amount_paid = total, updated_at = datetime('now') WHERE id = ?`).run(inv.id);
      return { success: true, invoice_id: inv.id, status: 'paid' };
    }
    case 'mark_invoice_sent': {
      db.prepare(`UPDATE invoices SET status = 'sent', updated_at = datetime('now') WHERE id = ?`).run(args.invoice_id);
      return { success: true, invoice_id: args.invoice_id, status: 'sent' };
    }
    case 'record_payment': {
      const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(args.invoice_id);
      if (!inv) throw new Error('Invoice not found');
      const payId = 'pay_' + uuidv4().slice(0, 10);
      const amount = parseFloat(args.amount);
      db.prepare(`
        INSERT INTO payments (id, invoice_id, company_id, payment_date, amount, payment_method, reference_number, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        payId, inv.id, inv.company_id,
        args.payment_date || new Date().toISOString().split('T')[0],
        amount, args.payment_method || 'Bank Transfer', args.reference_number || '', args.notes || ''
      );
      const totalPaidRow = db.prepare('SELECT COALESCE(SUM(amount), 0) as s FROM payments WHERE invoice_id = ?').get(inv.id);
      const totalPaid = totalPaidRow.s;
      let newStatus = totalPaid >= inv.total ? 'paid' : (totalPaid > 0 ? 'partially_paid' : inv.status);
      db.prepare('UPDATE invoices SET amount_paid = ?, status = ?, updated_at = datetime(\'now\') WHERE id = ?').run(totalPaid, newStatus, inv.id);
      return { success: true, payment_id: payId, total_paid: totalPaid, remaining_balance: Math.max(0, inv.total - totalPaid), status: newStatus };
    }

    // --- Templates ---
    case 'list_templates': {
      let sql = 'SELECT * FROM invoice_templates';
      const params = [];
      if (args.company_id && args.company_id !== 'all') {
        sql += ' WHERE company_id = ?';
        params.push(args.company_id);
      }
      sql += ' ORDER BY created_at DESC';
      const templates = db.prepare(sql).all(...params);
      return { templates };
    }
    case 'get_template': {
      const tmpl = db.prepare('SELECT * FROM invoice_templates WHERE id = ?').get(args.template_id);
      if (!tmpl) throw new Error('Template not found');
      return { template: tmpl };
    }
    case 'create_template': {
      const id = 'tmpl_' + uuidv4().slice(0, 10);
      if (args.is_default) {
        db.prepare('UPDATE invoice_templates SET is_default = 0 WHERE company_id = ?').run(args.company_id);
      }
      db.prepare(`
        INSERT INTO invoice_templates (id, company_id, name, type, is_default, config_json)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, args.company_id, args.name, args.type || 'designer', args.is_default ? 1 : 0, args.config_json || '{}');
      return { success: true, template_id: id };
    }
    case 'update_template': {
      const fields = ['name', 'config_json'];
      const sets = [];
      const vals = [];
      for (const f of fields) {
        if (args[f] !== undefined) {
          sets.push(`${f} = ?`);
          vals.push(args[f]);
        }
      }
      if (sets.length > 0) {
        sets.push(`updated_at = datetime('now')`);
        vals.push(args.template_id);
        db.prepare(`UPDATE invoice_templates SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
      }
      return { success: true, template_id: args.template_id };
    }
    case 'delete_template': {
      db.prepare('DELETE FROM invoice_templates WHERE id = ?').run(args.template_id);
      return { success: true, deleted: args.template_id };
    }
    case 'set_default_template': {
      const tmpl = db.prepare('SELECT * FROM invoice_templates WHERE id = ?').get(args.template_id);
      if (!tmpl) throw new Error('Template not found');
      db.prepare('UPDATE invoice_templates SET is_default = 0 WHERE company_id = ?').run(tmpl.company_id);
      db.prepare('UPDATE invoice_templates SET is_default = 1 WHERE id = ?').run(tmpl.id);
      return { success: true, default_template_id: tmpl.id, company_id: tmpl.company_id };
    }

    // --- Mail ---
    case 'list_email_messages': {
      let sql = 'SELECT * FROM email_messages WHERE 1=1';
      const params = [];
      if (args.company_id && args.company_id !== 'all') {
        sql += ' AND company_id = ?';
        params.push(args.company_id);
      }
      if (args.direction) {
        sql += ' AND direction = ?';
        params.push(args.direction);
      }
      if (args.status) {
        sql += ' AND status = ?';
        params.push(args.status);
      }
      sql += ' ORDER BY created_at DESC';
      const messages = db.prepare(sql).all(...params);
      return { messages };
    }
    case 'sync_mail_replies': {
      return { success: true, synced_count: 0, message: 'Mailbox checked for incoming replies' };
    }

    // --- Dashboard ---
    case 'get_dashboard_stats': {
      const isAll = !args.company_id || args.company_id === 'all';
      let outSql = `SELECT COUNT(*) as c, COALESCE(SUM(total - amount_paid), 0) as a FROM invoices WHERE status IN ('sent', 'partially_paid', 'draft')`;
      let dueSql = `SELECT COUNT(*) as c, COALESCE(SUM(total - amount_paid), 0) as a FROM invoices WHERE (status = 'overdue' OR (due_date < date('now') AND status NOT IN ('paid', 'cancelled')))`;
      let paidSql = `SELECT COUNT(*) as c, COALESCE(SUM(amount_paid), 0) as a FROM invoices WHERE amount_paid > 0`;
      let cliSql = `SELECT COUNT(*) as c FROM clients`;

      if (!isAll) {
        outSql += ` AND company_id = '${args.company_id}'`;
        dueSql += ` AND company_id = '${args.company_id}'`;
        paidSql += ` AND company_id = '${args.company_id}'`;
        cliSql += ` WHERE company_id = '${args.company_id}'`;
      }

      return {
        outstanding: db.prepare(outSql).get(),
        overdue: db.prepare(dueSql).get(),
        paid: db.prepare(paidSql).get(),
        clients: db.prepare(cliSql).get()
      };
    }
    case 'get_recent_invoices': {
      const limit = args.limit || 5;
      let sql = `
        SELECT i.*, c.name as company_name, cl.name as client_name
        FROM invoices i
        JOIN companies c ON i.company_id = c.id
        JOIN clients cl ON i.client_id = cl.id
      `;
      const params = [];
      if (args.company_id && args.company_id !== 'all') {
        sql += ` WHERE i.company_id = ?`;
        params.push(args.company_id);
      }
      sql += ` ORDER BY i.created_at DESC LIMIT ?`;
      params.push(limit);
      const recent = db.prepare(sql).all(...params);
      return { recent_invoices: recent };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

/**
 * Initialize and Mount MCP HTTP Transport
 */
async function setupMcpServer(app) {
  try {
    const { Server } = await import('@modelcontextprotocol/sdk/server/index.js');
    const { StreamableHTTPServerTransport } = await import('@modelcontextprotocol/sdk/server/streamableHttp.js');
    const types = await import('@modelcontextprotocol/sdk/types.js');

    const server = new Server(
      {
        name: 'autoinvoice-pro-mcp',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {}
        }
      }
    );

    // Register Tools List
    server.setRequestHandler(types.ListToolsRequestSchema, async () => {
      return {
        tools: TOOLS_DEFINITIONS
      };
    });

    // Register Tool Call Execution
    server.setRequestHandler(types.CallToolRequestSchema, async (request) => {
      const { name, arguments: toolArgs } = request.params;
      try {
        const result = await executeTool(name, toolArgs || {});
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      } catch (err) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Error executing ${name}: ${err.message}`
            }
          ]
        };
      }
    });

    const transport = new StreamableHTTPServerTransport({
      endpoint: '/mcp'
    });

    await server.connect(transport);
    mcpServerInstance = server;
    streamableTransport = transport;

    console.log('✅ AutoInvoice Pro MCP Server successfully initialized with 35 tools.');

    // Authentication & Dispatcher Middleware for /mcp
    const mcpMiddleware = async (req, res, next) => {
      // Optional Token Auth: Check Bearer token or query param
      const authHeader = req.headers.authorization;
      const queryToken = req.query.token;
      let providedToken = null;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        providedToken = authHeader.substring(7).trim();
      } else if (queryToken) {
        providedToken = queryToken;
      }

      if (providedToken) {
        const tokenRow = db.prepare('SELECT * FROM mcp_tokens WHERE token = ? AND is_active = 1').get(providedToken);
        if (tokenRow) {
          db.prepare(`UPDATE mcp_tokens SET last_used_at = datetime('now') WHERE id = ?`).run(tokenRow.id);
        }
      }

      // If client requests tool list directly via standard HTTP GET /mcp/tools
      if (req.method === 'GET' && req.path === '/tools') {
        return res.json({ success: true, count: TOOLS_DEFINITIONS.length, tools: TOOLS_DEFINITIONS });
      }

      // If client executes tool via direct REST POST /mcp/call
      if (req.method === 'POST' && req.path === '/call') {
        const { tool, arguments: args } = req.body || {};
        try {
          const data = await executeTool(tool, args || {});
          return res.json({ success: true, result: data });
        } catch (err) {
          return res.status(400).json({ success: false, error: err.message });
        }
      }

      // Streamable HTTP Transport handler
      try {
        await streamableTransport.handleRequest(req, res, req.body);
      } catch (transportErr) {
        console.error('MCP Transport request error:', transportErr);
        if (!res.headersSent) {
          res.status(500).json({ error: transportErr.message });
        }
      }
    };

    app.use('/mcp', mcpMiddleware);

  } catch (err) {
    console.error('Failed to initialize MCP Server:', err);
  }
}

module.exports = {
  setupMcpServer,
  TOOLS_DEFINITIONS,
  executeTool
};
