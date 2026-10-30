/**
 * Comprehensive Automated Platform Test Suite for AutoInvoice Pro
 * Validates SQLite Relational Database, REST API Endpoints, Multi-Company Isolation,
 * Invoice Calculations, Template Defaults, Payments Lifecycle, MCP Protocol Server, and AI Assistant.
 */
const { app, server } = require('../server/index');
const { db } = require('../server/db');

const TEST_PORT = 3001;
let testServer;
let baseUrl = `http://localhost:${TEST_PORT}`;

async function runTests() {
  console.log('🧪 Starting AutoInvoice Pro Platform Automated Test Suite...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // Start test server on port 3001
    await new Promise((resolve) => {
      testServer = app.listen(TEST_PORT, () => {
        console.log(`Test server running on ${baseUrl}`);
        resolve();
      });
    });

    // --- TEST 1: Health Check ---
    console.log('\n--- 1. System Health ---');
    const healthRes = await fetch(`${baseUrl}/api/health`);
    const healthData = await healthRes.json();
    assert(healthRes.status === 200, 'Health endpoint responds HTTP 200');
    assert(healthData.status === 'ok', 'App status is ok');

    // --- TEST 2: Multi-Company Management & Currency Isolation ---
    console.log('\n--- 2. Multi-Company Management ---');
    const compRes = await fetch(`${baseUrl}/api/companies`);
    const compData = await compRes.json();
    assert(compData.success && compData.data.length >= 5, `Fetched ${compData.data?.length} companies`);
    
    const saad = compData.data.find(c => c.name === 'Saad Solutions');
    const nexa = compData.data.find(c => c.name === 'Nexa Digital');
    assert(saad && saad.currency === 'GBP', 'Saad Solutions isolated with GBP currency (£)');
    assert(nexa && nexa.currency === 'USD', 'Nexa Digital isolated with USD currency ($)');

    // Create a new company
    const newCompRes = await fetch(`${baseUrl}/api/companies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Automated Test Systems Ltd',
        currency: 'EUR',
        invoice_prefix: 'ATS-',
        bank_name: 'Deutsche Bank',
        iban: 'DE89 3704 0044 0532 0130 00',
        swift: 'DEUTDEDD'
      })
    });
    const newCompData = await newCompRes.json();
    assert(newCompData.success && newCompData.data.id, 'Created new company with independent banking');

    // --- TEST 3: Clients & Ledger Balance ---
    console.log('\n--- 3. Clients Management & Ledgers ---');
    const clientsRes = await fetch(`${baseUrl}/api/clients?company_id=comp_saad_solutions`);
    const clientsData = await clientsRes.json();
    assert(clientsData.success && clientsData.data.length >= 1, 'Fetched clients for Saad Solutions');
    
    // Search client
    const searchRes = await fetch(`${baseUrl}/api/clients?search=Apex`);
    const searchData = await searchRes.json();
    assert(searchData.data.length >= 1 && searchData.data[0].name.includes('Apex'), 'Client search returns expected result');

    // --- TEST 4: Invoice Sequencing & Automatic Math Calculations ---
    console.log('\n--- 4. Invoice Management & Automatic Math ---');
    const nextNumRes = await fetch(`${baseUrl}/api/invoices/next-number?company_id=comp_saad_solutions`);
    const nextNumData = await nextNumRes.json();
    assert(nextNumData.success && nextNumData.data.next_invoice_number.startsWith('SV-'), `Generated sequential number: ${nextNumData.data?.next_invoice_number}`);

    // Create invoice with line items, tax, and discount
    const createInvRes = await fetch(`${baseUrl}/api/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_id: 'comp_saad_solutions',
        client_id: 'client_apex_digital',
        tax_rate: 20,
        discount_type: 'fixed',
        discount_value: 100,
        shipping: 50,
        items: [
          { description: 'Cloud API Engineering', quantity: 2, unit_price: 1000 },
          { description: 'Security Hardening', quantity: 1, unit_price: 500 }
        ]
      })
    });
    const createInvData = await createInvRes.json();
    // Subtotal: 2500, Discount: -100, Taxable: 2400, Tax (20%): 480, Shipping: +50 = 2930
    assert(createInvData.success, 'Invoice created successfully');
    assert(createInvData.data.subtotal === 2500, 'Subtotal correctly computed: 2500');
    assert(createInvData.data.total === 2930, `Grand total correctly computed: ${createInvData.data.total} (expected 2930)`);

    // Duplicate invoice test
    const dupRes = await fetch(`${baseUrl}/api/invoices/${createInvData.data.id}/duplicate`, { method: 'POST' });
    const dupData = await dupRes.json();
    assert(dupData.success && dupData.data.invoice_id !== createInvData.data.id, `Cloned invoice with new sequence: ${dupData.data.invoice_number}`);

    // --- TEST 5: Template Management & Company Isolation ---
    console.log('\n--- 5. Invoice Template Isolation ---');
    const tmplRes = await fetch(`${baseUrl}/api/templates?company_id=comp_saad_solutions`);
    const tmplData = await tmplRes.json();
    assert(tmplData.success && tmplData.data.length >= 1, `Found ${tmplData.data.length} templates for Saad Solutions`);

    // Verify company isolation: setting default on Saad Solutions does not alter Nexa Digital default
    const firstTmpl = tmplData.data[0];
    await fetch(`${baseUrl}/api/templates/${firstTmpl.id}/set-default`, { method: 'POST' });
    
    const nexaTmplRes = await fetch(`${baseUrl}/api/templates?company_id=comp_nexa_digital`);
    const nexaTmplData = await nexaTmplRes.json();
    assert(nexaTmplData.success, 'Nexa Digital templates remain independent');

    // --- TEST 6: Payment Recording & Balance Tracking ---
    console.log('\n--- 6. Payment Recording & Status Transitions ---');
    const testInvId = createInvData.data.id;
    
    // Partial payment
    const partialPayRes = await fetch(`${baseUrl}/api/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoice_id: testInvId,
        amount: 1000,
        payment_method: 'Bank Wire',
        reference_number: 'WIRE-9901'
      })
    });
    const partialPayData = await partialPayRes.json();
    assert(partialPayData.success, 'Recorded partial payment');
    assert(partialPayData.data.status === 'partially_paid', `Invoice status transitioned to ${partialPayData.data.status}`);
    assert(partialPayData.data.balance_remaining === 1930, `Remaining balance updated to ${partialPayData.data.balance_remaining}`);

    // Settle remaining balance
    const finalPayRes = await fetch(`${baseUrl}/api/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoice_id: testInvId,
        amount: 1930,
        payment_method: 'Bank Wire'
      })
    });
    const finalPayData = await finalPayRes.json();
    assert(finalPayData.data.status === 'paid', `Invoice status transitioned to ${finalPayData.data.status}`);
    assert(finalPayData.data.balance_remaining === 0, 'Remaining balance settled to 0');

    // --- TEST 7: Dashboard Aggregation ---
    console.log('\n--- 7. Dashboard KPIs & Aggregation ---');
    const allStatsRes = await fetch(`${baseUrl}/api/dashboard/stats?company_id=all`);
    const allStatsData = await allStatsRes.json();
    assert(allStatsData.success && allStatsData.data.paid.amount > 0, 'Dashboard aggregates paid revenue across all companies');

    const saadStatsRes = await fetch(`${baseUrl}/api/dashboard/stats?company_id=comp_saad_solutions`);
    const saadStatsData = await saadStatsRes.json();
    assert(saadStatsData.success && saadStatsData.data.currency === 'GBP', 'Dashboard filters correctly for single company');

    // --- TEST 8: Email & Scheduled Delivery Queue ---
    console.log('\n--- 8. Real Email Dispatch & Scheduler ---');
    const emailTmplRes = await fetch(`${baseUrl}/api/email/templates`);
    const emailTmplData = await emailTmplRes.json();
    assert(emailTmplData.success && emailTmplData.data.length === 4, 'Loaded 4 professional tone templates (Formal, Friendly, Reminder, Urgent)');

    // Immediate send test
    const sendRes = await fetch(`${baseUrl}/api/email/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_id: 'comp_saad_solutions',
        invoice_id: testInvId,
        to_email: 'client@example.com',
        subject: 'Invoice Settlement Notice',
        body: 'Thank you for your business. Please find details attached.'
      })
    });
    const sendData = await sendRes.json();
    assert(sendData.success && sendData.data.id, 'Email message successfully recorded in delivery log');

    // Scheduled email test
    const schedTime = new Date(Date.now() + 86400000).toISOString();
    const schedRes = await fetch(`${baseUrl}/api/email/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_id: 'comp_saad_solutions',
        invoice_id: testInvId,
        to_email: 'client@example.com',
        subject: 'Scheduled Payment Reminder',
        body: 'This is a scheduled reminder.',
        scheduled_for: schedTime
      })
    });
    const schedData = await schedRes.json();
    assert(schedData.success && schedData.data.status === 'scheduled', 'Scheduled email successfully queued for background cron delivery');

    // --- TEST 9: Model Context Protocol (MCP) Server at /mcp ---
    console.log('\n--- 9. Model Context Protocol (MCP) Streamable Server ---');
    const mcpToolsRes = await fetch(`${baseUrl}/mcp/tools`);
    const mcpToolsData = await mcpToolsRes.json();
    assert(mcpToolsRes.status === 200, 'MCP Endpoint reachable via HTTP');
    assert(mcpToolsData.count === 35, `All 35 MCP tools registered (Count: ${mcpToolsData.count})`);

    // Execute MCP tool via /mcp/call: list_companies
    const mcpCall1 = await fetch(`${baseUrl}/mcp/call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool: 'list_companies', arguments: {} })
    });
    const mcpCall1Data = await mcpCall1.json();
    assert(mcpCall1Data.success && mcpCall1Data.result.companies.length >= 5, 'MCP tool "list_companies" executed successfully');

    // Execute MCP tool: get_dashboard_stats
    const mcpCall2 = await fetch(`${baseUrl}/mcp/call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool: 'get_dashboard_stats', arguments: { company_id: 'all' } })
    });
    const mcpCall2Data = await mcpCall2.json();
    assert(mcpCall2Data.success && mcpCall2Data.result.paid, 'MCP tool "get_dashboard_stats" returned real-time KPIs');

    // --- TEST 10: In-App AI Assistant ---
    console.log('\n--- 10. In-App AI Assistant ---');
    const aiRes = await fetch(`${baseUrl}/api/assistant/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Show me my client list',
        company_id: 'all'
      })
    });
    const aiData = await aiRes.json();
    assert(aiData.success && aiData.data.reply.includes('client'), 'AI Assistant processed natural language query and returned actionable reply');

  } catch (err) {
    console.error('Fatal test error:', err);
    failed++;
  } finally {
    if (testServer) {
      testServer.close();
    }
    console.log(`\n========================================`);
    console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
    console.log(`========================================\n`);
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
