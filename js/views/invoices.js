/**
 * Invoices List and Invoice Details Views for AutoInvoice Pro
 * Matches Reference Screenshot 4 for Invoice Details with full actions, payments, and communication timeline.
 */
const InvoicesView = {
  activeStatusFilter: 'all',
  searchQuery: '',

  // --- Render Invoices List ---
  async renderList(container) {
    const companyId = State.currentCompanyId;

    container.innerHTML = `
      <div class="view-header">
        <div>
          <div class="view-title">Invoices</div>
          <div class="view-subtitle">Manage, dispatch, and track settlements across companies</div>
        </div>
        <div class="view-actions">
          <a href="#invoices/new" class="btn btn-primary">➕ New Invoice</a>
        </div>
      </div>

      <!-- Filters & Search Toolbar -->
      <div class="toolbar-card">
        <div class="status-tab-bar">
          <button class="status-tab ${this.activeStatusFilter === 'all' ? 'active' : ''}" data-status="all">All</button>
          <button class="status-tab ${this.activeStatusFilter === 'draft' ? 'active' : ''}" data-status="draft">Drafts</button>
          <button class="status-tab ${this.activeStatusFilter === 'sent' ? 'active' : ''}" data-status="sent">Sent</button>
          <button class="status-tab ${this.activeStatusFilter === 'partially_paid' ? 'active' : ''}" data-status="partially_paid">Partially Paid</button>
          <button class="status-tab ${this.activeStatusFilter === 'paid' ? 'active' : ''}" data-status="paid">Paid</button>
          <button class="status-tab ${this.activeStatusFilter === 'overdue' ? 'active' : ''}" data-status="overdue">Overdue</button>
        </div>
        <div class="toolbar-search">
          <input type="text" id="invoiceSearchInput" class="form-input search-input" placeholder="Search by invoice # or client..." value="${this.searchQuery}" />
        </div>
      </div>

      <!-- Invoices Table -->
      <div class="card">
        <div class="card-body p-0">
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Company</th>
                  <th>Client</th>
                  <th>Date</th>
                  <th>Due Date</th>
                  <th>Total</th>
                  <th>Paid</th>
                  <th>Balance</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="invoicesListTbody">
                <tr><td colspan="10" class="text-center py-4">Loading invoices...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    this.bindListEvents(container);
    await this.loadInvoicesList();
  },

  bindListEvents(container) {
    container.querySelectorAll('.status-tab').forEach(tab => {
      tab.onclick = () => {
        container.querySelectorAll('.status-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.activeStatusFilter = tab.getAttribute('data-status');
        this.loadInvoicesList();
      };
    });

    const searchInput = container.querySelector('#invoiceSearchInput');
    let debounce;
    searchInput.oninput = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        this.searchQuery = searchInput.value.trim();
        this.loadInvoicesList();
      }, 300);
    };
  },

  async loadInvoicesList() {
    const tbody = document.getElementById('invoicesListTbody');
    if (!tbody) return;

    try {
      const params = {};
      if (State.currentCompanyId !== 'all') params.company_id = State.currentCompanyId;
      if (this.activeStatusFilter !== 'all') params.status = this.activeStatusFilter;
      if (this.searchQuery) params.search = this.searchQuery;

      const res = await API.getInvoices(params);
      const invoices = res.data || [];

      if (invoices.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" class="text-center py-5 text-muted">No invoices found matching criteria.</td></tr>`;
        return;
      }

      tbody.innerHTML = invoices.map(inv => {
        const balance = Math.max(0, inv.total - inv.amount_paid);
        return `
          <tr>
            <td>
              <a href="#invoices/${inv.id}" class="invoice-link"><strong>${inv.invoice_number}</strong></a>
            </td>
            <td><span class="company-tag">${inv.company_name}</span></td>
            <td>
              <div><strong>${inv.client_name}</strong></div>
              <div class="text-muted text-xs">${inv.client_email || ''}</div>
            </td>
            <td>${State.formatDate(inv.invoice_date)}</td>
            <td>${State.formatDate(inv.due_date)}</td>
            <td><strong>${State.formatMoney(inv.total, inv.currency)}</strong></td>
            <td>${State.formatMoney(inv.amount_paid, inv.currency)}</td>
            <td>
              <strong class="${balance > 0 ? 'text-danger' : 'text-success'}">${State.formatMoney(balance, inv.currency)}</strong>
            </td>
            <td>
              <span class="status-pill status-${inv.status}">${inv.status.replace('_', ' ')}</span>
            </td>
            <td>
              <div class="table-actions">
                <a href="#invoices/${inv.id}" class="btn-icon" title="View Details">👁️</a>
                <a href="#invoices/${inv.id}/email" class="btn-icon" title="Email Client">✉️</a>
                <button class="btn-icon" title="Download PDF" onclick="InvoicesView.triggerPdfDownload('${inv.id}')">📥</button>
                <button class="btn-icon" title="Duplicate" onclick="InvoicesView.duplicateInvoice('${inv.id}')">📋</button>
                <button class="btn-icon btn-icon-danger" title="Delete" onclick="InvoicesView.deleteInvoice('${inv.id}')">🗑️</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.error('Error loading invoices:', err);
      tbody.innerHTML = `<tr><td colspan="10" class="text-center py-4 text-danger">Failed to load invoices: ${err.message}</td></tr>`;
    }
  },

  // --- Render Invoice Details Page (Screenshot 4 Reference) ---
  async renderDetails(container, invoiceId) {
    try {
      const res = await API.getInvoice(invoiceId);
      if (!res.success || !res.data) {
        container.innerHTML = `<div class="empty-state"><h3>Invoice not found</h3><a href="#invoices" class="btn btn-secondary">Back to Invoices</a></div>`;
        return;
      }

      const inv = res.data;
      const balance = Math.max(0, inv.total - inv.amount_paid);

      container.innerHTML = `
        <!-- Top Details Header & Action Bar -->
        <div class="invoice-details-header">
          <div class="details-header-info">
            <a href="#invoices" class="back-link">&larr; Back to Invoices</a>
            <div class="details-title-row">
              <h1 class="details-invoice-number">${inv.invoice_number}</h1>
              <span class="status-pill status-${inv.status}">${inv.status.replace('_', ' ')}</span>
              <span class="company-tag">${inv.company_name}</span>
            </div>
            <div class="text-muted text-sm">Issued to <strong>${inv.client_name}</strong> on ${State.formatDate(inv.invoice_date)}</div>
          </div>

          <div class="details-header-actions">
            <button class="btn btn-primary" onclick="InvoicesView.triggerPdfDownload('${inv.id}')">📥 Download PDF</button>
            <a href="#invoices/${inv.id}/email" class="btn btn-accent">✉️ Send Email</a>
            <button class="btn btn-secondary" onclick="InvoicesView.openRecordPaymentModal('${inv.id}', ${balance})">💳 Record Payment</button>
            
            <div class="dropdown">
              <button class="btn btn-ghost" id="btnDetailsMore">••• More</button>
              <div class="dropdown-menu" id="detailsMoreMenu" style="display: none;">
                ${inv.status !== 'paid' ? `<button class="dropdown-item" onclick="InvoicesView.markStatus('${inv.id}', 'paid')">✓ Mark as Paid</button>` : ''}
                ${inv.status === 'draft' ? `<button class="dropdown-item" onclick="InvoicesView.markStatus('${inv.id}', 'sent')">✓ Mark as Sent</button>` : ''}
                <a href="#invoices/${inv.id}/edit" class="dropdown-item">✏️ Edit Invoice</a>
                <button class="dropdown-item" onclick="InvoicesView.duplicateInvoice('${inv.id}')">📋 Duplicate</button>
                <div class="dropdown-divider"></div>
                <button class="dropdown-item text-danger" onclick="InvoicesView.deleteInvoice('${inv.id}')">🗑️ Delete Invoice</button>
              </div>
            </div>
          </div>
        </div>

        <!-- 2-Column Layout: Left = Document Preview, Right = Summary & Payments -->
        <div class="invoice-details-grid">
          
          <!-- Left Column: Rendered A4 Invoice View -->
          <div class="invoice-preview-wrapper" id="invoicePrintTarget">
            <div class="invoice-sheet">
              
              <!-- Company Header -->
              <div class="sheet-header">
                <div class="sheet-company-meta">
                  <h2 class="sheet-company-name">${inv.company_name}</h2>
                  <div class="sheet-text">${(inv.company_address || '').replace(/\n/g, '<br/>')}</div>
                  <div class="sheet-text">${inv.company_email || ''}</div>
                  <div class="sheet-text">${inv.company_phone || ''}</div>
                </div>
                <div class="sheet-invoice-meta">
                  <div class="sheet-badge">INVOICE</div>
                  <div class="sheet-inv-num"><strong># ${inv.invoice_number}</strong></div>
                  <div class="sheet-meta-row"><span>Date:</span> <strong>${State.formatDate(inv.invoice_date)}</strong></div>
                  <div class="sheet-meta-row"><span>Due Date:</span> <strong>${State.formatDate(inv.due_date)}</strong></div>
                  <div class="sheet-meta-row"><span>Terms:</span> <strong>${inv.payment_terms || 'Net 14'}</strong></div>
                </div>
              </div>

              <!-- Bill To & Client Info -->
              <div class="sheet-bill-to">
                <div class="bill-to-label">BILLED TO:</div>
                <div class="bill-to-name">${inv.client_name}</div>
                ${inv.client_business_name ? `<div class="bill-to-business">${inv.client_business_name}</div>` : ''}
                <div class="sheet-text">${(inv.client_address || '').replace(/\n/g, '<br/>')}</div>
                <div class="sheet-text">${inv.client_email || ''}</div>
                ${inv.client_tax_id ? `<div class="sheet-text text-xs">VAT/Tax ID: ${inv.client_tax_id}</div>` : ''}
              </div>

              <!-- Line Items Table -->
              <table class="sheet-items-table">
                <thead>
                  <tr>
                    <th>Item Description</th>
                    <th class="text-center">Qty</th>
                    <th class="text-right">Unit Price</th>
                    <th class="text-right">Tax</th>
                    <th class="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${(inv.items || []).map(item => `
                    <tr>
                      <td><strong>${item.description}</strong></td>
                      <td class="text-center">${item.quantity}</td>
                      <td class="text-right">${State.formatMoney(item.unit_price, inv.currency)}</td>
                      <td class="text-right">${item.tax_rate ? item.tax_rate + '%' : '0%'}</td>
                      <td class="text-right"><strong>${State.formatMoney(item.amount, inv.currency)}</strong></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>

              <!-- Totals Breakdown -->
              <div class="sheet-totals-section">
                <div class="sheet-payment-info">
                  <div class="totals-label">PAYMENT INFORMATION:</div>
                  <div class="sheet-text"><strong>Bank:</strong> ${inv.bank_name || 'N/A'}</div>
                  <div class="sheet-text"><strong>Account Name:</strong> ${inv.account_name || inv.company_name}</div>
                  <div class="sheet-text"><strong>Account No:</strong> ${inv.account_number || 'N/A'}</div>
                  ${inv.iban ? `<div class="sheet-text"><strong>IBAN:</strong> ${inv.iban}</div>` : ''}
                  ${inv.swift ? `<div class="sheet-text"><strong>SWIFT / BIC:</strong> ${inv.swift}</div>` : ''}
                </div>

                <div class="sheet-totals-box">
                  <div class="total-row"><span>Subtotal</span> <span>${State.formatMoney(inv.subtotal, inv.currency)}</span></div>
                  ${inv.tax_amount > 0 ? `<div class="total-row"><span>Tax (${inv.tax_rate}%)</span> <span>+${State.formatMoney(inv.tax_amount, inv.currency)}</span></div>` : ''}
                  ${inv.discount_amount > 0 ? `<div class="total-row text-success"><span>Discount</span> <span>-${State.formatMoney(inv.discount_amount, inv.currency)}</span></div>` : ''}
                  ${inv.shipping > 0 ? `<div class="total-row"><span>Shipping / Fee</span> <span>+${State.formatMoney(inv.shipping, inv.currency)}</span></div>` : ''}
                  <div class="total-row grand-total"><span>Total</span> <span>${State.formatMoney(inv.total, inv.currency)}</span></div>
                  <div class="total-row"><span>Amount Paid</span> <span class="text-success">${State.formatMoney(inv.amount_paid, inv.currency)}</span></div>
                  <div class="total-row balance-due"><span>Balance Due</span> <span>${State.formatMoney(balance, inv.currency)}</span></div>
                </div>
              </div>

              <!-- Notes & Footer -->
              ${inv.notes ? `
                <div class="sheet-notes">
                  <div class="totals-label">NOTES & TERMS:</div>
                  <p class="sheet-text">${inv.notes.replace(/\n/g, '<br/>')}</p>
                </div>
              ` : ''}

              <div class="sheet-footer">
                Thank you for your business! Please quote invoice number ${inv.invoice_number} upon payment.
              </div>
            </div>
          </div>

          <!-- Right Column: Sidebar / Payment Timeline & Emails -->
          <div class="invoice-details-sidebar">
            
            <!-- Financial Card -->
            <div class="card">
              <div class="card-header"><span class="card-header-title">Financial Summary</span></div>
              <div class="card-body">
                <div class="summary-metric">
                  <span class="text-muted">Total Invoiced</span>
                  <h3>${State.formatMoney(inv.total, inv.currency)}</h3>
                </div>
                <div class="summary-metric mt-3">
                  <span class="text-muted">Paid to Date</span>
                  <h4 class="text-success">${State.formatMoney(inv.amount_paid, inv.currency)}</h4>
                </div>
                <div class="summary-metric mt-3">
                  <span class="text-muted">Balance Due</span>
                  <h4 class="${balance > 0 ? 'text-danger' : 'text-success'}">${State.formatMoney(balance, inv.currency)}</h4>
                </div>
                <button class="btn btn-primary btn-block mt-3" onclick="InvoicesView.openRecordPaymentModal('${inv.id}', ${balance})">
                  + Record Payment
                </button>
              </div>
            </div>

            <!-- Payment Transactions Card -->
            <div class="card mt-4">
              <div class="card-header flex-between">
                <span class="card-header-title">Payment History</span>
                <span class="badge badge-count">${(inv.payments || []).length}</span>
              </div>
              <div class="card-body p-0">
                ${(inv.payments && inv.payments.length > 0) ? `
                  <div class="payment-timeline">
                    ${inv.payments.map(p => `
                      <div class="timeline-item">
                        <div class="timeline-dot">✓</div>
                        <div class="timeline-content">
                          <div class="flex-between">
                            <strong>${State.formatMoney(p.amount, inv.currency)}</strong>
                            <span class="text-muted text-xs">${State.formatDate(p.payment_date)}</span>
                          </div>
                          <div class="text-xs text-muted">${p.payment_method} ${p.reference_number ? `• Ref: ${p.reference_number}` : ''}</div>
                          ${p.notes ? `<div class="text-xs mt-1">"${p.notes}"</div>` : ''}
                        </div>
                      </div>
                    `).join('')}
                  </div>
                ` : `
                  <div class="p-3 text-center text-muted text-sm">No payments recorded yet.</div>
                `}
              </div>
            </div>

            <!-- Email Activity Card -->
            <div class="card mt-4">
              <div class="card-header flex-between">
                <span class="card-header-title">Communications</span>
                <a href="#invoices/${inv.id}/email" class="text-xs">Send Email &rarr;</a>
              </div>
              <div class="card-body" id="invoiceEmailTimeline">
                <div class="text-center text-muted text-sm">Loading activity...</div>
              </div>
            </div>

          </div>
        </div>
      `;

      // Load email history for this invoice
      this.loadEmailActivity(inv.id);

      // Bind dropdown
      const moreBtn = container.querySelector('#btnDetailsMore');
      const moreMenu = container.querySelector('#detailsMoreMenu');
      if (moreBtn && moreMenu) {
        moreBtn.onclick = (e) => {
          e.stopPropagation();
          moreMenu.style.display = moreMenu.style.display === 'block' ? 'none' : 'block';
        };
        document.addEventListener('click', () => { moreMenu.style.display = 'none'; }, { once: true });
      }

    } catch (err) {
      console.error('Error rendering invoice details:', err);
      container.innerHTML = `<div class="alert alert-danger">Error: ${err.message}</div>`;
    }
  },

  async loadEmailActivity(invoiceId) {
    try {
      const res = await API.getEmailMessages({ invoice_id: invoiceId });
      const el = document.getElementById('invoiceEmailTimeline');
      if (!el) return;

      const msgs = res.data || [];
      if (msgs.length === 0) {
        el.innerHTML = `<div class="text-center text-muted text-sm">No emails sent for this invoice yet.</div>`;
        return;
      }

      el.innerHTML = `
        <div class="email-mini-list">
          ${msgs.map(m => `
            <div class="email-mini-item">
              <div class="flex-between">
                <strong class="text-xs">${m.direction === 'outgoing' ? 'Sent' : 'Received'}: ${m.subject}</strong>
                <span class="status-pill status-${m.status} text-xs">${m.status}</span>
              </div>
              <div class="text-xs text-muted">${m.to_email} • ${State.formatDate(m.sent_at || m.created_at)}</div>
            </div>
          `).join('')}
        </div>
      `;
    } catch (err) {
      console.error('Error loading email activity:', err);
    }
  },

  // --- Record Payment Modal ---
  openRecordPaymentModal(invoiceId, balance) {
    let modal = document.getElementById('recordPaymentModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'recordPaymentModal';
      modal.className = 'modal-backdrop';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="modal-dialog modal-sm">
        <div class="modal-header">
          <div class="modal-title">💳 Record Payment</div>
          <button class="modal-close" onclick="document.getElementById('recordPaymentModal').style.display='none'">&times;</button>
        </div>
        <form id="recordPaymentForm">
          <div class="modal-body">
            <div class="form-group">
              <label>Payment Amount *</label>
              <input type="number" step="0.01" min="0.01" name="amount" class="form-input" value="${balance > 0 ? balance : 100}" required />
              <span class="text-xs text-muted">Remaining Balance: ${balance.toFixed(2)}</span>
            </div>
            <div class="form-group">
              <label>Payment Date *</label>
              <input type="date" name="payment_date" class="form-input" value="${new Date().toISOString().split('T')[0]}" required />
            </div>
            <div class="form-group">
              <label>Payment Method</label>
              <select name="payment_method" class="form-input">
                <option value="Bank Transfer" selected>Bank Transfer (BACS / Wire)</option>
                <option value="Credit / Debit Card">Credit / Debit Card</option>
                <option value="Stripe">Stripe</option>
                <option value="PayPal">PayPal</option>
                <option value="Cash">Cash</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div class="form-group">
              <label>Reference / Transaction Number</label>
              <input type="text" name="reference_number" class="form-input" placeholder="e.g. TXN-99201" />
            </div>
            <div class="form-group">
              <label>Internal Notes</label>
              <input type="text" name="notes" class="form-input" placeholder="Optional settlement note" />
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="document.getElementById('recordPaymentModal').style.display='none'">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Payment</button>
          </div>
        </form>
      </div>
    `;

    modal.style.display = 'flex';

    modal.querySelector('#recordPaymentForm').onsubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const data = Object.fromEntries(formData.entries());
      data.invoice_id = invoiceId;

      try {
        await API.recordPayment(data);
        State.notify('Payment recorded successfully!', 'success');
        modal.style.display = 'none';
        // Reload details view
        InvoicesView.renderDetails(document.getElementById('appView'), invoiceId);
      } catch (err) {
        State.notify(`Error recording payment: ${err.message}`, 'error');
      }
    };
  },

  async markStatus(invoiceId, status) {
    try {
      await API.updateInvoiceStatus(invoiceId, status);
      State.notify(`Invoice marked as ${status}!`, 'success');
      this.renderDetails(document.getElementById('appView'), invoiceId);
    } catch (err) {
      State.notify(err.message, 'error');
    }
  },

  async duplicateInvoice(invoiceId) {
    try {
      const res = await API.duplicateInvoice(invoiceId);
      State.notify(`Invoice duplicated as ${res.data.invoice_number}!`, 'success');
      window.location.hash = `#invoices/${res.data.invoice_id}`;
    } catch (err) {
      State.notify(err.message, 'error');
    }
  },

  async deleteInvoice(invoiceId) {
    if (!confirm('Are you sure you want to permanently delete this invoice? This action cannot be undone.')) return;
    try {
      await API.deleteInvoice(invoiceId);
      State.notify('Invoice deleted successfully.', 'info');
      window.location.hash = '#invoices';
    } catch (err) {
      State.notify(err.message, 'error');
    }
  },

  triggerPdfDownload(invoiceId) {
    // Check if on details page with rendered sheet
    const target = document.getElementById('invoicePrintTarget');
    if (target && window.html2pdf) {
      const invNumEl = document.querySelector('.sheet-inv-num');
      const invNum = invNumEl ? invNumEl.innerText.replace(/[^a-zA-Z0-9_-]/g, '') : 'Invoice';
      const opt = {
        margin: [10, 10, 10, 10],
        filename: `${invNum}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };
      html2pdf().set(opt).from(target).save();
      State.notify('Generating and downloading A4 PDF...', 'success');
    } else {
      window.location.hash = `#invoices/${invoiceId}`;
      setTimeout(() => this.triggerPdfDownload(invoiceId), 800);
    }
  }
};

window.InvoicesView = InvoicesView;
