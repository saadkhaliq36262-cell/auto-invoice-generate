/**
 * Main Application Controller for AutoInvoice Pro
 */

// Global State
let currentInvoice = new InvoiceModel();

// Sample Presets Dictionary
const PRESETS = {
  freelance: `Company: Nova Creative Studio
Company Email: hello@novacreative.io
Company Phone: +1 (555) 782-9901
Company Address: 100 Innovation Blvd, Austin, TX 78701
Tax ID: US-EIN-88392019

Customer: Ali Khan
Customer Email: ali.khan@example.com
Customer Phone: +1 (555) 987-6543
Customer Address: 456 Elm Street, Apt 4B, Seattle, WA 98101

Invoice Number: INV-0001
Invoice Date: 2026-09-14
Due Date: 2026-09-28
Payment Terms: Net 14
Payment Status: Pending

Items:
- Full-Stack Web Application Development & API Integration | Qty: 1 | Rate: $3500.00
- Cloud Infrastructure Setup & Automated CI/CD | Qty: 1 | Rate: $850.00
- Monthly Maintenance & Support SLA | Qty: 2 | Rate: $300.00

Discount: $200
Tax: 10%
Notes: Payment due within 14 days of invoice date. Thank you for your business!
Bank Details: Silicon Valley Bank, Account: 9876-5432-1098, Routing: 121000358`,

  agency: `Company: Apex Media Group
Company Email: billing@apexmedia.com
Company Phone: +1 (555) 345-6789
Company Address: 500 Madison Ave, Floor 14, New York, NY 10022
Tax ID: NY-CORP-49201

Customer: Quantum Enterprises (procurement@quantumenterprises.com)
Customer Phone: +1 (555) 441-9023
Customer Address: 800 Market St, San Francisco, CA 94102

Invoice Number: INV-2026-042
Invoice Date: 2026-09-14
Due Date: 2026-10-14
Payment Terms: Net 30
Payment Status: Pending

Items:
- Brand Identity System & Comprehensive Design Guidelines | Qty: 1 | Rate: $4200.00
- 3D Product Motion Design Video (60s 4K) | Qty: 2 | Rate: $1800.00
- Social Media Ad Campaign Multi-Platform Asset Pack | Qty: 10 | Rate: $150.00

Discount: 5%
Tax: 8.875%
Notes: All deliverables have been transferred with unrestricted worldwide commercial usage rights.
Bank Details: Chase Commercial Banking, Account: 4429-8102-9300, SWIFT: CHASEUS33`,

  consulting: `Company: Horizon Strategy & Advisory
Company Email: contact@horizonstrategy.com
Company Phone: +1 (555) 902-1144
Company Address: 200 South Wacker Dr, Chicago, IL 60606
Tax ID: IL-TAX-90218

Customer: Elena Rostova (elena.rostova@globalcorp.eu)
Customer Phone: +33 1 42 68 55 00
Customer Address: 42 Avenue Montaigne, 75008 Paris, France

Invoice Number: INV-8819
Invoice Date: 2026-09-14
Due Date: 2026-09-21
Payment Terms: Net 7
Payment Status: Pending

Items:
- Enterprise Architecture & Systems Consultation (Hours) | Qty: 25 | Rate: $220.00
- Cybersecurity Risk & Compliance Audit | Qty: 1 | Rate: $2800.00
- Cloud Cost Optimization & FinOps Blueprint | Qty: 1 | Rate: $1400.00

Discount: $300
Tax: 0%
Notes: EU VAT Exempt (Reverse Charge mechanism applies under Article 196).
Bank Details: BNP Paribas International, IBAN: FR7630006000011234567890189, BIC: BNPAFRPP`,

  product: `Company: NextGen Robotics & Hardware
Company Email: sales@nextgenrobotics.com
Company Phone: +1 (555) 604-3321
Company Address: 1200 Silicon Parkway, San Jose, CA 95134
Tax ID: CA-TECH-77129

Customer: Sarah Jenkins (sarah.j@manufacturingpro.com)
Customer Phone: +1 (555) 831-2900
Customer Address: 900 Industrial Loop, Detroit, MI 48201

Invoice Number: INV-9021
Invoice Date: 2026-09-14
Due Date: 2026-09-28
Payment Terms: Net 14
Payment Status: Pending

Items:
- Industrial IoT Smart Sensor Modules (Pack of 10) | Qty: 5 | Rate: $450.00
- Edge Gateway Industrial Controller Units | Qty: 2 | Rate: $850.00
- Heavy-Duty DIN Rail Mounting Brackets & Shielded Cabling | Qty: 10 | Rate: $45.00

Discount: $100
Tax: 7.25%
Notes: Standard 2-year manufacturer hardware replacement warranty included.
Bank Details: Bank of America Commercial, Account: 0092-4819-2041, Routing: 121000358`
};

