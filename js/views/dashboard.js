/**
 * Dashboard View for AutoInvoice Pro
 * Renders multi-company overview, KPI cards (Outstanding, Overdue, Paid, Clients),
 * recent invoices feed, and quick invoicing actions.
 */
const DashboardView = {
  async render(container) {
    const companyId = State.currentCompanyId;
    const active = State.activeCompany;

    container.innerHTML = `
      <div class="view-header">
        <div>
          <div class="view-title">Dashboard Overview</div>
          <div class="view-subtitle">
            ${companyId === 'all' ? 'All Companies Consolidated View' : `Active Company: <strong>${active ? active.name : ''}</strong> (${active ? active.currency : ''})`}
          </div>
        </div>
        <div class="view-actions">
          <button class="btn btn-secondary" id="btnSyncMailDash">🔄 Sync Mailbox</button>
          <a href="#invoices/new" class="btn btn-primary">➕ New Invoice</a>
        </div>
      </div>

      <!-- KPI Stat Cards -->
      <div class="kpi-grid" id="dashKpis">
        <div class="kpi-card">
          <div class="kpi-label">Outstanding</div>
          <div class="kpi-value" id="kpiOutstandingVal">Loading...</div>
          <div class="kpi-sub" id="kpiOutstandingCount">—</div>
        </div>
        <div class="kpi-card kpi-danger">
          <div class="kpi-label">Overdue</div>
          <div class="kpi-value" id="kpiOverdueVal">Loading...</div>
          <div class="kpi-sub" id="kpiOverdueCount">—</div>
        </div>
        <div class="kpi-card kpi-success">
          <div class="kpi-label">Paid & Settled</div>
          <div class="kpi-value" id="kpiPaidVal">Loading...</div>
          <div class="kpi-sub" id="kpiPaidCount">—</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Active Clients</div>
          <div class="kpi-value" id="kpiClientsVal">Loading...</div>
          <div class="kpi-sub">Across portfolio</div>
        </div>
      </div>

      <!-- Quick Action Bar -->
      <div class="quick-action-strip">
        <div class="strip-item" onclick="window.location.hash='#invoices/new'">
          <span class="strip-icon">📄</span>
          <div>
            <strong>Create Invoice</strong>
            <span>Visual form or raw text parser</span>
          </div>
        </div>
        <div class="strip-item" onclick="window.location.hash='#templates/designer'">
          <span class="strip-icon">🎨</span>
          <div>
            <strong>Design Template</strong>
            <span>Drag-and-drop canvas designer</span>
          </div>
        </div>
        <div class="strip-item" onclick="window.location.hash='#clients'">
          <span class="strip-icon">👥</span>
          <div>
            <strong>Manage Clients</strong>
            <span>Add contacts & billing addresses</span>
          </div>
        </div>
        <div class="strip-item" onclick="window.location.hash='#settings?tab=mcp'">
          <span class="strip-icon">📡</span>
          <div>
            <strong>MCP Server</strong>
            <span>35 tools for Cursor, Claude & Windsurf</span>
          </div>
        </div>
      </div>

      <!-- Recent Invoices Table -->
      <div class="card recent-invoices-card">
        <div class="card-header flex-between">
          <div>
            <div class="card-title">Recent Invoices</div>
            <div class="card-subtitle">Real-time status updates and settlement tracking</div>
          </div>
          <a href="#invoices" class="btn btn-ghost btn-sm">View All Invoices &rarr;</a>
        </div>
        <div class="card-body p-0">
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Company</th>
                  <th>Client</th>
                  <th>Issue Date</th>
                  <th>Due Date</th>
                  <th>Total</th>
                  <th>Paid</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="dashInvoicesTbody">
                <tr><td colspan="9" class="text-center py-4">Loading invoices...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    // Fetch and populate stats
    await this.loadStats(companyId);
    await this.loadRecentInvoices(companyId);

    // Bind event
    const syncBtn = container.querySelector('#btnSyncMailDash');
    if (syncBtn) {
      syncBtn.onclick = async () => {
        syncBtn.disabled = true;
        syncBtn.innerText = 'Syncing...';
        try {
          const compToSync = companyId === 'all' ? (State.companies[0]?.id || '') : companyId;
          const res = await API.syncEmailReplies(compToSync);
          State.notify(res.message || 'Mailbox synced!', 'success');
        } catch (e) {
          State.notify(e.message, 'error');
        } finally {
          syncBtn.disabled = false;
          syncBtn.innerText = '🔄 Sync Mailbox';
        }
      };
    }
  },

  async loadStats(companyId) {
    try {
      const res = await API.getDashboardStats(companyId);
      if (!res.success) return;
      const d = res.data;
      const curr = d.currency;

      const outValEl = document.getElementById('kpiOutstandingVal');
      const outCountEl = document.getElementById('kpiOutstandingCount');
      if (outValEl) outValEl.innerText = State.formatMoney(d.outstanding.amount, curr);
      if (outCountEl) outCountEl.innerText = `${d.outstanding.count} invoice(s) pending`;

      const dueValEl = document.getElementById('kpiOverdueVal');
      const dueCountEl = document.getElementById('kpiOverdueCount');
      if (dueValEl) dueValEl.innerText = State.formatMoney(d.overdue.amount, curr);
      if (dueCountEl) dueCountEl.innerText = `${d.overdue.count} invoice(s) overdue`;

      const paidValEl = document.getElementById('kpiPaidVal');
      const paidCountEl = document.getElementById('kpiPaidCount');
      if (paidValEl) paidValEl.innerText = State.formatMoney(d.paid.amount, curr);
      if (paidCountEl) paidCountEl.innerText = `${d.paid.count} invoice(s) settled`;

      const cliValEl = document.getElementById('kpiClientsVal');
      if (cliValEl) cliValEl.innerText = d.clients.count;
    } catch (err) {
      console.error('Error loading dashboard stats:', err);
    }
  },

  async loadRecentInvoices(companyId) {
    try {
      const res = await API.getRecentInvoices(companyId, 10);
      const tbody = document.getElementById('dashInvoicesTbody');
      if (!tbody) return;

      const list = res.data || [];
      if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center py-4 text-muted">No invoices found for this selection. Create one to get started!</td></tr>`;
        return;
      }

      tbody.innerHTML = list.map(inv => {
        const statusClass = `status-pill status-${inv.status}`;
        const remaining = inv.total - inv.amount_paid;
        return `
          <tr>
            <td>
              <a href="#invoices/${inv.id}" class="invoice-link"><strong>${inv.invoice_number}</strong></a>
            </td>
            <td>
              <span class="company-tag">${inv.company_name}</span>
            </td>
            <td>
              <div class="client-cell">
                <strong>${inv.client_name}</strong>
                <span class="text-muted text-xs">${inv.client_email || ''}</span>
              </div>
            </td>
            <td>${State.formatDate(inv.invoice_date)}</td>
            <td>${State.formatDate(inv.due_date)}</td>
            <td><strong>${State.formatMoney(inv.total, inv.currency)}</strong></td>
            <td>
              <span class="${inv.amount_paid > 0 ? 'text-success' : 'text-muted'}">${State.formatMoney(inv.amount_paid, inv.currency)}</span>
              ${remaining > 0 && inv.amount_paid > 0 ? `<div class="text-xs text-danger">Bal: ${State.formatMoney(remaining, inv.currency)}</div>` : ''}
            </td>
            <td>
              <span class="${statusClass}">${inv.status.replace('_', ' ')}</span>
            </td>
            <td>
              <div class="table-actions">
                <a href="#invoices/${inv.id}" class="btn-icon" title="View Invoice">👁️</a>
                <a href="#invoices/${inv.id}/email" class="btn-icon" title="Email Client">✉️</a>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.error('Error loading recent invoices:', err);
    }
  }
};

window.DashboardView = DashboardView;
