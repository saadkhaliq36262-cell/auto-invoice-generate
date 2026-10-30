/**
 * Clients Management View for AutoInvoice Pro
 * Lists clients, handles Add/Edit modal, and shows client invoice history.
 */
const ClientsView = {
  searchQuery: '',

  async render(container) {
    const companyId = State.currentCompanyId;

    container.innerHTML = `
      <div class="view-header">
        <div>
          <div class="view-title">Clients Directory</div>
          <div class="view-subtitle">Manage customer contacts, billing addresses, and track outstanding ledger balances</div>
        </div>
        <div class="view-actions">
          <button class="btn btn-primary" id="btnAddClient">➕ Add Client</button>
        </div>
      </div>

      <!-- Toolbar -->
      <div class="toolbar-card">
        <div class="toolbar-search" style="max-width: 400px;">
          <input type="text" id="clientSearchInput" class="form-input search-input" placeholder="Search clients by name, business, or email..." value="${this.searchQuery}" />
        </div>
      </div>

      <!-- Clients Table -->
      <div class="card">
        <div class="card-body p-0">
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Client Name</th>
                  <th>Business / Entity</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Invoices</th>
                  <th>Total Invoiced</th>
                  <th>Balance Due</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="clientsListTbody">
                <tr><td colspan="8" class="text-center py-4">Loading clients...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    this.bindEvents(container);
    await this.loadClients();
  },

  bindEvents(container) {
    const addBtn = container.querySelector('#btnAddClient');
    if (addBtn) {
      addBtn.onclick = () => {
        const compId = State.currentCompanyId !== 'all' ? State.currentCompanyId : (State.companies[0]?.id || '');
        this.openAddClientModal(compId, () => this.loadClients());
      };
    }

    const searchInput = container.querySelector('#clientSearchInput');
    let debounce;
    if (searchInput) {
      searchInput.oninput = () => {
        clearTimeout(debounce);
        debounce = setTimeout(() => {
          this.searchQuery = searchInput.value.trim();
          this.loadClients();
        }, 300);
      };
    }
  },

  async loadClients() {
    const tbody = document.getElementById('clientsListTbody');
    if (!tbody) return;

    try {
      const res = await API.getClients(State.currentCompanyId, this.searchQuery);
      const clients = res.data || [];

      if (clients.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center py-5 text-muted">No clients found. Click "+ Add Client" to create your first contact.</td></tr>`;
        return;
      }

      tbody.innerHTML = clients.map(c => `
        <tr>
          <td>
            <a href="javascript:void(0)" onclick="ClientsView.openClientHistoryModal('${c.id}')">
              <strong>${c.name}</strong>
            </a>
          </td>
          <td>${c.business_name || '—'}</td>
          <td>${c.email || '—'}</td>
          <td>${c.phone || '—'}</td>
          <td class="text-center"><span class="badge badge-subtle">${c.invoice_count || 0}</span></td>
          <td>${State.formatMoney(c.total_invoiced || 0)}</td>
          <td>
            <strong class="${(c.balance_due || 0) > 0 ? 'text-danger' : 'text-success'}">
              ${State.formatMoney(c.balance_due || 0)}
            </strong>
          </td>
          <td>
            <div class="table-actions">
              <button class="btn-icon" title="View Invoices" onclick="ClientsView.openClientHistoryModal('${c.id}')">📂</button>
              <button class="btn-icon" title="Edit" onclick="ClientsView.openEditClientModal('${c.id}')">✏️</button>
              <button class="btn-icon btn-icon-danger" title="Delete" onclick="ClientsView.deleteClient('${c.id}')">🗑️</button>
            </div>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      console.error('Error loading clients:', err);
      tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-danger">Failed to load clients: ${err.message}</td></tr>`;
    }
  },

  openAddClientModal(companyId, onSuccess) {
    let modal = document.getElementById('clientModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'clientModal';
      modal.className = 'modal-backdrop';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="modal-dialog modal-md">
        <div class="modal-header">
          <div class="modal-title">👥 Add New Client</div>
          <button class="modal-close" onclick="document.getElementById('clientModal').style.display='none'">&times;</button>
        </div>
        <form id="clientForm">
          <div class="modal-body">
            <div class="form-grid-2">
              <div class="form-group">
                <label>Target Company *</label>
                <select name="company_id" class="form-input" required>
                  ${State.companies.map(c => `
                    <option value="${c.id}" ${c.id === companyId ? 'selected' : ''}>${c.name}</option>
                  `).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>Primary Contact / Client Name *</label>
                <input type="text" name="name" class="form-input" placeholder="e.g. John Doe or Jane Smith" required />
              </div>
            </div>

            <div class="form-grid-2">
              <div class="form-group">
                <label>Business / Company Legal Name</label>
                <input type="text" name="business_name" class="form-input" placeholder="e.g. Acme Corp Ltd" />
              </div>
              <div class="form-group">
                <label>Tax / VAT Number</label>
                <input type="text" name="tax_id" class="form-input" placeholder="e.g. GB-VAT-99210" />
              </div>
            </div>

            <div class="form-grid-2">
              <div class="form-group">
                <label>Email Address</label>
                <input type="email" name="email" class="form-input" placeholder="client@example.com" />
              </div>
              <div class="form-group">
                <label>Phone Number</label>
                <input type="text" name="phone" class="form-input" placeholder="+1 (555) 000-0000" />
              </div>
            </div>

            <div class="form-group">
              <label>Billing Address</label>
              <textarea name="address" class="form-input" rows="2" placeholder="Street Address, City, Postal Code, Country"></textarea>
            </div>

            <div class="form-group">
              <label>Internal Notes</label>
              <input type="text" name="notes" class="form-input" placeholder="Key enterprise client or project notes" />
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="document.getElementById('clientModal').style.display='none'">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Client</button>
          </div>
        </form>
      </div>
    `;

    modal.style.display = 'flex';

    modal.querySelector('#clientForm').onsubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const data = Object.fromEntries(formData.entries());

      try {
        const res = await API.createClient(data);
        State.notify('Client added successfully!', 'success');
        modal.style.display = 'none';
        if (onSuccess) onSuccess(res.data);
      } catch (err) {
        State.notify(`Error creating client: ${err.message}`, 'error');
      }
    };
  },

  async openEditClientModal(clientId) {
    try {
      const res = await API.getClient(clientId);
      if (!res.success) return;
      const c = res.data;

      let modal = document.getElementById('clientModal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'clientModal';
        modal.className = 'modal-backdrop';
        document.body.appendChild(modal);
      }

      modal.innerHTML = `
        <div class="modal-dialog modal-md">
          <div class="modal-header">
            <div class="modal-title">✏️ Edit Client</div>
            <button class="modal-close" onclick="document.getElementById('clientModal').style.display='none'">&times;</button>
          </div>
          <form id="editClientForm">
            <div class="modal-body">
              <div class="form-grid-2">
                <div class="form-group">
                  <label>Contact Name *</label>
                  <input type="text" name="name" class="form-input" value="${c.name}" required />
                </div>
                <div class="form-group">
                  <label>Business Name</label>
                  <input type="text" name="business_name" class="form-input" value="${c.business_name || ''}" />
                </div>
              </div>
              <div class="form-grid-2">
                <div class="form-group">
                  <label>Email</label>
                  <input type="email" name="email" class="form-input" value="${c.email || ''}" />
                </div>
                <div class="form-group">
                  <label>Phone</label>
                  <input type="text" name="phone" class="form-input" value="${c.phone || ''}" />
                </div>
              </div>
              <div class="form-group">
                <label>Billing Address</label>
                <textarea name="address" class="form-input" rows="2">${c.address || ''}</textarea>
              </div>
              <div class="form-group">
                <label>Tax / VAT Number</label>
                <input type="text" name="tax_id" class="form-input" value="${c.tax_id || ''}" />
              </div>
              <div class="form-group">
                <label>Notes</label>
                <input type="text" name="notes" class="form-input" value="${c.notes || ''}" />
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="document.getElementById('clientModal').style.display='none'">Cancel</button>
              <button type="submit" class="btn btn-primary">Update Client</button>
            </div>
          </form>
        </div>
      `;

      modal.style.display = 'flex';

      modal.querySelector('#editClientForm').onsubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());

        try {
          await API.updateClient(clientId, data);
          State.notify('Client updated successfully!', 'success');
          modal.style.display = 'none';
          this.loadClients();
        } catch (err) {
          State.notify(`Update error: ${err.message}`, 'error');
        }
      };
    } catch (e) {
      State.notify(e.message, 'error');
    }
  },

  async openClientHistoryModal(clientId) {
    try {
      const [cRes, iRes] = await Promise.all([
        API.getClient(clientId),
        API.getInvoices({ client_id: clientId })
      ]);

      const c = cRes.data;
      const invoices = iRes.data || [];

      let modal = document.getElementById('clientHistoryModal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'clientHistoryModal';
        modal.className = 'modal-backdrop';
        document.body.appendChild(modal);
      }

      modal.innerHTML = `
        <div class="modal-dialog modal-lg">
          <div class="modal-header">
            <div>
              <div class="modal-title">Client Ledger: ${c.name}</div>
              <div class="text-xs text-muted">${c.business_name || 'Individual'} • ${c.email || 'No email'}</div>
            </div>
            <button class="modal-close" onclick="document.getElementById('clientHistoryModal').style.display='none'">&times;</button>
          </div>
          <div class="modal-body">
            <div class="kpi-grid mb-4">
              <div class="kpi-card">
                <div class="kpi-label">Invoices Count</div>
                <div class="kpi-value">${invoices.length}</div>
              </div>
              <div class="kpi-card">
                <div class="kpi-label">Total Invoiced</div>
                <div class="kpi-value">${State.formatMoney(c.total_invoiced || 0)}</div>
              </div>
              <div class="kpi-card ${(c.balance_due || 0) > 0 ? 'kpi-danger' : 'kpi-success'}">
                <div class="kpi-label">Outstanding Balance</div>
                <div class="kpi-value">${State.formatMoney(c.balance_due || 0)}</div>
              </div>
            </div>

            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Date</th>
                    <th>Due Date</th>
                    <th>Total</th>
                    <th>Amount Paid</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${invoices.length > 0 ? invoices.map(inv => `
                    <tr>
                      <td><a href="#invoices/${inv.id}" onclick="document.getElementById('clientHistoryModal').style.display='none'"><strong>${inv.invoice_number}</strong></a></td>
                      <td>${State.formatDate(inv.invoice_date)}</td>
                      <td>${State.formatDate(inv.due_date)}</td>
                      <td>${State.formatMoney(inv.total, inv.currency)}</td>
                      <td>${State.formatMoney(inv.amount_paid, inv.currency)}</td>
                      <td><span class="status-pill status-${inv.status}">${inv.status}</span></td>
                      <td>
                        <a href="#invoices/${inv.id}" class="btn-icon" onclick="document.getElementById('clientHistoryModal').style.display='none'">👁️</a>
                      </td>
                    </tr>
                  `).join('') : '<tr><td colspan="7" class="text-center py-4 text-muted">No invoices recorded for this client yet.</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="document.getElementById('clientHistoryModal').style.display='none'">Close</button>
            <a href="#invoices/new" class="btn btn-primary" onclick="document.getElementById('clientHistoryModal').style.display='none'">+ Create Invoice for Client</a>
          </div>
        </div>
      `;

      modal.style.display = 'flex';
    } catch (err) {
      State.notify(`Error opening client history: ${err.message}`, 'error');
    }
  },

  async deleteClient(clientId) {
    if (!confirm('Are you sure you want to delete this client? All associated invoices will also be removed.')) return;
    try {
      await API.deleteClient(clientId);
      State.notify('Client deleted.', 'info');
      this.loadClients();
    } catch (err) {
      State.notify(err.message, 'error');
    }
  }
};

window.ClientsView = ClientsView;
