/**
 * Persistent SQLite Database Engine for AutoInvoice Pro
 * Powered by Node.js 22 built-in node:sqlite DatabaseSync
 */
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'autoinvoice.db');

// Ensure database file directory exists
const db = new DatabaseSync(DB_PATH);

// Enable Foreign Keys & WAL mode for high concurrency
db.exec('PRAGMA foreign_keys = ON;');

/**
 * Initialize Database Schema
 */
function initDatabase() {
  db.exec(`
    -- Companies Table
    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      logo TEXT DEFAULT '',
      address TEXT DEFAULT '',
      email TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      website TEXT DEFAULT '',
      tax_id TEXT DEFAULT '',
      bank_name TEXT DEFAULT '',
      account_name TEXT DEFAULT '',
      account_number TEXT DEFAULT '',
      iban TEXT DEFAULT '',
      swift TEXT DEFAULT '',
      currency TEXT DEFAULT 'USD',
      invoice_prefix TEXT DEFAULT 'INV-',
      next_invoice_number INTEGER DEFAULT 1,
      payment_terms TEXT DEFAULT 'Net 14',
      is_archived INTEGER DEFAULT 0,
      is_default INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Clients Table
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      name TEXT NOT NULL,
      business_name TEXT DEFAULT '',
      email TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      address TEXT DEFAULT '',
      tax_id TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    );

    -- Invoice Templates Table
    CREATE TABLE IF NOT EXISTS invoice_templates (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT DEFAULT 'designer', -- 'designer', 'pdf_upload', 'preset'
      is_default INTEGER DEFAULT 0,
      config_json TEXT DEFAULT '{}',
      bg_image_url TEXT DEFAULT '',
      pdf_file_path TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    );

    -- Invoices Table
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      client_id TEXT NOT NULL,
      invoice_number TEXT NOT NULL,
      invoice_date TEXT NOT NULL,
      due_date TEXT NOT NULL,
      currency TEXT DEFAULT 'USD',
      payment_terms TEXT DEFAULT 'Net 14',
      template_id TEXT,
      status TEXT DEFAULT 'draft', -- 'draft', 'sent', 'paid', 'partially_paid', 'overdue', 'cancelled'
      subtotal REAL DEFAULT 0,
      tax_rate REAL DEFAULT 0,
      tax_amount REAL DEFAULT 0,
      discount_type TEXT DEFAULT 'fixed',
      discount_value REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      shipping REAL DEFAULT 0,
      total REAL DEFAULT 0,
      amount_paid REAL DEFAULT 0,
      notes TEXT DEFAULT '',
      payment_details TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
    );

    -- Invoice Line Items Table
    CREATE TABLE IF NOT EXISTS invoice_items (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL,
      description TEXT NOT NULL,
      quantity REAL DEFAULT 1,
      unit_price REAL DEFAULT 0,
      tax_rate REAL DEFAULT 0,
      amount REAL DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
    );

    -- Payments Table
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL,
      company_id TEXT NOT NULL,
      payment_date TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_method TEXT DEFAULT 'Bank Transfer',
      reference_number TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    );

    -- Email Accounts Table
    CREATE TABLE IF NOT EXISTS email_accounts (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      provider TEXT DEFAULT 'smtp', -- 'smtp', 'gmail', 'hostinger'
      host TEXT DEFAULT '',
      port INTEGER DEFAULT 587,
      secure INTEGER DEFAULT 0,
      username TEXT DEFAULT '',
      password TEXT DEFAULT '',
      from_email TEXT DEFAULT '',
      from_name TEXT DEFAULT '',
      imap_host TEXT DEFAULT '',
      imap_port INTEGER DEFAULT 993,
      imap_secure INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    );

    -- Email Messages & Scheduled Queue Table
    CREATE TABLE IF NOT EXISTS email_messages (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      invoice_id TEXT,
      direction TEXT DEFAULT 'outgoing', -- 'outgoing', 'incoming'
      from_email TEXT NOT NULL,
      to_email TEXT NOT NULL,
      cc TEXT DEFAULT '',
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      status TEXT DEFAULT 'sent', -- 'draft', 'scheduled', 'sent', 'failed'
      sent_at TEXT,
      scheduled_for TEXT,
      message_id TEXT DEFAULT '',
      in_reply_to TEXT DEFAULT '',
      error_message TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    );

    -- Referrals Table
    CREATE TABLE IF NOT EXISTS referrals (
      id TEXT PRIMARY KEY,
      referrer_name TEXT NOT NULL,
      referral_code TEXT NOT NULL,
      client_email TEXT DEFAULT '',
      status TEXT DEFAULT 'pending', -- 'pending', 'active', 'rewarded'
      commission_rate REAL DEFAULT 15.0,
      reward_amount REAL DEFAULT 0.0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- MCP Tokens Table
    CREATE TABLE IF NOT EXISTS mcp_tokens (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      permissions TEXT DEFAULT 'full',
      last_used_at TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Audit Logs Table
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      company_id TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      details TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Seed default data if database is fresh
  seedInitialData();
}

/**
 * Seed sample multi-company SaaS data matching Invco references
 */
function seedInitialData() {
  const companyCheck = db.prepare('SELECT COUNT(*) as count FROM companies').get();
  if (companyCheck.count > 0) return; // Already seeded

  console.log('Seeding initial AutoInvoice Pro SaaS data...');

  const { v4: uuidv4 } = require('uuid');

  // 1. Primary Company: Saad Solutions
  const compSaadId = 'comp_saad_solutions';
  const compNexaId = 'comp_nexa_digital';
  const compVortexId = 'comp_vortex_ecom';
  const compEcomId = 'comp_ecom_integration';
  const compDasiramId = 'comp_dasiram_sweets';

  db.prepare(`
    INSERT INTO companies (
      id, name, logo, address, email, phone, website, tax_id, 
      bank_name, account_name, account_number, iban, swift, 
      currency, invoice_prefix, next_invoice_number, payment_terms, is_default
    ) VALUES 
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    // Saad Solutions
    compSaadId, 'Saad Solutions', '', '123 Studio Lane, London\nUnited Kingdom', 'saad.digiaura360@gmail.com', '+44 20 7946 0912', 'https://have.digital', 'GB-VAT-982314', 
    'First National Bank', 'Saad Solutions Ltd', '6016 1331 9268 19', 'GB29 NWBK 6016 1331 9268 19', 'NWBKGB2L', 
    'GBP', 'SV-', 3, 'Net 14', 1,

    // Nexa Digital
    compNexaId, 'Nexa Digital', '', '500 Innovation Way, Suite 400\nSeattle, WA 98101', 'billing@nexadigital.io', '+1 (555) 234-8890', 'https://nexadigital.io', 'US-EIN-4491029', 
    'Silicon Valley Bank', 'Nexa Digital Inc.', '9921-4819-2041', 'US44 SVBK 9921 4819 2041', 'SVBKUS6S', 
    'USD', 'NX-', 101, 'Net 30', 0,

    // Vortex E-Com Systems
    compVortexId, 'Vortex E-Com Systems', '', '77 Rue de la Paix\n75002 Paris, France', 'finance@vortexecom.eu', '+33 1 42 68 55 20', 'https://vortexecom.eu', 'FR-TVA-8819201', 
    'BNP Paribas', 'Vortex Systems SAS', '8810-9921-3310', 'FR76 3000 6000 0112 3456 7890 189', 'BNPAFR2P', 
    'EUR', 'VX-', 14, 'Net 14', 0,

    // E-commerce integration
    compEcomId, 'E-commerce integration', '', '34 Market Street\nManchester, M1 1PW', 'contact@ecomintegration.co.uk', '+44 161 829 1000', '', 'GB-VAT-119283',
    'Barclays Bank', 'E-commerce Integration Co', '1002-3991-22', 'GB33 BARK 1002 3991 22', 'BARCGB22',
    'GBP', 'EC-', 5, 'Net 7', 0,

    // Dasiram Sweets
    compDasiramId, 'Dasiram Sweets', '', '42 Heritage Bazaar\nLahore, Punjab', 'orders@dasiramsweets.com', '+92 42 3589 1234', '', 'PK-NTN-7782190',
    'Habib Bank Ltd', 'Dasiram Sweets & Bakers', '0019-4829-1092', 'PK36 HABB 0019 4829 1092 01', 'HABBPKKA',
    'PKR', 'DS-', 21, 'Due on Receipt', 0
  );

  // 2. Clients for Saad Solutions
  const clientApexId = 'client_apex_digital';
  const clientCrescentId = 'client_crescent_tech';
  const clientAcmeId = 'client_acme_corp';

  db.prepare(`
    INSERT INTO clients (id, company_id, name, business_name, email, phone, address, tax_id, notes)
    VALUES 
    (?, ?, ?, ?, ?, ?, ?, ?, ?),
    (?, ?, ?, ?, ?, ?, ?, ?, ?),
    (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    clientApexId, compSaadId, 'Apex Digital Media Ltd', 'Apex Digital Media Ltd', 'client@example.com', '+44 161 496 0192', '45 Deansgate, City Centre, Manchester, M3 2AY', 'GB-VAT-4491028', 'Key enterprise partner for microservices rollout',
    clientCrescentId, compSaadId, 'Crescent Tech Enterprises Ltd', 'Crescent Tech Ltd', 'finance@crescenttech.co.uk', '+44 20 8941 2200', '10 Finsbury Square, London, EC2A 1AF', 'GB-VAT-9021882', 'Annual software support retainer',
    clientAcmeId, compSaadId, 'Acme Corporation', 'Acme Global Corp', 'jane@acme.example', '+1 (555) 981-2299', '1 Acme Plaza, London, EC1V 2NX', 'GB-VAT-7719280', 'Custom web application contract'
  );

  // Client for Nexa Digital
  db.prepare(`
    INSERT INTO clients (id, company_id, name, business_name, email, phone, address, tax_id, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'client_quantum_ent', compNexaId, 'Quantum Enterprises', 'Quantum Ent Inc', 'procurement@quantumenterprises.com', '+1 (555) 441-9023', '800 Market St, San Francisco, CA 94102', 'US-EIN-99210', 'Full stack cloud infrastructure migration'
  );

  // 3. Invoice Templates for Saad Solutions
  const tmplGradientId = 'tmpl_saad_gradient';
  const tmplClassicId = 'tmpl_saad_classic';
  const tmplModernId = 'tmpl_saad_modern';
  const tmplMinimalId = 'tmpl_saad_minimal';

  // Gradient template config with canvas elements
  const gradientConfig = JSON.stringify({
    page: { width: 794, height: 1123, background: '#ffffff' },
    elements: [
      { id: 'el_header_grad', type: 'box', x: 40, y: 115, width: 714, height: 4, background: 'linear-gradient(90deg, #0284c7 0%, #10b981 50%, #f59e0b 100%)', border: 'none', radius: 2, zIndex: 1 },
      { id: 'el_company_badge', type: 'box', x: 40, y: 50, width: 44, height: 44, background: '#0e7490', border: 'none', radius: 10, zIndex: 2 },
      { id: 'el_company_initial', type: 'text', x: 53, y: 58, width: 20, height: 26, content: 'S', fontSize: 24, fontWeight: '800', color: '#ffffff', zIndex: 3 },
      { id: 'el_company_name', type: 'text', x: 95, y: 58, width: 280, height: 28, content: 'SAAD SOLUTIONS', fontSize: 22, fontWeight: '900', color: '#0f172a', letterSpacing: '0.04em', zIndex: 2 },
      { id: 'el_company_address', type: 'text', x: 500, y: 50, width: 254, height: 40, content: '123 Studio Lane, London\nyou@have.digital', fontSize: 11, color: '#475569', textAlign: 'right', zIndex: 2 },
      { id: 'el_inv_title', type: 'text', x: 480, y: 135, width: 274, height: 45, content: 'INVOICE', fontSize: 32, fontWeight: '900', color: '#0f172a', textAlign: 'right', zIndex: 2 },
      { id: 'el_bill_to_label', type: 'text', x: 40, y: 185, width: 200, height: 16, content: 'BILL TO', fontSize: 10, fontWeight: '800', color: '#0e7490', letterSpacing: '0.08em', zIndex: 2 },
      { id: 'el_bill_to_content', type: 'field', fieldType: 'client_details', x: 40, y: 205, width: 260, height: 75, fontSize: 12, color: '#1e293b', zIndex: 2 },
      { id: 'el_inv_meta', type: 'field', fieldType: 'invoice_meta', x: 480, y: 185, width: 274, height: 95, fontSize: 12, color: '#1e293b', zIndex: 2 },
      { id: 'el_items_table', type: 'items_table', x: 40, y: 310, width: 714, height: 220, headerBg: '#0e7490', headerColor: '#ffffff', alternateRowBg: '#f8fafc', zIndex: 2 },
      { id: 'el_totals_box', type: 'totals', x: 460, y: 550, width: 294, height: 130, zIndex: 2 },
      { id: 'el_bank_box', type: 'box', x: 40, y: 550, width: 380, height: 120, background: '#f8fafc', border: '1px solid #e2e8f0', radius: 8, zIndex: 1 },
      { id: 'el_bank_title', type: 'text', x: 55, y: 565, width: 350, height: 18, content: 'PAYMENT DETAILS', fontSize: 10, fontWeight: '800', color: '#0e7490', zIndex: 2 },
      { id: 'el_bank_content', type: 'field', fieldType: 'bank_details', x: 55, y: 588, width: 350, height: 70, fontSize: 11, color: '#475569', zIndex: 2 },
      { id: 'el_notes', type: 'field', fieldType: 'notes', x: 40, y: 700, width: 714, height: 50, fontSize: 11, color: '#64748b', zIndex: 2 },
      { id: 'el_footer_line', type: 'line', x: 40, y: 1050, width: 714, height: 1, color: '#e2e8f0', zIndex: 1 },
      { id: 'el_footer_text', type: 'text', x: 40, y: 1065, width: 714, height: 20, content: 'Thank you for your business. For questions, contact saad.digiaura360@gmail.com', fontSize: 10, color: '#94a3b8', textAlign: 'center', zIndex: 2 }
    ]
  });

  db.prepare(`
    INSERT INTO invoice_templates (id, company_id, name, type, is_default, config_json)
    VALUES 
    (?, ?, ?, ?, ?, ?),
    (?, ?, ?, ?, ?, ?),
    (?, ?, ?, ?, ?, ?),
    (?, ?, ?, ?, ?, ?)
  `).run(
    tmplGradientId, compSaadId, 'Saad Solutions Gradient', 'designer', 1, gradientConfig,
    tmplClassicId, compSaadId, 'Classic', 'preset', 0, JSON.stringify({ style: 'classic' }),
    tmplModernId, compSaadId, 'Modern', 'preset', 0, JSON.stringify({ style: 'modern' }),
    tmplMinimalId, compSaadId, 'Minimal', 'preset', 0, JSON.stringify({ style: 'minimal' })
  );

  // 4. Invoices matching reference screenshots
  const inv2Id = 'inv_sv_0002';
  const inv1Id = 'inv_sv_0001';

  db.prepare(`
    INSERT INTO invoices (
      id, company_id, client_id, invoice_number, invoice_date, due_date, currency, 
      payment_terms, template_id, status, subtotal, tax_rate, tax_amount, 
      discount_type, discount_value, discount_amount, shipping, total, amount_paid, 
      notes, payment_details
    ) VALUES 
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    // SV-0002 (Draft - £11,520.00)
    inv2Id, compSaadId, clientApexId, 'SV-0002', '2026-08-24', '2026-09-07', 'GBP',
    'Net 14', tmplGradientId, 'draft', 9600.00, 20.0, 1920.00,
    'fixed', 0, 0, 0, 11520.00, 0,
    'Payment due within 14 days. Thank you for your partnership.',
    'Bank: First National Bank\nAccount: 6016 1331 9268 19\nIBAN: GB29 NWBK 6016 1331 9268 19\nSWIFT: NWBKGB2L',

    // SV-0001 (Sent - £9,360.00)
    inv1Id, compSaadId, clientCrescentId, 'SV-0001', '2026-08-10', '2026-08-24', 'GBP',
    'Net 14', tmplGradientId, 'sent', 7800.00, 20.0, 1560.00,
    'fixed', 0, 0, 0, 9360.00, 0,
    'Standard service agreement terms apply.',
    'Bank: First National Bank\nIBAN: GB29 NWBK 6016 1331 9268 19'
  );

  // Line Items for SV-0002 (from Screenshot 4)
  db.prepare(`
    INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price, tax_rate, amount, sort_order)
    VALUES 
    (?, ?, ?, ?, ?, ?, ?, ?),
    (?, ?, ?, ?, ?, ?, ?, ?),
    (?, ?, ?, ?, ?, ?, ?, ?),
    (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'item_1', inv2Id, 'Enterprise Microservices Backend Setup', 1, 5200.00, 20.0, 5200.00, 1,
    'item_2', inv2Id, 'Custom Invoice Automation & Webhook Integration', 1, 1800.00, 20.0, 1800.00, 2,
    'item_3', inv2Id, 'Redis Cache & Database Query Optimization', 1, 1100.00, 20.0, 1100.00, 3,
    'item_4', inv2Id, 'Post-Deployment Technical Support (3 Months)', 1, 1500.00, 20.0, 1500.00, 4
  );

  // Line items for SV-0001
  db.prepare(`
    INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price, tax_rate, amount, sort_order)
    VALUES 
    (?, ?, ?, ?, ?, ?, ?, ?),
    (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'item_5', inv1Id, 'Brand identity package & Guidelines', 1, 2400.00, 20.0, 2400.00, 1,
    'item_6', inv1Id, 'Design sprint (per week)', 3, 1800.00, 20.0, 5400.00, 2
  );

  // 5. Default Email Account for Saad Solutions
  db.prepare(`
    INSERT INTO email_accounts (
      id, company_id, provider, host, port, secure, username, password, from_email, from_name
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'email_saad_smtp', compSaadId, 'gmail', 'smtp.gmail.com', 587, 0,
    'saad.digiaura360@gmail.com', '', 'saad.digiaura360@gmail.com', 'Saad Solutions'
  );

  // 6. Default MCP Token
  db.prepare(`
    INSERT INTO mcp_tokens (id, name, token, permissions)
    VALUES (?, ?, ?, ?)
  `).run(
    'mcp_default_token', 'Default Production MCP Token', 'mcp_live_saad_8f93e1b047a2c89d71e54', 'full'
  );

  // 7. Initial Referrals
  db.prepare(`
    INSERT INTO referrals (id, referrer_name, referral_code, client_email, status, commission_rate, reward_amount)
    VALUES 
    (?, ?, ?, ?, ?, ?, ?),
    (?, ?, ?, ?, ?, ?, ?)
  `).run(
    'ref_1', 'Saad Khaliq', 'SAAD-VIP', 'client.partner@acme.com', 'active', 15.0, 150.00,
    'ref_2', 'Saad Khaliq', 'SAAD-VIP', 'tech@digiaura.io', 'rewarded', 15.0, 280.00
  );

  console.log('✅ AutoInvoice Pro database successfully seeded with multi-company sample data.');
}

// Auto-initialize schema when module loads
initDatabase();

module.exports = {
  db,
  initDatabase
};