// Modern Sample SVG Logo
const DEFAULT_SAMPLE_LOGO = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60" width="200" height="60"><rect width="60" height="60" rx="12" fill="%232563eb"/><path d="M18 42L30 18L42 42M23 35H37" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"/><text x="75" y="38" font-family="system-ui,-apple-system,sans-serif" font-size="22" font-weight="800" fill="%230f172a">ACME<tspan fill="%232563eb">.</tspan></text></svg>`;

// DOM Content Loaded Initializer
document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
});

function initializeApp() {
  // Check for saved sender company defaults
  const savedCompany = StorageManager.getCompanyProfile();
  if (savedCompany) {
    currentInvoice.company = { ...savedCompany };
  } else {
    currentInvoice.company.logoUrl = DEFAULT_SAMPLE_LOGO;
  }

  // Populate form with currentInvoice state
  populateFormFromModel(currentInvoice);
  
  // Attach all UI listeners
  bindEventListeners();

  // Initial live preview render
  updatePreview();
  updateHistoryBadge();
}

/**
 * Bind DOM Event Listeners
 */
function bindEventListeners() {
  // 1. Raw Text Parsing
  document.getElementById('btnParseRawText').addEventListener('click', handleParseRawText);
  document.getElementById('btnClearRawText').addEventListener('click', () => {
    document.getElementById('rawTextInput').value = '';
    showToast('Raw text input cleared', 'info');
  });

  // Preset pill buttons
  document.querySelectorAll('.sample-pills .pill-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const presetKey = e.target.dataset.preset;
      if (PRESETS[presetKey]) {
        document.getElementById('rawTextInput').value = PRESETS[presetKey];
        handleParseRawText();
      }
    });
  });

  // 2. Form Input Live Sync
  const syncInputs = [
    'companyName', 'companyEmail', 'companyPhone', 'companyTaxId', 'companyAddress',
    'customerName', 'customerEmail', 'customerPhone', 'customerId', 'customerAddress',
    'invoiceNumber', 'invoiceDate', 'dueDate', 'paymentStatus', 'paymentTerms', 'currencySelect',
    'discountValue', 'discountType', 'taxRate', 'shippingFee',
    'paymentDetails', 'invoiceNotes'
  ];

  syncInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', handleFormChange);
      el.addEventListener('change', handleFormChange);
    }
  });

  // 3. Logo Management
  const logoFileInput = document.getElementById('logoFileInput');
  logoFileInput.addEventListener('change', handleLogoUpload);

  document.getElementById('btnSampleLogo').addEventListener('click', () => {
    currentInvoice.company.logoUrl = DEFAULT_SAMPLE_LOGO;
    displayLogoPreview(DEFAULT_SAMPLE_LOGO);
    updatePreview();
    showToast('Applied sample modern logo', 'success');
  });

  document.getElementById('btnRemoveLogo').addEventListener('click', () => {
    currentInvoice.company.logoUrl = '';
    logoFileInput.value = '';
    displayLogoPreview('');
    updatePreview();
    showToast('Removed logo', 'info');
  });

  // Save Default Company
  document.getElementById('btnSaveCompanyDefault').addEventListener('click', () => {
    StorageManager.saveCompanyProfile(currentInvoice.company);
    showToast('Sender company saved as default profile!', 'success');
  });

  // 4. Line Items Management
  document.getElementById('btnAddItem').addEventListener('click', () => {
    currentInvoice.items.push({
      id: 'item_' + Date.now(),
      description: 'New Service / Product Item',
      quantity: 1,
      price: 100.00,
      taxRate: 0
    });
    renderItemsEditor();
    updatePreview();
  });

  // 5. Theme Picker
  document.querySelectorAll('.theme-dot').forEach(dot => {
    dot.addEventListener('click', (e) => {
      document.querySelectorAll('.theme-dot').forEach(d => d.classList.remove('active'));
      const theme = e.currentTarget.dataset.themeName;
      e.currentTarget.classList.add('active');
      document.body.setAttribute('data-theme', theme);
      currentInvoice.themeColor = theme;
    });
  });

  // 6. Header Action Buttons
  // New Invoice
  document.getElementById('btnNewInvoice').addEventListener('click', handleNewInvoice);

  // Print Invoice
  document.getElementById('btnPrintInvoice').addEventListener('click', () => {
    PDFExporter.printInvoice();
  });

  // Download PDF
  document.getElementById('btnDownloadPDF').addEventListener('click', handleDownloadPDF);

  // Create Email Draft
  document.getElementById('btnCreateEmailDraft').addEventListener('click', handleOpenEmailDraftModal);

  // History Modal
  document.getElementById('btnOpenHistory').addEventListener('click', handleOpenHistoryModal);
  document.getElementById('historySearchInput').addEventListener('input', handleHistorySearch);

  // Close Modals
  document.querySelectorAll('.close-modal-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const modalId = e.target.dataset.modal;
      if (modalId) closeModal(modalId);
    });
  });

  // Modal Backdrop Click
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        backdrop.classList.remove('active');
      }
    });
  });

  // Email Draft Modal Actions
  document.getElementById('btnOpenGmail').addEventListener('click', () => {
    const draft = currentInvoice.generateEmailDraft();
    EmailDraftManager.openGmailCompose(draft);
    showToast('Opened Gmail compose window', 'info');
  });

  document.getElementById('btnOpenDefaultMail').addEventListener('click', () => {
    const draft = currentInvoice.generateEmailDraft();
    EmailDraftManager.openDefaultMailClient(draft);
    showToast('Launched default mail client', 'info');
  });

  document.getElementById('btnCopyRecipient').addEventListener('click', async () => {
    const text = document.getElementById('draftRecipient').value;
    await EmailDraftManager.copyText(text);
    showToast('Recipient email copied!', 'success');
  });

  document.getElementById('btnCopySubject').addEventListener('click', async () => {
    const text = document.getElementById('draftSubject').value;
    await EmailDraftManager.copyText(text);
    showToast('Subject line copied!', 'success');
  });

  document.getElementById('btnCopyBody').addEventListener('click', async () => {
    const text = document.getElementById('draftBody').value;
    await EmailDraftManager.copyText(text);
    showToast('Email body copied!', 'success');
  });

  document.getElementById('btnCopyFullEmail').addEventListener('click', async () => {
    const to = document.getElementById('draftRecipient').value;
    const subj = document.getElementById('draftSubject').value;
    const body = document.getElementById('draftBody').value;
    const full = `To: ${to}\nSubject: ${subj}\n\n${body}`;
    await EmailDraftManager.copyText(full);
    showToast('Complete email draft copied to clipboard!', 'success');
  });

  // Keyboard Shortcuts (Ctrl+P to print, Ctrl+S to save/download)
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
      e.preventDefault();
      PDFExporter.printInvoice();
    }
  });
}

/**
 * Handle Raw Text Parsing
 */
function handleParseRawText() {
  const rawText = document.getElementById('rawTextInput').value;
  if (!rawText.trim()) {
    showToast('Please paste or enter some text first', 'info');
    return;
  }

  const parsed = RawInvoiceParser.parse(rawText);

  // Merge parsed values into currentInvoice
  if (parsed.company) {
    if (parsed.company.name) currentInvoice.company.name = parsed.company.name;
    if (parsed.company.email) currentInvoice.company.email = parsed.company.email;
    if (parsed.company.phone) currentInvoice.company.phone = parsed.company.phone;
    if (parsed.company.address) currentInvoice.company.address = parsed.company.address;
    if (parsed.company.taxId) currentInvoice.company.taxId = parsed.company.taxId;
  }

  if (parsed.customer) {
    if (parsed.customer.name) currentInvoice.customer.name = parsed.customer.name;
    if (parsed.customer.email) currentInvoice.customer.email = parsed.customer.email;
    if (parsed.customer.phone) currentInvoice.customer.phone = parsed.customer.phone;
    if (parsed.customer.address) currentInvoice.customer.address = parsed.customer.address;
  }

  if (parsed.invoiceMeta) {
    if (parsed.invoiceMeta.invoiceNumber) currentInvoice.invoiceMeta.invoiceNumber = parsed.invoiceMeta.invoiceNumber;
    if (parsed.invoiceMeta.invoiceDate) currentInvoice.invoiceMeta.invoiceDate = parsed.invoiceMeta.invoiceDate;
    if (parsed.invoiceMeta.dueDate) currentInvoice.invoiceMeta.dueDate = parsed.invoiceMeta.dueDate;
  }

  if (parsed.paymentTerms) currentInvoice.invoiceMeta.paymentTerms = parsed.paymentTerms;
  if (parsed.paymentStatus) currentInvoice.invoiceMeta.paymentStatus = parsed.paymentStatus;
  if (parsed.notes) currentInvoice.notes = parsed.notes;
  if (parsed.bankDetails) currentInvoice.paymentDetails = parsed.bankDetails;

  if (parsed.discount) {
    currentInvoice.discount.value = parsed.discount.value;
    currentInvoice.discount.type = parsed.discount.isPercentage ? 'percentage' : 'fixed';
  }

  if (parsed.taxRate) {
    currentInvoice.tax.rate = parsed.taxRate.value;
  }

  if (parsed.items && parsed.items.length > 0) {
    currentInvoice.items = parsed.items.map(item => ({
      id: 'item_' + Math.random().toString(36).substr(2, 9),
      description: item.description,
      quantity: item.quantity,
      price: item.price,
      taxRate: item.tax || 0
    }));
  }

  // Update UI
  populateFormFromModel(currentInvoice);
  updatePreview();
  showToast('Successfully parsed invoice data and populated form!', 'success');
}

/**
 * Handle Form Changes & Live State Sync
 */
function handleFormChange() {
  currentInvoice.company.name = document.getElementById('companyName').value;
  currentInvoice.company.email = document.getElementById('companyEmail').value;
  currentInvoice.company.phone = document.getElementById('companyPhone').value;
  currentInvoice.company.taxId = document.getElementById('companyTaxId').value;
  currentInvoice.company.address = document.getElementById('companyAddress').value;

  currentInvoice.customer.name = document.getElementById('customerName').value;
  currentInvoice.customer.email = document.getElementById('customerEmail').value;
  currentInvoice.customer.phone = document.getElementById('customerPhone').value;
  currentInvoice.customer.customerId = document.getElementById('customerId').value;
  currentInvoice.customer.address = document.getElementById('customerAddress').value;

  currentInvoice.invoiceMeta.invoiceNumber = document.getElementById('invoiceNumber').value;
  currentInvoice.invoiceMeta.invoiceDate = document.getElementById('invoiceDate').value;
  currentInvoice.invoiceMeta.dueDate = document.getElementById('dueDate').value;
  currentInvoice.invoiceMeta.paymentStatus = document.getElementById('paymentStatus').value;
  currentInvoice.invoiceMeta.paymentTerms = document.getElementById('paymentTerms').value;
  currentInvoice.invoiceMeta.currency = document.getElementById('currencySelect').value;

  currentInvoice.discount.value = parseFloat(document.getElementById('discountValue').value) || 0;
  currentInvoice.discount.type = document.getElementById('discountType').value;
  currentInvoice.tax.rate = parseFloat(document.getElementById('taxRate').value) || 0;
  currentInvoice.shipping = parseFloat(document.getElementById('shippingFee').value) || 0;

  currentInvoice.paymentDetails = document.getElementById('paymentDetails').value;
  currentInvoice.notes = document.getElementById('invoiceNotes').value;

  updatePreview();
}

/**
 * Handle Logo Upload
 */
function handleLogoUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  if (file.size > 2.5 * 1024 * 1024) {
    showToast('Logo file size must be less than 2.5MB', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    const dataUrl = event.target.result;
    currentInvoice.company.logoUrl = dataUrl;
    displayLogoPreview(dataUrl);
    updatePreview();
    showToast('Company logo updated', 'success');
  };
  reader.readAsDataURL(file);
}

function displayLogoPreview(url) {
  const previewImg = document.getElementById('logoPreviewImg');
  const placeholder = document.getElementById('logoPlaceholder');
  const btnRemove = document.getElementById('btnRemoveLogo');

  if (url) {
    previewImg.src = url;
    previewImg.style.display = 'block';
    placeholder.style.display = 'none';
    btnRemove.style.display = 'inline-block';
  } else {
    previewImg.src = '';
    previewImg.style.display = 'none';
    placeholder.style.display = 'block';
    btnRemove.style.display = 'none';
  }
}

/**
 * Populate Form fields from an InvoiceModel instance
 */
function populateFormFromModel(model) {
  document.getElementById('companyName').value = model.company.name || '';
  document.getElementById('companyEmail').value = model.company.email || '';
  document.getElementById('companyPhone').value = model.company.phone || '';
  document.getElementById('companyTaxId').value = model.company.taxId || '';
  document.getElementById('companyAddress').value = model.company.address || '';

  displayLogoPreview(model.company.logoUrl || '');

  document.getElementById('customerName').value = model.customer.name || '';
  document.getElementById('customerEmail').value = model.customer.email || '';
  document.getElementById('customerPhone').value = model.customer.phone || '';
  document.getElementById('customerId').value = model.customer.customerId || '';
  document.getElementById('customerAddress').value = model.customer.address || '';

  document.getElementById('invoiceNumber').value = model.invoiceMeta.invoiceNumber || '';
  document.getElementById('invoiceDate').value = model.invoiceMeta.invoiceDate || '';
  document.getElementById('dueDate').value = model.invoiceMeta.dueDate || '';
  document.getElementById('paymentStatus').value = model.invoiceMeta.paymentStatus || 'Pending';
  document.getElementById('paymentTerms').value = model.invoiceMeta.paymentTerms || 'Net 14';
  document.getElementById('currencySelect').value = model.invoiceMeta.currency || 'USD';

  document.getElementById('discountValue').value = model.discount.value || 0;
  document.getElementById('discountType').value = model.discount.type || 'fixed';
  document.getElementById('taxRate').value = model.tax.rate || 0;
  document.getElementById('shippingFee').value = model.shipping || 0;

  document.getElementById('paymentDetails').value = model.paymentDetails || '';
  document.getElementById('invoiceNotes').value = model.notes || '';

  renderItemsEditor();
}

/**
 * Render dynamic line items in the editor
 */
function renderItemsEditor() {
  const container = document.getElementById('itemsContainer');
  container.innerHTML = '';

  currentInvoice.items.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'item-row';
    row.innerHTML = `
      <input type="text" class="form-input item-desc-input" placeholder="Item / Service description" value="${escapeHtml(item.description)}">
      <input type="number" class="form-input item-qty-input" min="0.01" step="any" placeholder="Qty" value="${item.quantity}">
      <input type="number" class="form-input item-price-input" min="0" step="any" placeholder="Price" value="${item.price}">
      <input type="number" class="form-input item-tax-input" min="0" max="100" step="any" placeholder="Tax %" value="${item.taxRate || 0}">
      <button class="btn btn-danger-ghost btn-sm btn-delete-item" title="Delete item">🗑️</button>
    `;

    // Row input listeners
    row.querySelector('.item-desc-input').addEventListener('input', (e) => {
      item.description = e.target.value;
      updatePreview();
    });

    row.querySelector('.item-qty-input').addEventListener('input', (e) => {
      item.quantity = parseFloat(e.target.value) || 0;
      updatePreview();
    });

    row.querySelector('.item-price-input').addEventListener('input', (e) => {
      item.price = parseFloat(e.target.value) || 0;
      updatePreview();
    });

    row.querySelector('.item-tax-input').addEventListener('input', (e) => {
      item.taxRate = parseFloat(e.target.value) || 0;
      updatePreview();
    });

    row.querySelector('.btn-delete-item').addEventListener('click', () => {
      if (currentInvoice.items.length <= 1) {
        showToast('Invoice must have at least one line item', 'info');
        return;
      }
      currentInvoice.items.splice(index, 1);
      renderItemsEditor();
      updatePreview();
    });

    container.appendChild(row);
  });
}

/**
 * Update the live A4 invoice preview canvas
 */
function updatePreview() {
  const m = currentInvoice;

  // Company Preview
  document.getElementById('previewCompanyName').textContent = m.company.name || 'Your Company Name';
  
  let compDetails = [];
  if (m.company.address) compDetails.push(m.company.address);
  
  let contactLine = [];
  if (m.company.email) contactLine.push(m.company.email);
  if (m.company.phone) contactLine.push(m.company.phone);
  if (contactLine.length > 0) compDetails.push(contactLine.join(' | '));

  if (m.company.taxId) compDetails.push(`Tax ID: ${m.company.taxId}`);
  document.getElementById('previewCompanyDetails').textContent = compDetails.join('\n');

  // Company Logo
  const previewLogo = document.getElementById('previewLogo');
  if (m.company.logoUrl) {
    previewLogo.src = m.company.logoUrl;
    previewLogo.style.display = 'block';
  } else {
    previewLogo.style.display = 'none';
  }

  // Invoice Number & Status
  const invNumber = m.invoiceMeta.invoiceNumber || 'INV-0001';
  document.getElementById('previewInvoiceNumber').textContent = invNumber;

  const statusBadge = document.getElementById('previewStatusBadge');
  const status = m.invoiceMeta.paymentStatus || 'Pending';
  statusBadge.textContent = status;
  statusBadge.className = `inv-status-pill ${status}`;

  // Customer Preview
  document.getElementById('previewCustomerName').textContent = m.customer.name || 'Client Name';
  
  let custDetails = [];
  if (m.customer.email) custDetails.push(m.customer.email);
  if (m.customer.phone) custDetails.push(m.customer.phone);
  if (m.customer.address) custDetails.push(m.customer.address);
  if (m.customer.customerId) custDetails.push(`Ref: ${m.customer.customerId}`);
  document.getElementById('previewCustomerDetails').textContent = custDetails.join('\n');

  // Metadata Grid
  document.getElementById('previewInvoiceDate').textContent = m.invoiceMeta.invoiceDate || '-';
  document.getElementById('previewDueDate').textContent = m.invoiceMeta.dueDate || '-';
  document.getElementById('previewPaymentTerms').textContent = m.invoiceMeta.paymentTerms || 'Due on Receipt';
  
  const currConf = m.getCurrencyConfig();
  document.getElementById('previewCurrency').textContent = `${currConf.code} (${currConf.symbol.trim()})`;

  // Items Table
  const tbody = document.getElementById('previewTableBody');
  tbody.innerHTML = '';

  m.items.forEach(item => {
    const tr = document.createElement('tr');
    const lineTotal = (item.quantity * item.price);
    tr.innerHTML = `
      <td><span class="inv-item-desc">${escapeHtml(item.description || 'Service/Item')}</span></td>
      <td class="text-center">${item.quantity}</td>
      <td class="text-right">${m.formatCurrency(item.price)}</td>
      <td class="text-right"><strong>${m.formatCurrency(lineTotal)}</strong></td>
    `;
    tbody.appendChild(tr);
  });

  // Totals Calculations
  const subtotal = m.calculateSubtotal();
  const discountAmt = m.calculateDiscountAmount();
  const taxAmt = m.calculateTaxAmount();
  const grandTotal = m.calculateGrandTotal();

  document.getElementById('previewSubtotal').textContent = m.formatCurrency(subtotal);

  // Discount Row
  const discountRow = document.getElementById('previewDiscountRow');
  if (discountAmt > 0) {
    discountRow.style.display = 'flex';
    const discLabel = m.discount.type === 'percentage' ? `Discount (${m.discount.value}%):` : 'Discount:';
    discountRow.querySelector('span:first-child').textContent = discLabel;
    document.getElementById('previewDiscount').textContent = `-${m.formatCurrency(discountAmt)}`;
  } else {
    discountRow.style.display = 'none';
  }

  // Tax Row
  const taxRow = document.getElementById('previewTaxRow');
  if (taxAmt > 0 || m.tax.rate > 0) {
    taxRow.style.display = 'flex';
    document.getElementById('previewTaxLabel').textContent = `Tax (${m.tax.rate}%):`;
    document.getElementById('previewTax').textContent = `+${m.formatCurrency(taxAmt)}`;
  } else {
    taxRow.style.display = 'none';
  }

  // Shipping Row
  const shippingRow = document.getElementById('previewShippingRow');
  if (m.shipping > 0) {
    shippingRow.style.display = 'flex';
    document.getElementById('previewShipping').textContent = `+${m.formatCurrency(m.shipping)}`;
  } else {
    shippingRow.style.display = 'none';
  }

  // Grand Total
  document.getElementById('previewGrandTotal').textContent = m.formatCurrency(grandTotal);

  // Payment Details & Notes
  document.getElementById('previewPaymentDetails').textContent = m.paymentDetails || 'Direct wire transfer or standard payment terms.';
  document.getElementById('previewNotes').textContent = m.notes || 'Thank you for your business!';

  // Footer Contact
  const footerContact = document.getElementById('previewFooterContact');
  if (m.company.email) {
    footerContact.textContent = `Questions? Contact ${m.company.email}`;
  } else {
    footerContact.textContent = `Thank you for your partnership.`;
  }

  // Filename display
  const filename = m.getFilename();
  document.getElementById('previewFilenameDisplay').textContent = filename;
}

/**
 * Handle Download PDF Action
 */
async function handleDownloadPDF() {
  const canvasElement = document.getElementById('invoicePreviewCanvas');
  const btn = document.getElementById('btnDownloadPDF');
  const originalText = btn.innerHTML;

  try {
    btn.disabled = true;
    btn.innerHTML = '⏳ Generating PDF...';

    // Auto-save invoice to history
    StorageManager.saveInvoice(currentInvoice);
    updateHistoryBadge();

    const downloadedName = await PDFExporter.exportToPDF(canvasElement, currentInvoice, (progress) => {
      showToast(progress.message, 'info');
    });

    showToast(`✅ Downloaded: ${downloadedName}`, 'success');
  } catch (err) {
    console.error(err);
    showToast('Error generating PDF. Using print view.', 'error');
    PDFExporter.printInvoice();
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}

/**
 * Handle Open Email Draft Modal
 */
function handleOpenEmailDraftModal() {
  // Generate exact required draft
  const draft = currentInvoice.generateEmailDraft();

  document.getElementById('draftRecipient').value = draft.recipient;
  document.getElementById('draftSubject').value = draft.subject;
  document.getElementById('draftBody').value = draft.body;
  document.getElementById('modalFilenameDisplay').textContent = draft.filename;

  openModal('emailDraftModal');
}

/**
 * Handle Open History Modal
 */
function handleOpenHistoryModal() {
  renderHistoryList();
  openModal('historyModal');
}

function renderHistoryList(filterText = '') {
  const container = document.getElementById('historyListContainer');
  container.innerHTML = '';

  let history = StorageManager.getInvoices();
  if (filterText.trim()) {
    const q = filterText.toLowerCase();
    history = history.filter(inv => {
      const name = (inv.customer?.name || '').toLowerCase();
      const num = (inv.invoiceMeta?.invoiceNumber || '').toLowerCase();
      return name.includes(q) || num.includes(q);
    });
  }

  if (history.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
        No saved invoices found. Invoices are saved automatically when you download or update them.
      </div>
    `;
    return;
  }

  history.forEach(invData => {
    const inv = new InvoiceModel(invData);
    const card = document.createElement('div');
    card.style.cssText = 'background: #f8fafc; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 0.75rem 1rem; display: flex; justify-content: space-between; align-items: center;';
    
    card.innerHTML = `
      <div>
        <div style="font-weight: 700; color: var(--text-main); font-size: 0.95rem;">
          ${escapeHtml(inv.invoiceMeta.invoiceNumber)} — ${escapeHtml(inv.customer.name || 'Client')}
        </div>
        <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.15rem;">
          Date: ${inv.invoiceMeta.invoiceDate} | Total: <strong style="color: var(--text-main);">${inv.formatCurrency(inv.calculateGrandTotal())}</strong> | <span class="badge ${inv.invoiceMeta.paymentStatus}">${inv.invoiceMeta.paymentStatus}</span>
        </div>
      </div>
      <div style="display: flex; gap: 0.4rem;">
        <button class="btn btn-secondary btn-sm btn-load-hist">Load</button>
        <button class="btn btn-danger-ghost btn-sm btn-delete-hist" title="Delete">🗑️</button>
      </div>
    `;

    card.querySelector('.btn-load-hist').addEventListener('click', () => {
      currentInvoice = inv;
      populateFormFromModel(currentInvoice);
      updatePreview();
      closeModal('historyModal');
      showToast(`Loaded invoice ${inv.invoiceMeta.invoiceNumber}`, 'success');
    });

    card.querySelector('.btn-delete-hist').addEventListener('click', () => {
      StorageManager.deleteInvoice(inv.id);
      renderHistoryList(filterText);
      updateHistoryBadge();
      showToast('Deleted invoice from history', 'info');
    });

    container.appendChild(card);
  });
}

