/**
 * Email Composer View for AutoInvoice Pro
 * Matches Reference Screenshot 3 with split-screen composer, dynamic variables,
 * live preview, and PDF attachment card.
 */
const EmailComposerView = {
  invoice: null,
  templates: [],
  selectedTemplateId: 'formal',
  isScheduled: false,

  async render(container, invoiceId) {
    try {
      const [invRes, tmplRes] = await Promise.all([
        API.getInvoice(invoiceId),
        API.getEmailTemplates()
      ]);

      if (!invRes.success || !invRes.data) {
        container.innerHTML = `<div class="alert alert-danger">Invoice not found</div>`;
        return;
      }

      this.invoice = invRes.data;
      this.templates = tmplRes.data || [];

      const inv = this.invoice;
      const initialTemplate = this.templates.find(t => t.id === this.selectedTemplateId) || this.templates[0];

      // Dynamic variable replacement helper
      const fillVariables = (text) => {
        return text
          .replace(/{{client_name}}/g, inv.client_name || 'Valued Client')
          .replace(/{{invoice_number}}/g, inv.invoice_number)
          .replace(/{{company_name}}/g, inv.company_name)
          .replace(/{{company_email}}/g, inv.company_email || 'billing@autoinvoice.pro')
          .replace(/{{total_amount}}/g, State.formatMoney(inv.total, inv.currency))
          .replace(/{{amount_due}}/g, State.formatMoney(inv.total - inv.amount_paid, inv.currency))
          .replace(/{{invoice_date}}/g, State.formatDate(inv.invoice_date))
          .replace(/{{due_date}}/g, State.formatDate(inv.due_date));
      };

      const initialSubject = fillVariables(initialTemplate ? initialTemplate.subject : `Invoice ${inv.invoice_number}`);
      const initialBody = fillVariables(initialTemplate ? initialTemplate.body : `Dear ${inv.client_name},\n\nPlease find attached invoice ${inv.invoice_number}.`);

      container.innerHTML = `
        <div class="view-header">
          <div>
            <a href="#invoices/${inv.id}" class="back-link">&larr; Back to Invoice ${inv.invoice_number}</a>
            <div class="view-title">Email Invoice to Client</div>
            <div class="view-subtitle">Send directly via configured SMTP or schedule automated future delivery</div>
          </div>
        </div>

        <div class="email-composer-split">
          
          <!-- Left Column: Form Fields & Template Selector -->
          <div class="composer-form-pane card">
            <div class="card-header"><span class="card-header-title">Message Configuration</span></div>
            <div class="card-body">
              
              <div class="form-group">
                <label>From Account (SMTP)</label>
                <div class="form-input form-input-readonly">
                  ${inv.company_name} &lt;${inv.company_email || 'billing@autoinvoice.pro'}&gt;
                </div>
              </div>

              <div class="form-grid-2">
                <div class="form-group">
                  <label>To (Client Email) *</label>
                  <input type="email" id="emailToInput" class="form-input" value="${inv.client_email || ''}" required placeholder="client@example.com" />
                </div>
                <div class="form-group">
                  <label>CC (Optional)</label>
                  <input type="text" id="emailCcInput" class="form-input" placeholder="accounts@example.com" />
                </div>
              </div>

              <div class="form-group">
                <label>Email Template &amp; Tone</label>
                <select id="emailTemplateSelect" class="form-input">
                  ${this.templates.map(t => `
                    <option value="${t.id}" ${t.id === this.selectedTemplateId ? 'selected' : ''}>
                      ${t.name}
                    </option>
                  `).join('')}
                </select>
              </div>

              <div class="form-group">
                <label>Subject Line *</label>
                <input type="text" id="emailSubjectInput" class="form-input" value="${initialSubject}" required />
              </div>

              <div class="form-group">
                <label>Email Body *</label>
                <textarea id="emailBodyInput" class="form-input" rows="10" required>${initialBody}</textarea>
              </div>

              <!-- Scheduled Send Toggle -->
              <div class="composer-schedule-box">
                <label class="checkbox-label">
                  <input type="checkbox" id="chkScheduleSend" />
                  <span><strong>Schedule for later delivery</strong> (Background Cron dispatch)</span>
                </label>
                <div id="scheduleTimeWrapper" class="mt-2 hidden">
                  <label class="text-xs text-muted">Select Date &amp; Time for automated sending:</label>
                  <input type="datetime-local" id="emailScheduledTime" class="form-input mt-1" />
                </div>
              </div>

              <div class="mt-4 flex-between">
                <a href="#invoices/${inv.id}" class="btn btn-secondary">Cancel</a>
                <button type="button" id="btnDispatchEmail" class="btn btn-primary">
                  🚀 Send Email Now
                </button>
              </div>

            </div>
          </div>

          <!-- Right Column: Live Email Preview & PDF Attachment Card -->
          <div class="composer-preview-pane">
            
            <!-- Live Email Preview Card -->
            <div class="card email-preview-card">
              <div class="card-header flex-between">
                <span class="card-header-title">Live Email Preview</span>
                <span class="badge badge-accent">Recipient View</span>
              </div>
              <div class="card-body">
                <div class="preview-email-header">
                  <div><strong>Subject:</strong> <span id="prevSubject">${initialSubject}</span></div>
                  <div class="text-xs text-muted mt-1">
                    <strong>From:</strong> ${inv.company_name} &lt;${inv.company_email || 'billing@autoinvoice.pro'}&gt;
                  </div>
                  <div class="text-xs text-muted">
                    <strong>To:</strong> <span id="prevTo">${inv.client_email || 'client@example.com'}</span>
                  </div>
                </div>

                <div class="preview-email-divider"></div>

                <div class="preview-email-body" id="prevBody">
                  ${initialBody.replace(/\n/g, '<br/>')}
                </div>
              </div>
            </div>

            <!-- PDF Attachment Card -->
            <div class="card attachment-card mt-4">
              <div class="card-header"><span class="card-header-title">Attached File (1)</span></div>
              <div class="card-body">
                <div class="attachment-pill">
                  <div class="attachment-icon">📄</div>
                  <div class="attachment-meta">
                    <strong>Invoice-${inv.invoice_number}.pdf</strong>
                    <span>High-resolution A4 invoice document • Auto-generated</span>
                  </div>
                  <button type="button" class="btn btn-ghost btn-sm" onclick="InvoicesView.triggerPdfDownload('${inv.id}')">
                    Preview PDF
                  </button>
                </div>
              </div>
            </div>

          </div>

        </div>
      `;

      this.bindEvents(container);

    } catch (err) {
      console.error('Error rendering email composer:', err);
      container.innerHTML = `<div class="alert alert-danger">Error: ${err.message}</div>`;
    }
  },

  bindEvents(container) {
    const toInput = container.querySelector('#emailToInput');
    const subjectInput = container.querySelector('#emailSubjectInput');
    const bodyInput = container.querySelector('#emailBodyInput');
    const tmplSelect = container.querySelector('#emailTemplateSelect');
    const chkSchedule = container.querySelector('#chkScheduleSend');
    const schedWrap = container.querySelector('#scheduleTimeWrapper');
    const sendBtn = container.querySelector('#btnDispatchEmail');

    const prevTo = container.querySelector('#prevTo');
    const prevSubject = container.querySelector('#prevSubject');
    const prevBody = container.querySelector('#prevBody');

    // Live update preview
    toInput.oninput = () => { if (prevTo) prevTo.innerText = toInput.value || 'client@example.com'; };
    subjectInput.oninput = () => { if (prevSubject) prevSubject.innerText = subjectInput.value; };
    bodyInput.oninput = () => { if (prevBody) prevBody.innerHTML = bodyInput.value.replace(/\n/g, '<br/>'); };

    // Template change
    tmplSelect.onchange = () => {
      const selectedId = tmplSelect.value;
      const tmpl = this.templates.find(t => t.id === selectedId);
      if (tmpl && this.invoice) {
        const inv = this.invoice;
        const fill = (text) => text
          .replace(/{{client_name}}/g, inv.client_name || 'Valued Client')
          .replace(/{{invoice_number}}/g, inv.invoice_number)
          .replace(/{{company_name}}/g, inv.company_name)
          .replace(/{{company_email}}/g, inv.company_email || 'billing@autoinvoice.pro')
          .replace(/{{total_amount}}/g, State.formatMoney(inv.total, inv.currency))
          .replace(/{{amount_due}}/g, State.formatMoney(inv.total - inv.amount_paid, inv.currency))
          .replace(/{{invoice_date}}/g, State.formatDate(inv.invoice_date))
          .replace(/{{due_date}}/g, State.formatDate(inv.due_date));

        subjectInput.value = fill(tmpl.subject);
        bodyInput.value = fill(tmpl.body);
        prevSubject.innerText = subjectInput.value;
        prevBody.innerHTML = bodyInput.value.replace(/\n/g, '<br/>');
      }
    };

    // Schedule Send Toggle
    chkSchedule.onchange = () => {
      this.isScheduled = chkSchedule.checked;
      schedWrap.classList.toggle('hidden', !this.isScheduled);
      sendBtn.innerText = this.isScheduled ? '📅 Schedule Email Delivery' : '🚀 Send Email Now';
      if (this.isScheduled) {
        // Default to tomorrow 9am
        const tomorrow = new Date(Date.now() + 86400000);
        tomorrow.setHours(9, 0, 0, 0);
        const dtInput = container.querySelector('#emailScheduledTime');
        if (dtInput) dtInput.value = tomorrow.toISOString().slice(0, 16);
      }
    };

    // Dispatch button
    sendBtn.onclick = async () => {
      const to = toInput.value.trim();
      const subject = subjectInput.value.trim();
      const body = bodyInput.value.trim();
      const cc = container.querySelector('#emailCcInput')?.value.trim();

      if (!to || !subject || !body) {
        State.notify('Recipient, subject, and body are required.', 'error');
        return;
      }

      sendBtn.disabled = true;
      sendBtn.innerText = 'Dispatching...';

      let scheduled_for = null;
      if (this.isScheduled) {
        const schedVal = container.querySelector('#emailScheduledTime')?.value;
        if (!schedVal) {
          State.notify('Please select scheduled date and time.', 'error');
          sendBtn.disabled = false;
          sendBtn.innerText = '📅 Schedule Email Delivery';
          return;
        }
        scheduled_for = new Date(schedVal).toISOString();
      }

      try {
        const payload = {
          company_id: this.invoice.company_id,
          invoice_id: this.invoice.id,
          to_email: to,
          cc,
          subject,
          body,
          scheduled_for
        };

        const res = await API.sendEmail(payload);
        if (this.isScheduled) {
          State.notify(`Email scheduled for ${new Date(scheduled_for).toLocaleString()}!`, 'success');
        } else {
          State.notify('Email successfully dispatched to client!', 'success');
        }
        window.location.hash = `#invoices/${this.invoice.id}`;
      } catch (err) {
        State.notify(`Error sending email: ${err.message}`, 'error');
        sendBtn.disabled = false;
        sendBtn.innerText = this.isScheduled ? '📅 Schedule Email Delivery' : '🚀 Send Email Now';
      }
    };
  }
};

window.EmailComposerView = EmailComposerView;
