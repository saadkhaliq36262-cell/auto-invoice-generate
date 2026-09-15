/**
 * Node.js CLI Test Runner for Invoice Generator Modules
 */

// Mock localStorage for Node environment if not present
if (typeof localStorage === 'undefined') {
  let store = {};
  global.localStorage = {
    getItem: (k) => store[k] !== undefined ? store[k] : null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { store = {}; }
  };
}

const { RawInvoiceParser } = require('../js/parser.js');
const { InvoiceModel, CURRENCIES } = require('../js/invoice.js');
const { EmailDraftManager } = require('../js/email.js');
const { DemoManager } = require('../js/demo.js');

let passed = 0;
let failed = 0;

function assert(desc, condition, info = '') {
  if (condition) {
    console.log(`\x1b[32m✔ PASS\x1b[0m : ${desc}`);
    passed++;
  } else {
    console.log(`\x1b[31m✖ FAIL\x1b[0m : ${desc} - ${info}`);
    failed++;
  }
}

console.log('\n========================================');
console.log('Automated Invoice Generator Test Suite');
console.log('========================================\n');

// 1. Calculations Test Suite
const inv = new InvoiceModel({
  items: [
    { description: 'Full-Stack Development', quantity: 2, price: 1500.50 },
    { description: 'Cloud Setup', quantity: 1, price: 400.00 }
  ],
  discount: { type: 'fixed', value: 100 },
  tax: { type: 'percentage', rate: 10 },
  shipping: 50
});

// Subtotal = 2*1500.50 + 400 = 3401.00
assert('Subtotal Calculation ($3,401.00)', inv.calculateSubtotal() === 3401, `Got: ${inv.calculateSubtotal()}`);
assert('Fixed Discount Calculation ($100.00)', inv.calculateDiscountAmount() === 100, `Got: ${inv.calculateDiscountAmount()}`);
// Taxable = 3401 - 100 = 3301.00
assert('Taxable Net Amount ($3,301.00)', inv.calculateTaxableAmount() === 3301, `Got: ${inv.calculateTaxableAmount()}`);
// Tax 10% of 3301 = 330.10
assert('Tax Amount ($330.10)', inv.calculateTaxAmount() === 330.1, `Got: ${inv.calculateTaxAmount()}`);
// Grand Total = 3401 - 100 + 330.10 + 50 = 3681.10
assert('Grand Total Calculation ($3,681.10)', inv.calculateGrandTotal() === 3681.1, `Got: ${inv.calculateGrandTotal()}`);

// Percentage Discount Test
inv.discount = { type: 'percentage', value: 15 }; // 15% of 3401 = 510.15
assert('Percentage Discount (15% of $3,401 = $510.15)', Math.abs(inv.calculateDiscountAmount() - 510.15) < 0.001, `Got: ${inv.calculateDiscountAmount()}`);

// 2. Filename Generation Specification Test
// Requirement: Invoice-[Invoice Number]-[Customer Name].pdf
inv.invoiceMeta.invoiceNumber = 'INV-0001';
inv.customer.name = 'Ali Khan';
assert('PDF Filename requirement: Invoice-INV-0001-Ali-Khan.pdf', inv.getFilename() === 'Invoice-INV-0001-Ali-Khan.pdf', `Got: ${inv.getFilename()}`);

inv.invoiceMeta.invoiceNumber = 'INV/2026/089';
inv.customer.name = 'Sarah M. O\'Connor & Partners';
const safeFilename = inv.getFilename();
assert('PDF Filename cleans illegal chars and spaces', !safeFilename.includes('/') && !safeFilename.includes('\'') && safeFilename.endsWith('.pdf'), `Got: ${safeFilename}`);

// 3. Email Draft Content Specification Test
inv.company.name = 'Nova Solutions';
inv.customer.name = 'Ali Khan';
inv.customer.email = 'ali.khan@example.com';
inv.invoiceMeta.invoiceNumber = 'INV-0001';
inv.invoiceMeta.invoiceDate = '2026-09-14';
inv.invoiceMeta.dueDate = '2026-09-28';
inv.discount = { type: 'fixed', value: 0 };
inv.tax = { type: 'percentage', rate: 0 };
inv.shipping = 0;
inv.items = [{ description: 'Dev Service', quantity: 1, price: 1000 }];

const draft = inv.generateEmailDraft();
assert('Email Draft: Recipient matches Customer email', draft.recipient === 'ali.khan@example.com', `Got: ${draft.recipient}`);
assert('Email Draft: Subject matches "Invoice [Invoice Number] - [Company Name]"', draft.subject === 'Invoice INV-0001 - Nova Solutions', `Got: ${draft.subject}`);

const expectedBody = `Dear Ali Khan,

Please find the invoice details below.

Invoice Number: INV-0001
Invoice Date: 2026-09-14
Amount Due: $1,000.00
Due Date: 2026-09-28

Please review the invoice and let us know if you have any questions.

Thank you for your business.

Best regards,
Nova Solutions`;