function handleHistorySearch(e) {
  renderHistoryList(e.target.value);
}

function updateHistoryBadge() {
  const count = StorageManager.getInvoices().length;
  const badge = document.getElementById('historyCountBadge');
  if (badge) badge.textContent = count;
}

/**
 * Handle New / Reset Invoice
 */
function handleNewInvoice() {
  const nextNumber = StorageManager.getNextInvoiceNumber();
  const savedCompany = StorageManager.getCompanyProfile();

  currentInvoice = new InvoiceModel({
    company: savedCompany || { logoUrl: DEFAULT_SAMPLE_LOGO },
    invoiceMeta: {
      invoiceNumber: nextNumber,
      invoiceDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      paymentStatus: 'Pending',
      paymentTerms: 'Net 14',
      currency: 'USD'
    },
    customer: {
      name: '',
      email: '',
      phone: '',
      address: '',
      customerId: ''
    },
    items: [
      {
        id: 'item_1',
        description: 'Professional Services',
        quantity: 1,
        price: 500.00,
        taxRate: 0
      }
    ],
    discount: { type: 'fixed', value: 0 },
    tax: { type: 'percentage', rate: 10 },
    shipping: 0
  });

  populateFormFromModel(currentInvoice);
  updatePreview();
  showToast(`Created new invoice ${nextNumber}`, 'success');
}

/**
 * Modal Open/Close Utilities
 */
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('active');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('active');
}

/**
 * Toast Notification Utility
 */
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  if (type === 'error') icon = '❌';

  toast.innerHTML = `<span>${icon}</span> <span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.2s ease-out';
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 200);
  }, 3500);
}

/**
 * HTML Escape Helper
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
