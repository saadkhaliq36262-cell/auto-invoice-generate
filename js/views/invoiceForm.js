/**
 * Invoice Creation & Edit View for AutoInvoice Pro
 * Offers dual mode: Visual Structured Form + ⚡ Quick Raw Text Parser
 */
const InvoiceFormView = {
  currentMode: 'form', // 'form' or 'parser'
  invoiceId: null,
  lineItems: [
    { description: 'Professional Services / Development', quantity: 1, unit_price: 1500, tax_rate: 20, amount: 1500 }
  ],

  async render(container, invoiceId = null) {
    this.invoiceId = invoiceId;
    const isEdit = Boolean(invoiceId);

    // Load available companies and clients
    const companies = State.companies || [];
    let defaultCompanyId = State.currentCompanyId !== 'all' ? State.currentCompanyId : (companies[0]?.id || '');
    
    // Fetch clients
    const clientsRes = await API.getClients(defaultCompanyId);
    const clients = clientsRes.data || [];

    // Fetch templates for company
    const tmplRes = await API.getTemplates(defaultCompanyId);
    const templates = tmplRes.data || [];

    // Next invoice number
    let nextInvoiceNumber = 'INV-0001';
    if (!isEdit && defaultCompanyId) {
      try {
        const numRes = await API.getNextInvoiceNumber(defaultCompanyId);
        if (numRes.success) nextInvoiceNumber = numRes.data.next_invoice_number;
      } catch (e) {
        console.warn('Could not fetch next number:', e);
      }
    }

    container.innerHTML = `
      <div class="view-header">
        <div>
          <a href="#invoices" class="back-link">&larr; Back to Invoices</a>
          <div class="view-title">${isEdit ? 'Edit Invoice' : 'Create New Invoice'}</div>
          <div class="view-subtitle">Select company, add line items, and configure settlement terms</div>
        </div>
        <div class="mode-toggle-group">
          <button class="btn btn-sm ${this.currentMode === 'form' ? 'btn-primary' : 'btn-secondary'}" id="btnModeForm">
            📝 Visual Form
          </button>
          <button class="btn btn-sm ${this.currentMode === 'parser' ? 'btn-primary' : 'btn-secondary'}" id="btnModeParser">
            ⚡ Quick Raw Text Parser
          </button>
        </div>
      </div>

      <!-- Quick Parser Card (shown when parser mode active) -->
      <div class="card parser-card ${this.currentMode === 'parser' ? '' : 'hidden'}" id="rawParserCard">
        <div class="card-header flex-between">
          <span class="card-header-title">⚡ Quick Paste / Smart Text Parser</span>
          <div class="sample-pills">
            <span class="text-xs text-muted">Presets:</span>
            <button class="pill-btn" data-preset="freelance">Freelance Dev</button>
            <button class="pill-btn" data-preset="agency">Agency Retainer</button>
            <button class="pill-btn" data-preset="consulting">IT Consulting</button>
          </div>
        </div>
        <div class="card-body">
          <p class="text-sm text-muted mb-2">Paste raw customer notes or quotes below. The parser extracts customer name, email, items, prices, tax and discounts automatically:</p>
          <textarea id="rawParserTextarea" class="raw-textarea" rows="5" placeholder="Example:
Customer: Apex Digital Media Ltd (client@example.com)
Address: 45 Deansgate, City Centre, Manchester
Items:
- API Integration & Microservices | 1 | £2400
- Cloud Deployment Retainer | 2 | £900
Tax: 20%
Discount: £200
Due in 14 days"></textarea>
          <div class="flex-end gap-2 mt-2">
            <button type="button" class="btn btn-ghost btn-sm" id="btnClearParser">Clear</button>
            <button type="button" class="btn btn-primary btn-sm" id="btnRunParser">✨ Parse &amp; Populate Form</button>
          </div>
        </div>
      </div>

      <!-- Main Invoice Form -->
      <form id="invoiceEditorForm">
        <div class="invoice-form-grid">
          
          <!-- Left Main Column -->
          <div class="invoice-form-main">
            
            <!-- Company & Client Selection -->
            <div class="card">
              <div class="card-header"><span class="card-header-title">Invoice Parties</span></div>
              <div class="card-body">
                <div class="form-grid-2">
                  <div class="form-group">
                    <label>Issuing Company *</label>
                    <select name="company_id" id="invCompanySelect" class="form-input" required ${isEdit ? 'disabled' : ''}>
                      ${companies.map(c => `
                        <option value="${c.id}" ${c.id === defaultCompanyId ? 'selected' : ''}>
                          ${c.name} (${c.currency})
                        </option>
                      `).join('')}
                    </select>
                  </div>

                  <div class="form-group">
                    <div class="flex-between">
                      <label>Billed Client *</label>
                      <button type="button" class="btn-link text-xs" id="btnQuickAddClient">+ Quick Add Client</button>
                    </div>
                    <select name="client_id" id="invClientSelect" class="form-input" required>
                      ${clients.length > 0 ? clients.map(cl => `
                        <option value="${cl.id}">${cl.name} ${cl.business_name ? `(${cl.business_name})` : ''}</option>
                      `).join('') : '<option value="">No clients found — click Quick Add</option>'}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <!-- Line Items Table -->
            <div class="card mt-4">
              <div class="card-header flex-between">
                <span class="card-header-title">Line Items</span>
                <button type="button" class="btn btn-secondary btn-sm" id="btnAddLineItem">+ Add Item</button>
              </div>
              <div class="card-body p-0">
                <div class="table-responsive">
                  <table class="data-table" id="lineItemsTable">
                    <thead>
                      <tr>
                        <th style="width: 45%;">Description</th>
                        <th style="width: 15%;">Qty</th>
                        <th style="width: 20%;">Unit Price</th>
                        <th style="width: 15%;">Tax %</th>
                        <th style="width: 5%;"></th>
                      </tr>
                    </thead>
                    <tbody id="lineItemsTbody">
                      <!-- Rendered dynamically -->
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <!-- Notes & Payment Info -->
            <div class="card mt-4">
              <div class="card-header"><span class="card-header-title">Notes & Payment Details</span></div>
              <div class="card-body">
                <div class="form-group">
                  <label>Notes for Customer</label>
                  <textarea name="notes" class="form-input" rows="3" placeholder="Thank you for your business! Payment is due within payment terms."></textarea>
                </div>
              </div>
            </div>

          </div>

          <!-- Right Sidebar: Metadata & Financial Totals -->
          <div class="invoice-form-sidebar">
            
            <!-- Metadata Card -->
            <div class="card">
              <div class="card-header"><span class="card-header-title">Invoice Settings</span></div>
              <div class="card-body">
                <div class="form-group">
                  <label>Invoice Number *</label>
                  <input type="text" name="invoice_number" id="invNumberInput" class="form-input" value="${nextInvoiceNumber}" required />
                </div>
                <div class="form-group">
                  <label>Invoice Date *</label>
                  <input type="date" name="invoice_date" class="form-input" value="${new Date().toISOString().split('T')[0]}" required />
                </div>
                <div class="form-group">
                  <label>Due Date *</label>
                  <input type="date" name="due_date" class="form-input" value="${new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]}" required />
                </div>
                <div class="form-group">
                  <label>Payment Terms</label>
                  <select name="payment_terms" class="form-input">
                    <option value="Net 14" selected>Net 14 (14 Days)</option>
                    <option value="Net 30">Net 30 (30 Days)</option>
                    <option value="Net 7">Net 7 (7 Days)</option>
                    <option value="Due on Receipt">Due on Receipt</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>Design Template</label>
                  <select name="template_id" id="invTemplateSelect" class="form-input">
                    ${templates.map(t => `
                      <option value="${t.id}" ${t.is_default ? 'selected' : ''}>${t.name} ${t.is_default ? '(Default)' : ''}</option>
                    `).join('')}
                  </select>
                </div>
              </div>
            </div>

            <!-- Financial Calculations Card -->
            <div class="card mt-4">
              <div class="card-header"><span class="card-header-title">Totals Calculation</span></div>
              <div class="card-body">
                <div class="calc-row">
                  <span>Subtotal</span>
                  <strong id="calcSubtotal">$0.00</strong>
                </div>

                <div class="form-group mt-3">
                  <label>Tax Rate (%)</label>
                  <input type="number" step="0.1" name="tax_rate" id="invTaxRate" class="form-input" value="0" />
                </div>

                <div class="form-grid-2">
                  <div class="form-group">
                    <label>Discount Type</label>
                    <select name="discount_type" id="invDiscountType" class="form-input">
                      <option value="fixed">Fixed</option>
                      <option value="percentage">% Percent</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label>Discount Value</label>
                    <input type="number" step="0.01" name="discount_value" id="invDiscountVal" class="form-input" value="0" />
                  </div>
                </div>

                <div class="form-group">
                  <label>Shipping / Extra Fee</label>
                  <input type="number" step="0.01" name="shipping" id="invShipping" class="form-input" value="0" />
                </div>

                <div class="calc-divider"></div>

                <div class="calc-row grand-total-row">
                  <span>Grand Total</span>
                  <strong id="calcGrandTotal">$0.00</strong>
                </div>

                <div class="mt-4 flex-column gap-2">
                  <button type="submit" name="submit_action" value="sent" class="btn btn-primary btn-block">
                    💾 Create &amp; Finalize
                  </button>
                  <button type="submit" name="submit_action" value="draft" class="btn btn-secondary btn-block">
                    Save as Draft
                  </button>
                </div>

              </div>
            </div>

          </div>

        </div>
      </form>
    `;

    this.bindEvents(container);
    this.renderLineItems();
    this.recalculateTotals();

    // If edit mode, populate data
    if (isEdit) {
      await this.loadExistingInvoiceData(invoiceId);
    }
  },

  renderLineItems() {
    const tbody = document.getElementById('lineItemsTbody');
    if (!tbody) return;

    tbody.innerHTML = this.lineItems.map((item, idx) => `
      <tr data-index="${idx}">
        <td>
          <input type="text" class="form-input item-desc" value="${item.description}" placeholder="Description of service or item" required />
        </td>
        <td>
          <input type="number" step="0.01" min="0.01" class="form-input item-qty" value="${item.quantity}" required />
        </td>
        <td>
          <input type="number" step="0.01" min="0" class="form-input item-price" value="${item.unit_price}" required />
        </td>
        <td>
          <input type="number" step="0.1" min="0" class="form-input item-tax" value="${item.tax_rate || 0}" />
        </td>
        <td class="text-center">
          ${this.lineItems.length > 1 ? `<button type="button" class="btn-icon btn-icon-danger btn-remove-item" data-index="${idx}">✕</button>` : ''}
        </td>
      </tr>
    `).join('');

    // Bind row inputs
    tbody.querySelectorAll('tr').forEach(tr => {
      const idx = parseInt(tr.getAttribute('data-index'), 10);
      const descInput = tr.querySelector('.item-desc');
      const qtyInput = tr.querySelector('.item-qty');
      const priceInput = tr.querySelector('.item-price');
      const taxInput = tr.querySelector('.item-tax');
      const removeBtn = tr.querySelector('.btn-remove-item');

      const updateRow = () => {
        this.lineItems[idx].description = descInput.value;
        this.lineItems[idx].quantity = parseFloat(qtyInput.value) || 0;
        this.lineItems[idx].unit_price = parseFloat(priceInput.value) || 0;
        this.lineItems[idx].tax_rate = parseFloat(taxInput.value) || 0;
        this.recalculateTotals();
      };

      descInput.oninput = updateRow;
      qtyInput.oninput = updateRow;
      priceInput.oninput = updateRow;
      taxInput.oninput = updateRow;

      if (removeBtn) {
        removeBtn.onclick = () => {
          this.lineItems.splice(idx, 1);
          this.renderLineItems();
          this.recalculateTotals();
        };
      }
    });
  },

  recalculateTotals() {
    let subtotal = 0;
    this.lineItems.forEach(item => {
      subtotal += (item.quantity || 0) * (item.unit_price || 0);
    });

    const taxRate = parseFloat(document.getElementById('invTaxRate')?.value) || 0;
    const taxAmount = (subtotal * taxRate) / 100;

    const discountType = document.getElementById('invDiscountType')?.value || 'fixed';
    const discountVal = parseFloat(document.getElementById('invDiscountVal')?.value) || 0;
    const discountAmount = discountType === 'percentage' ? (subtotal * discountVal) / 100 : discountVal;

    const shipping = parseFloat(document.getElementById('invShipping')?.value) || 0;
    const grandTotal = Math.max(0, subtotal + taxAmount - discountAmount + shipping);

    const subEl = document.getElementById('calcSubtotal');
    const totEl = document.getElementById('calcGrandTotal');
    if (subEl) subEl.innerText = `$${subtotal.toFixed(2)}`;
    if (totEl) totEl.innerText = `$${grandTotal.toFixed(2)}`;
  },

  bindEvents(container) {
    const btnForm = container.querySelector('#btnModeForm');
    const btnParser = container.querySelector('#btnModeParser');
    const parserCard = container.querySelector('#rawParserCard');

    btnForm.onclick = () => {
      this.currentMode = 'form';
      btnForm.className = 'btn btn-sm btn-primary';
      btnParser.className = 'btn btn-sm btn-secondary';
      parserCard.classList.add('hidden');
    };

    btnParser.onclick = () => {
      this.currentMode = 'parser';
      btnParser.className = 'btn btn-sm btn-primary';
      btnForm.className = 'btn btn-sm btn-secondary';
      parserCard.classList.remove('hidden');
    };

    // Add Line Item
    const addBtn = container.querySelector('#btnAddLineItem');
    if (addBtn) {
      addBtn.onclick = () => {
        this.lineItems.push({ description: 'New Service Item', quantity: 1, unit_price: 100, tax_rate: 0 });
        this.renderLineItems();
        this.recalculateTotals();
      };
    }

    // Company selection changed -> update clients and templates
    const compSelect = container.querySelector('#invCompanySelect');
    if (compSelect) {
      compSelect.onchange = async () => {
        const cId = compSelect.value;
        const [cRes, tRes, nRes] = await Promise.all([
          API.getClients(cId),
          API.getTemplates(cId),
          API.getNextInvoiceNumber(cId).catch(() => null)
        ]);

        const clientSel = document.getElementById('invClientSelect');
        const tmplSel = document.getElementById('invTemplateSelect');
        const numInput = document.getElementById('invNumberInput');

        if (clientSel) {
          const list = cRes.data || [];
          clientSel.innerHTML = list.length > 0 
            ? list.map(c => `<option value="${c.id}">${c.name}</option>`).join('')
            : '<option value="">No clients found — click Quick Add</option>';
        }
        if (tmplSel) {
          const tList = tRes.data || [];
          tmplSel.innerHTML = tList.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
        }
        if (numInput && nRes && nRes.data) {
          numInput.value = nRes.data.next_invoice_number;
        }
      };
    }

    // Calculation inputs
    ['invTaxRate', 'invDiscountType', 'invDiscountVal', 'invShipping'].forEach(id => {
      const el = container.querySelector(`#${id}`);
      if (el) el.oninput = () => this.recalculateTotals();
    });

    // Quick Add Client
    const quickAddBtn = container.querySelector('#btnQuickAddClient');
    if (quickAddBtn) {
      quickAddBtn.onclick = () => {
        const compId = document.getElementById('invCompanySelect')?.value || State.currentCompanyId;
        ClientsView.openAddClientModal(compId, (newClient) => {
          const sel = document.getElementById('invClientSelect');
          if (sel) {
            const opt = document.createElement('option');
            opt.value = newClient.id;
            opt.innerText = newClient.name;
            opt.selected = true;
            sel.appendChild(opt);
          }
        });
      };
    }

    // Parser Presets & Run Parser
    container.querySelectorAll('.pill-btn[data-preset]').forEach(btn => {
      btn.onclick = () => {
        const p = btn.getAttribute('data-preset');
        const ta = document.getElementById('rawParserTextarea');
        if (!ta) return;
        if (p === 'freelance') {
          ta.value = `Customer: Crescent Tech Enterprises Ltd (finance@crescenttech.co.uk)\nAddress: 10 Finsbury Square, London, EC2A 1AF\nItems:\n- Frontend React SPA Architecture | 1 | £3200\n- Automated PDF Rendering Engine | 1 | £1800\n- IMAP & SMTP Integration | 1 | £1200\nDiscount: £300\nTax: 20%\nDue in 14 days`;
        } else if (p === 'agency') {
          ta.value = `Customer: Acme Global Corp (billing@acme.example)\nAddress: 1 Acme Plaza, London, EC1V 2NX\nItems:\n- Monthly Brand Retainer & Strategy | 1 | £4500\n- UI/UX Canvas Designer Sprint | 2 | £1500\nTax: 20%\nDue on Receipt`;
        } else {
          ta.value = `Customer: Quantum Enterprises (procurement@quantum.com)\nItems:\n- Enterprise MCP Protocol Server Rollout | 1 | $5000\n- Security Audit & Concurrency Tuning | 1 | $2500\nTax: 10%\nDiscount: 5%`;
        }
      };
    });

    const runParserBtn = container.querySelector('#btnRunParser');
    if (runParserBtn) {
      runParserBtn.onclick = () => this.runSmartParser();
    }

    // Form Submit
    const form = container.querySelector('#invoiceEditorForm');
    form.onsubmit = async (e) => {
      e.preventDefault();
      const submitAction = e.submitter ? e.submitter.value : 'sent';
      const formData = new FormData(form);
      const payload = Object.fromEntries(formData.entries());

      payload.status = submitAction;
      payload.items = this.lineItems;

      try {
        let res;
        if (this.invoiceId) {
          res = await API.updateInvoice(this.invoiceId, payload);
          State.notify('Invoice updated successfully!', 'success');
          window.location.hash = `#invoices/${this.invoiceId}`;
        } else {
          res = await API.createInvoice(payload);
          State.notify(`Invoice ${res.data.invoice_number} created successfully!`, 'success');
          window.location.hash = `#invoices/${res.data.invoice_id}`;
        }
      } catch (err) {
        State.notify(`Failed to save invoice: ${err.message}`, 'error');
      }
    };
  },

  runSmartParser() {
    const raw = document.getElementById('rawParserTextarea')?.value || '';
    if (!raw.trim()) {
      State.notify('Please paste invoice details into the text box first.', 'error');
      return;
    }

    const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
    const parsedItems = [];

    lines.forEach(line => {
      // Check customer
      const custMatch = line.match(/(?:Customer|Client|To):\s*([^(\n]+)(?:\(([^)]+)\))?/i);
      if (custMatch) {
        const clientName = custMatch[1].trim();
        // Match existing client if possible
        const clientSel = document.getElementById('invClientSelect');
        if (clientSel) {
          for (let opt of clientSel.options) {
            if (opt.text.toLowerCase().includes(clientName.toLowerCase())) {
              opt.selected = true;
              break;
            }
          }
        }
      }

      // Check tax
      const taxMatch = line.match(/Tax:\s*(\d+(?:\.\d+)?)\s*%/i);
      if (taxMatch) {
        const taxEl = document.getElementById('invTaxRate');
        if (taxEl) taxEl.value = taxMatch[1];
      }

      // Check discount
      const discMatch = line.match(/Discount:\s*[$£€]?\s*(\d+(?:\.\d+)?)/i);
      if (discMatch) {
        const discEl = document.getElementById('invDiscountVal');
        if (discEl) discEl.value = discMatch[1];
      }

      // Check line item bullet
      if (line.startsWith('-') || line.startsWith('•') || line.includes('|')) {
        const clean = line.replace(/^[-•*]\s*/, '');
        const parts = clean.split('|').map(p => p.trim());
        if (parts.length >= 2) {
          const desc = parts[0];
          const qty = parseFloat(parts[1]) || 1;
          const price = parseFloat((parts[2] || parts[1]).replace(/[^0-9.]/g, '')) || 100;
          parsedItems.push({ description: desc, quantity: qty, unit_price: price, tax_rate: 0 });
        }
      }
    });

    if (parsedItems.length > 0) {
      this.lineItems = parsedItems;
      this.renderLineItems();
      this.recalculateTotals();
      State.notify(`Parsed ${parsedItems.length} item(s) and populated form!`, 'success');
      // Switch back to form tab
      document.getElementById('btnModeForm')?.click();
    } else {
      State.notify('Parser processed text. Check fields below.', 'info');
    }
  },

  async loadExistingInvoiceData(invoiceId) {
    try {
      const res = await API.getInvoice(invoiceId);
      if (!res.success) return;
      const inv = res.data;

      // Populate form
      const numInput = document.getElementById('invNumberInput');
      if (numInput) numInput.value = inv.invoice_number;

      const clientSel = document.getElementById('invClientSelect');
      if (clientSel) clientSel.value = inv.client_id;

      const taxEl = document.getElementById('invTaxRate');
      if (taxEl) taxEl.value = inv.tax_rate;

      const discValEl = document.getElementById('invDiscountVal');
      if (discValEl) discValEl.value = inv.discount_value;

      const shipEl = document.getElementById('invShipping');
      if (shipEl) shipEl.value = inv.shipping;

      if (inv.items && inv.items.length > 0) {
        this.lineItems = inv.items.map(it => ({
          description: it.description,
          quantity: it.quantity,
          unit_price: it.unit_price,
          tax_rate: it.tax_rate
        }));
        this.renderLineItems();
      }
      this.recalculateTotals();
    } catch (e) {
      console.error('Error loading existing invoice:', e);
    }
  }
};

window.InvoiceFormView = InvoiceFormView;