assert('Email Draft: Body matches exact requested format', draft.body.trim() === expectedBody.trim(), `Diff:\nGot:\n${draft.body}\nExpected:\n${expectedBody}`);

// 4. Raw Text Parser Advanced Test Cases
// Case A: Pipe delimited format
const raw1 = `
Company: Apex Innovations
Company Email: info@apexinnovations.com
Company Phone: +1 (555) 234-5678
Customer: Ali Khan
Customer Email: ali.khan@example.com
Invoice Number: INV-0001
Invoice Date: 2026-09-14
Due Date: 2026-09-28
Items:
- Web App Development | Qty: 1 | Rate: $3500.00 | Tax: 10%
- Cloud Infrastructure | Qty: 1 | Rate: $850.00
Discount: $200
Tax: 10%
`;
const p1 = RawInvoiceParser.parse(raw1);
assert('Parser Test 1: Company name extracted', p1.company.name === 'Apex Innovations', `Got: ${p1.company.name}`);
assert('Parser Test 1: Customer email extracted', p1.customer.email === 'ali.khan@example.com', `Got: ${p1.customer.email}`);
assert('Parser Test 1: Invoice number extracted', p1.invoiceMeta.invoiceNumber === 'INV-0001', `Got: ${p1.invoiceMeta.invoiceNumber}`);
assert('Parser Test 1: 2 Items extracted', p1.items.length === 2, `Got: ${p1.items.length}`);
assert('Parser Test 1: Item 1 price is 3500', p1.items[0].price === 3500, `Got: ${p1.items[0].price}`);

// Case B: "X at $Y" syntax
const raw2 = `
Client: John Doe (john.doe@startup.io)
Date: 2026-09-14
Due: 2026-09-30
Services:
3 x Brand Identity Design @ $400
1 x Logo Vectorization @ $150
Discount: 5%
`;
const p2 = RawInvoiceParser.parse(raw2);
assert('Parser Test 2: Client name extracted from parenthesized email', p2.customer.name === 'John Doe', `Got: ${p2.customer.name}`);
assert('Parser Test 2: Client email extracted', p2.customer.email === 'john.doe@startup.io', `Got: ${p2.customer.email}`);
assert('Parser Test 2: Extracted 2 services', p2.items.length === 2, `Got: ${p2.items.length}`);
assert('Parser Test 2: Service 1 qty is 3 and price is 400', p2.items[0].quantity === 3 && p2.items[0].price === 400, `Got: ${JSON.stringify(p2.items[0])}`);
assert('Parser Test 2: Percentage discount parsed', p2.discount.value === 5 && p2.discount.isPercentage === true, `Got: ${JSON.stringify(p2.discount)}`);

// 5. Demo Limit & Developer Bypass Tests
localStorage.clear();
DemoManager.disableDevMode();

assert('Demo: Initial usage count is 0', DemoManager.getUsageCount() === 0, `Got: ${DemoManager.getUsageCount()}`);
assert('Demo: Limit not reached initially', DemoManager.isLimitReached() === false);

// 1st generation
DemoManager.incrementUsage();
assert('Demo: Usage count is 1 after 1st generation', DemoManager.getUsageCount() === 1, `Got: ${DemoManager.getUsageCount()}`);
assert('Demo: Limit not reached after 1st generation', DemoManager.isLimitReached() === false);
assert('Demo: 1 invoice remaining', DemoManager.getRemainingCount() === 1);

// 2nd generation
DemoManager.incrementUsage();
assert('Demo: Usage count is 2 after 2nd generation', DemoManager.getUsageCount() === 2, `Got: ${DemoManager.getUsageCount()}`);
assert('Demo: Limit IS reached after 2nd generation', DemoManager.isLimitReached() === true);
assert('Demo: 0 invoices remaining', DemoManager.getRemainingCount() === 0);

// Refresh simulation (reading usage does NOT increment)
const readAgain = DemoManager.getUsageCount();
assert('Demo: Reading state (page refresh) does not increment count', readAgain === 2, `Got: ${readAgain}`);
assert('Demo: Limit remains strictly enforced on refresh', DemoManager.isLimitReached() === true);

// Developer / Admin Bypass Test
DemoManager.enableDevMode();
assert('Demo: Developer mode is active', DemoManager.isAdmin() === true);
assert('Demo: Limit is bypassed for developer even when count >= 2', DemoManager.isLimitReached() === false);
DemoManager.incrementUsage(); // Admin usage does not increment demo count
assert('Demo: Admin usage does not increment visitor counter', DemoManager.getUsageCount() === 2);

// Re-disable dev mode to verify visitor limit is still intact
DemoManager.disableDevMode();
assert('Demo: Visitor mode restored', DemoManager.isAdmin() === false);
assert('Demo: Visitor remains limit-blocked at 2', DemoManager.isLimitReached() === true);

console.log(`\n========================================`);
console.log(`Test Execution Complete: ${passed} Passed, ${failed} Failed`);
console.log(`========================================\n`);

if (failed > 0) process.exit(1);
