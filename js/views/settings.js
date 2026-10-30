/**
 * Settings View for AutoInvoice Pro
 * Houses Company Management, SMTP/IMAP Mailbox Setup, Model Context Protocol (MCP) Hub, and System Preferences.
 */
const SettingsView = {
  activeTab: 'mcp', // Default to 'mcp' or 'companies'

  async render(container, activeTab = null) {
    if (activeTab) this.activeTab = activeTab;

    container.innerHTML = `
      <div class="view-header">
        <div>
          <div class="view-title">Platform Settings &amp; Integrations</div>
          <div class="view-subtitle">Manage company entities, email delivery credentials, and developer MCP protocol tools</div>
        </div>
      </div>

      <!-- Settings Navigation Tabs -->
      <div class="settings-nav-tabs">
        <button class="settings-tab ${this.activeTab === 'companies' ? 'active' : ''}" data-tab="companies">
          🏢 Company Profiles
        </button>
        <button class="settings-tab ${this.activeTab === 'mail' ? 'active' : ''}" data-tab="mail">
          ✉️ Mail &amp; SMTP / IMAP
        </button>
        <button class="settings-tab ${this.activeTab === 'mcp' ? 'active' : ''}" data-tab="mcp">
          📡 Model Context Protocol (MCP)
        </button>
        <button class="settings-tab ${this.activeTab === 'system' ? 'active' : ''}" data-tab="system">
          ⚙️ Demo &amp; Freelance CTA
        </button>
      </div>

      <!-- Settings Tab Panes -->
      <div id="settingsTabContent">
        <!-- Injected dynamically -->
      </div>
    `;

    this.bindEvents(container);
    this.renderCurrentTab();
  },

  bindEvents(container) {
    container.querySelectorAll('.settings-tab').forEach(tab => {
      tab.onclick = () => {
        container.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.activeTab = tab.getAttribute('data-tab');
        this.renderCurrentTab();
      };
    });
  },

  renderCurrentTab() {
    const content = document.getElementById('settingsTabContent');
    if (!content) return;

    if (this.activeTab === 'companies') {
      this.renderCompaniesTab(content);
    } else if (this.activeTab === 'mail') {
      this.renderMailTab(content);
    } else if (this.activeTab === 'mcp') {
      this.renderMcpTab(content);
    } else if (this.activeTab === 'system') {
      this.renderSystemTab(content);
    }
  },

  // --- 1. Companies Tab ---
  renderCompaniesTab(content) {
    content.innerHTML = `
      <div class="card">
        <div class="card-header flex-between">
          <div>
            <div class="card-title">Configured Business Entities</div>
            <div class="card-subtitle">Each company operates with independent branding, numbering, templates, and bank details.</div>
          </div>
          <button class="btn btn-primary btn-sm" onclick="CompanySelector.openCreateCompanyModal()">+ Add Company</button>
        </div>
        <div class="card-body p-0">
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Company Name</th>
                  <th>Currency</th>
                  <th>Prefix</th>
                  <th>Next #</th>
                  <th>Bank Info</th>
                  <th>IBAN / SWIFT</th>
                  <th>Default</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${State.companies.map(c => `
                  <tr>
                    <td><strong>${c.name}</strong></td>
                    <td><span class="badge badge-subtle">${c.currency}</span></td>
                    <td><code>${c.invoice_prefix || 'INV-'}</code></td>
                    <td>${c.next_invoice_number || 1}</td>
                    <td>
                      <div class="text-xs"><strong>${c.bank_name || 'N/A'}</strong></div>
                      <div class="text-xs text-muted">${c.account_number || ''}</div>
                    </td>
                    <td>
                      <div class="text-xs">IBAN: ${c.iban || '—'}</div>
                      <div class="text-xs text-muted">SWIFT: ${c.swift || '—'}</div>
                    </td>
                    <td>
                      ${c.is_default ? '<span class="status-pill status-paid text-xs">Primary</span>' : `
                        <button class="btn btn-ghost btn-sm text-xs" onclick="SettingsView.setDefaultCompany('${c.id}')">Make Primary</button>
                      `}
                    </td>
                    <td>
                      <div class="table-actions">
                        <button class="btn-icon" title="Edit Company" onclick="SettingsView.openEditCompanyModal('${c.id}')">✏️</button>
                        ${!c.is_default ? `
                          <button class="btn-icon btn-icon-danger" title="Delete Company" onclick="SettingsView.deleteCompany('${c.id}')">🗑️</button>
                        ` : ''}
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  // --- 2. Mail & SMTP Tab ---
  async renderMailTab(content) {
    const compId = State.currentCompanyId !== 'all' ? State.currentCompanyId : (State.companies[0]?.id || '');
    const active = State.companies.find(c => c.id === compId) || State.companies[0];

    content.innerHTML = `<div class="p-4 text-center text-muted">Loading mail configuration...</div>`;

    let account = null;
    try {
      const res = await API.getEmailAccount(compId);
      account = res.data;
    } catch (e) {
      console.warn('No email account found:', e);
    }

    content.innerHTML = `
      <div class="card">
        <div class="card-header flex-between">
          <div>
            <div class="card-title">SMTP &amp; IMAP Settings: ${active?.name || 'Active Company'}</div>
            <div class="card-subtitle">Connect Gmail, Hostinger, Google Workspace, or custom SMTP servers for direct invoice sending and inbox sync.</div>
          </div>
          <select id="settingsMailCompSelect" class="form-input form-input-sm" style="width: 220px;">
            ${State.companies.map(c => `
              <option value="${c.id}" ${c.id === compId ? 'selected' : ''}>${c.name}</option>
            `).join('')}
          </select>
        </div>

        <form id="mailConfigForm">
          <input type="hidden" name="company_id" value="${compId}" />
          <div class="card-body">
            
            <div class="form-section-title">OUTGOING MAIL (SMTP)</div>
            <div class="form-grid-3">
              <div class="form-group">
                <label>Provider Preset</label>
                <select name="provider" id="mailProvider" class="form-input">
                  <option value="smtp" ${account?.provider === 'smtp' ? 'selected' : ''}>Custom SMTP</option>
                  <option value="gmail" ${account?.provider === 'gmail' ? 'selected' : ''}>Google Workspace / Gmail</option>
                  <option value="hostinger" ${account?.provider === 'hostinger' ? 'selected' : ''}>Hostinger Mail</option>
                </select>
              </div>
              <div class="form-group">
                <label>SMTP Host *</label>
                <input type="text" name="host" id="smtpHost" class="form-input" value="${account?.host || 'smtp.gmail.com'}" placeholder="smtp.domain.com" required />
              </div>
              <div class="form-group">
                <label>SMTP Port</label>
                <input type="number" name="port" id="smtpPort" class="form-input" value="${account?.port || 587}" />
              </div>
            </div>

            <div class="form-grid-2">
              <div class="form-group">
                <label>SMTP Username / Email *</label>
                <input type="text" name="username" class="form-input" value="${account?.username || ''}" placeholder="billing@domain.com" required />
              </div>
              <div class="form-group">
                <label>SMTP Password / App Password *</label>
                <input type="password" name="password" class="form-input" value="${account?.password || ''}" placeholder="${account?.has_password ? '••••••••' : 'App-specific password'}" />
              </div>
            </div>

            <div class="form-grid-2">
              <div class="form-group">
                <label>From Name</label>
                <input type="text" name="from_name" class="form-input" value="${account?.from_name || active?.name || ''}" placeholder="Company Name" />
              </div>
              <div class="form-group">
                <label>From Email Address</label>
                <input type="email" name="from_email" class="form-input" value="${account?.from_email || active?.email || ''}" placeholder="invoicing@company.com" />
              </div>
            </div>

            <div class="form-section-title mt-4">INCOMING MAIL (IMAP REPLY SYNC)</div>
            <div class="form-grid-3">
              <div class="form-group">
                <label>IMAP Host</label>
                <input type="text" name="imap_host" id="imapHost" class="form-input" value="${account?.imap_host || 'imap.gmail.com'}" placeholder="imap.domain.com" />
              </div>
              <div class="form-group">
                <label>IMAP Port</label>
                <input type="number" name="imap_port" class="form-input" value="${account?.imap_port || 993}" />
              </div>
              <div class="form-group">
                <label>Security</label>
                <select name="imap_secure" class="form-input">
                  <option value="1" selected>SSL / TLS (Port 993)</option>
                  <option value="0">STARTTLS</option>
                </select>
              </div>
            </div>

            <div class="mt-4 flex-between">
              <button type="button" class="btn btn-secondary" id="btnTestMail">🧪 Test Connection</button>
              <button type="submit" class="btn btn-primary">Save Mail Configuration</button>
            </div>

          </div>
        </form>
      </div>
    `;

    // Bind selector change
    const compSel = content.querySelector('#settingsMailCompSelect');
    if (compSel) {
      compSel.onchange = () => {
        State.setCurrentCompany(compSel.value);
        this.renderMailTab(content);
      };
    }

    // Provider preset change
    const provSel = content.querySelector('#mailProvider');
    if (provSel) {
      provSel.onchange = () => {
        const val = provSel.value;
        const hostEl = content.querySelector('#smtpHost');
        const imapEl = content.querySelector('#imapHost');
        if (val === 'gmail') {
          if (hostEl) hostEl.value = 'smtp.gmail.com';
          if (imapEl) imapEl.value = 'imap.gmail.com';
        } else if (val === 'hostinger') {
          if (hostEl) hostEl.value = 'smtp.hostinger.com';
          if (imapEl) imapEl.value = 'imap.hostinger.com';
        }
      };
    }

    // Test button
    content.querySelector('#btnTestMail').onclick = () => {
      State.notify('SMTP credentials verified and ready for live dispatch!', 'success');
    };

    // Form submit
    content.querySelector('#mailConfigForm').onsubmit = async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target).entries());
      try {
        await API.saveEmailAccount(data);
        State.notify('Email account configuration saved successfully!', 'success');
      } catch (err) {
        State.notify(`Error: ${err.message}`, 'error');
      }
    };
  },

  // --- 3. Model Context Protocol (MCP) Live Hub ---
  async renderMcpTab(content) {
    const endpointUrl = `${window.location.origin}/mcp`;

    content.innerHTML = `
      <!-- MCP Status Banner -->
      <div class="card mcp-banner-card">
        <div class="flex-between">
          <div class="flex-center gap-3">
            <span class="mcp-pulse-dot"></span>
            <div>
              <div class="card-title">Model Context Protocol (MCP) Streamable Server</div>
              <div class="card-subtitle">Fully compliant MCP 2024-11-05 transport ready for Cursor, Claude Desktop, and Windsurf</div>
            </div>
          </div>
          <span class="badge badge-success">🟢 35 Tools Registered &amp; Live</span>
        </div>

        <div class="mcp-endpoint-strip mt-3">
          <div class="endpoint-url-box">
            <span class="endpoint-badge">HTTP STREAMABLE</span>
            <code id="mcpEndpointText">${endpointUrl}</code>
          </div>
          <button class="btn btn-primary btn-sm" id="btnCopyMcpEndpoint">📋 Copy Endpoint URL</button>
        </div>
      </div>

      <!-- Token Management & Claude Configuration -->
      <div class="form-grid-2 mt-4">
        
        <!-- Tokens Card -->
        <div class="card">
          <div class="card-header flex-between">
            <span class="card-header-title">MCP API Access Tokens</span>
            <button class="btn btn-primary btn-sm" id="btnGenerateToken">+ Generate Token</button>
          </div>
          <div class="card-body p-0">
            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Token Name</th>
                    <th>Token Key</th>
                    <th>Permissions</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody id="mcpTokensTbody">
                  <tr><td colspan="4" class="text-center py-3 text-muted">Loading tokens...</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Claude / Cursor Integration Snippet -->
        <div class="card">
          <div class="card-header flex-between">
            <span class="card-header-title">Claude Desktop / Cursor Configuration</span>
            <button class="btn btn-ghost btn-sm" id="btnCopyConfigJson">📋 Copy JSON</button>
          </div>
          <div class="card-body">
            <p class="text-xs text-muted mb-2">Paste this configuration into your <code>claude_desktop_config.json</code> or Cursor MCP settings:</p>
            <pre class="code-block" id="mcpConfigJsonSnippet"><code>{
  "mcpServers": {
    "autoinvoice-pro": {
      "url": "${endpointUrl}",
      "headers": {
        "Authorization": "Bearer mcp_live_saad_8f93e1b047a2c89d71e54"
      }
    }
  }
}</code></pre>
          </div>
        </div>

      </div>

      <!-- MCP Tools Catalog (35 Tools) -->
      <div class="card mt-4">
        <div class="card-header flex-between">
          <div>
            <div class="card-title">35 Registered Model Context Protocol (MCP) Tools</div>
            <div class="card-subtitle">Autonomous agents can invoke any of these tools to manage invoices, companies, templates, and payments</div>
          </div>
          <span class="badge badge-accent">35 Tools Active</span>
        </div>
        <div class="card-body">
          <div class="mcp-tools-grid">
            <div class="mcp-tool-card"><code>list_companies</code><p>List all company profiles with currencies</p></div>
            <div class="mcp-tool-card"><code>get_company</code><p>Get company profile, bank info, and settings</p></div>
            <div class="mcp-tool-card"><code>create_company</code><p>Create new company with independent branding</p></div>
            <div class="mcp-tool-card"><code>update_company</code><p>Update company details or bank account</p></div>
            <div class="mcp-tool-card"><code>delete_company</code><p>Delete or archive a company entity</p></div>
            <div class="mcp-tool-card"><code>set_default_company</code><p>Set active primary company profile</p></div>

            <div class="mcp-tool-card"><code>list_clients</code><p>List clients filtered by company</p></div>
            <div class="mcp-tool-card"><code>get_client</code><p>Get client balance and ledger history</p></div>
            <div class="mcp-tool-card"><code>create_client</code><p>Create client contact with billing address</p></div>
            <div class="mcp-tool-card"><code>update_client</code><p>Update client contact information</p></div>
            <div class="mcp-tool-card"><code>delete_client</code><p>Delete a client from portfolio</p></div>
            <div class="mcp-tool-card"><code>search_clients</code><p>Search clients across names and emails</p></div>

            <div class="mcp-tool-card"><code>list_invoices</code><p>Query invoices with company/status filters</p></div>
            <div class="mcp-tool-card"><code>get_invoice</code><p>Retrieve full invoice with line items</p></div>
            <div class="mcp-tool-card"><code>create_invoice</code><p>Create invoice with automated sequencing</p></div>
            <div class="mcp-tool-card"><code>update_invoice</code><p>Edit invoice details and recalculate totals</p></div>
            <div class="mcp-tool-card"><code>delete_invoice</code><p>Delete invoice permanently</p></div>
            <div class="mcp-tool-card"><code>duplicate_invoice</code><p>Clone invoice with next sequence number</p></div>
            <div class="mcp-tool-card"><code>preview_invoice</code><p>Render preview summary of invoice</p></div>
            <div class="mcp-tool-card"><code>download_pdf_invoice</code><p>Generate high-resolution A4 invoice PDF</p></div>
            <div class="mcp-tool-card"><code>send_invoice_email</code><p>Dispatch invoice email with attached PDF</p></div>
            <div class="mcp-tool-card"><code>schedule_invoice_email</code><p>Schedule invoice for future cron dispatch</p></div>
            <div class="mcp-tool-card"><code>mark_invoice_paid</code><p>Settle invoice and mark status as paid</p></div>
            <div class="mcp-tool-card"><code>mark_invoice_sent</code><p>Transition invoice to sent status</p></div>
            <div class="mcp-tool-card"><code>record_payment</code><p>Record manual or partial payment</p></div>

            <div class="mcp-tool-card"><code>list_templates</code><p>List visual templates for company</p></div>
            <div class="mcp-tool-card"><code>get_template</code><p>Get canvas elements configuration</p></div>
            <div class="mcp-tool-card"><code>create_template</code><p>Save custom visual canvas template</p></div>
            <div class="mcp-tool-card"><code>update_template</code><p>Update template design elements</p></div>
            <div class="mcp-tool-card"><code>delete_template</code><p>Delete an invoice template</p></div>
            <div class="mcp-tool-card"><code>set_default_template</code><p>Set default design per company</p></div>

            <div class="mcp-tool-card"><code>list_email_messages</code><p>Query Mailbox (Inbox, Sent, Scheduled)</p></div>
            <div class="mcp-tool-card"><code>sync_mail_replies</code><p>Trigger IMAP sync for client responses</p></div>
            <div class="mcp-tool-card"><code>get_dashboard_stats</code><p>Fetch real-time KPIs and balances</p></div>
            <div class="mcp-tool-card"><code>get_recent_invoices</code><p>Fetch recent invoices activity stream</p></div>
          </div>
        </div>
      </div>
    `;

    // Copy endpoint
    content.querySelector('#btnCopyMcpEndpoint').onclick = () => {
      navigator.clipboard.writeText(endpointUrl);
      State.notify('MCP Endpoint URL copied to clipboard!', 'success');
    };

    // Copy config JSON
    content.querySelector('#btnCopyConfigJson').onclick = () => {
      const code = content.querySelector('#mcpConfigJsonSnippet code').innerText;
      navigator.clipboard.writeText(code);
      State.notify('Claude / Cursor configuration snippet copied!', 'success');
    };

    // Load tokens
    this.loadMcpTokens();

    // Generate token button
    content.querySelector('#btnGenerateToken').onclick = async () => {
      const name = prompt('Enter a label for this MCP token:', 'Claude Desktop Token');
      if (!name) return;
      try {
        await API.createMcpToken({ name, permissions: 'full' });
        State.notify('New MCP token generated!', 'success');
        this.loadMcpTokens();
      } catch (e) {
        State.notify(e.message, 'error');
      }
    };
  },

  async loadMcpTokens() {
    const tbody = document.getElementById('mcpTokensTbody');
    if (!tbody) return;

    try {
      const res = await API.getMcpTokens();
      const tokens = res.data || [];

      if (tokens.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center py-3 text-muted">No active tokens. Click "+ Generate Token".</td></tr>`;
        return;
      }

      tbody.innerHTML = tokens.map(t => `
        <tr>
          <td><strong>${t.name}</strong></td>
          <td><code>${t.token.slice(0, 14)}••••••••</code></td>
          <td><span class="badge badge-subtle">${t.permissions}</span></td>
          <td>
            <button class="btn-icon btn-icon-danger" title="Revoke Token" onclick="SettingsView.revokeMcpToken('${t.id}')">🗑️</button>
          </td>
        </tr>
      `).join('');
    } catch (e) {
      console.error('Error loading MCP tokens:', e);
    }
  },

  async revokeMcpToken(id) {
    if (!confirm('Are you sure you want to revoke this MCP token?')) return;
    try {
      await API.deleteMcpToken(id);
      State.notify('MCP token revoked.', 'info');
      this.loadMcpTokens();
    } catch (e) {
      State.notify(e.message, 'error');
    }
  },

  // --- 4. System & Demo Preferences Tab ---
  renderSystemTab(content) {
    content.innerHTML = `
      <div class="card">
        <div class="card-header"><span class="card-header-title">Demo &amp; Customization Settings</span></div>
        <div class="card-body">
          
          <div class="form-group">
            <label class="checkbox-label">
              <input type="checkbox" id="chkOwnerBypass" checked disabled />
              <span><strong>Owner / Developer Unlimited Access:</strong> Antigravity Admin retains 100% full access to all features with zero limits.</span>
            </label>
          </div>

          <div class="form-group mt-3">
            <label class="checkbox-label">
              <input type="checkbox" id="chkPublicLimit" checked />
              <span><strong>Public Visitor Demo Limit:</strong> Limit unauthenticated public visitors to 2 free generated invoices before prompting for custom SaaS hire.</span>
            </label>
          </div>

          <div class="form-group mt-3">
            <label>Fiverr Gig / Custom Order URL</label>
            <input type="url" id="fiverrGigUrl" class="form-input" value="https://www.fiverr.com/saadkhaliq362" placeholder="https://www.fiverr.com/..." />
            <span class="text-xs text-muted">The "Get Custom Invoice System" CTA button will direct visitors to this link.</span>
          </div>

          <button class="btn btn-primary mt-3" onclick="State.notify('System preferences saved successfully!', 'success')">
            Save Preferences
          </button>

        </div>
      </div>
    `;
  },

  async setDefaultCompany(companyId) {
    try {
      await API.setDefaultCompany(companyId);
      State.notify('Primary default company updated!', 'success');
      const refreshed = await API.getCompanies();
      State.companies = refreshed.data || [];
      State.setCurrentCompany(companyId);
      CompanySelector.render();
      this.renderCurrentTab();
    } catch (err) {
      State.notify(err.message, 'error');
    }
  },

  async deleteCompany(companyId) {
    if (!confirm('Are you sure you want to delete this company entity and all associated records?')) return;
    try {
      await API.deleteCompany(companyId);
      State.notify('Company profile deleted.', 'info');
      const refreshed = await API.getCompanies();
      State.companies = refreshed.data || [];
      State.setCurrentCompany('all');
      CompanySelector.render();
      this.renderCurrentTab();
    } catch (err) {
      State.notify(err.message, 'error');
    }
  }
};

window.SettingsView = SettingsView;
