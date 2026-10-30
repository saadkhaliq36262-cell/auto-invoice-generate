/**
 * Company Selector Component for AutoInvoice Pro
 * Sidebar company switcher with All Companies, individual profiles, and "+ Add Company" modal trigger.
 */
const CompanySelector = {
  render() {
    const el = document.getElementById('sidebarCompanySelector');
    if (!el) return;

    const currentId = State.currentCompanyId;
    const active = State.activeCompany;
    const isAll = currentId === 'all' || !active;

    const currentTitle = isAll ? 'All Companies' : active.name;
    const currentSubtitle = isAll ? `${State.companies.length} profiles` : active.currency;
    const currentAvatar = isAll ? '🌐' : (active.logo ? `<img src="${active.logo}" alt=""/>` : active.name.charAt(0));

    el.innerHTML = `
      <div class="company-select-trigger" id="companyDropdownBtn">
        <div class="company-avatar">${currentAvatar}</div>
        <div class="company-info">
          <div class="company-name" title="${currentTitle}">${currentTitle}</div>
          <div class="company-sub">${currentSubtitle}</div>
        </div>
        <span class="company-arrow">▾</span>
      </div>

      <div class="company-dropdown-menu" id="companyDropdownMenu" style="display: none;">
        <div class="company-menu-header">SWITCH COMPANY</div>
        
        <div class="company-menu-item ${isAll ? 'active' : ''}" data-id="all">
          <div class="menu-item-avatar">🌐</div>
          <div class="menu-item-text">
            <strong>All Companies</strong>
            <span>Consolidated multi-company overview</span>
          </div>
          ${isAll ? '<span class="item-check">✓</span>' : ''}
        </div>

        <div class="company-menu-divider"></div>

        <div class="company-list-scroll">
          ${State.companies.map(c => `
            <div class="company-menu-item ${c.id === currentId ? 'active' : ''}" data-id="${c.id}">
              <div class="menu-item-avatar">${c.logo ? `<img src="${c.logo}" alt=""/>` : c.name.charAt(0)}</div>
              <div class="menu-item-text">
                <strong>${c.name}</strong>
                <span>${c.currency} • ${c.invoice_prefix || 'INV-'}</span>
              </div>
              ${c.id === currentId ? '<span class="item-check">✓</span>' : ''}
            </div>
          `).join('')}
        </div>

        <div class="company-menu-divider"></div>

        <div class="company-menu-item add-company-btn" id="btnAddCompanyTrigger">
          <div class="menu-item-avatar">➕</div>
          <div class="menu-item-text">
            <strong>Add Company</strong>
            <span>Create new business entity</span>
          </div>
        </div>
      </div>
    `;

    this.bindEvents(el);
  },

  bindEvents(container) {
    const trigger = container.querySelector('#companyDropdownBtn');
    const menu = container.querySelector('#companyDropdownMenu');
    const addBtn = container.querySelector('#btnAddCompanyTrigger');

    if (!trigger || !menu) return;

    trigger.onclick = (e) => {
      e.stopPropagation();
      const open = menu.style.display === 'block';
      menu.style.display = open ? 'none' : 'block';
    };

    document.addEventListener('click', (e) => {
      if (!container.contains(e.target)) {
        menu.style.display = 'none';
      }
    });

    container.querySelectorAll('.company-menu-item[data-id]').forEach(item => {
      item.onclick = (e) => {
        const id = item.getAttribute('data-id');
        menu.style.display = 'none';
        State.setCurrentCompany(id);
        this.render();
      };
    });

    if (addBtn) {
      addBtn.onclick = (e) => {
        e.stopPropagation();
        menu.style.display = 'none';
        CompanySelector.openCreateCompanyModal();
      };
    }
  },

  openCreateCompanyModal() {
    let modal = document.getElementById('companyModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'companyModal';
      modal.className = 'modal-backdrop';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="modal-dialog modal-md">
        <div class="modal-header">
          <div class="modal-title">🏢 Create New Company Profile</div>
          <button class="modal-close" onclick="document.getElementById('companyModal').style.display='none'">&times;</button>
        </div>
        <form id="createCompanyForm">
          <div class="modal-body">
            <div class="form-grid-2">
              <div class="form-group">
                <label>Company / Legal Business Name *</label>
                <input type="text" name="name" class="form-input" required placeholder="e.g. Apex Global Tech Ltd" />
              </div>
              <div class="form-group">
                <label>Currency *</label>
                <select name="currency" class="form-input">
                  <option value="GBP">GBP (£ - British Pound)</option>
                  <option value="USD" selected>USD ($ - US Dollar)</option>
                  <option value="EUR">EUR (€ - Euro)</option>
                  <option value="PKR">PKR (Rs - Pakistani Rupee)</option>
                  <option value="CAD">CAD ($ - Canadian Dollar)</option>
                  <option value="AUD">AUD ($ - Australian Dollar)</option>
                </select>
              </div>
            </div>

            <div class="form-grid-2">
              <div class="form-group">
                <label>Invoice Number Prefix</label>
                <input type="text" name="invoice_prefix" class="form-input" value="INV-" placeholder="e.g. AGT-, NX-" />
              </div>
              <div class="form-group">
                <label>Default Payment Terms</label>
                <select name="payment_terms" class="form-input">
                  <option value="Net 14" selected>Net 14 (14 Days)</option>
                  <option value="Net 30">Net 30 (30 Days)</option>
                  <option value="Net 7">Net 7 (7 Days)</option>
                  <option value="Due on Receipt">Due on Receipt</option>
                </select>
              </div>
            </div>

            <div class="form-grid-2">
              <div class="form-group">
                <label>Email Address</label>
                <input type="email" name="email" class="form-input" placeholder="billing@company.com" />
              </div>
              <div class="form-group">
                <label>Phone Number</label>
                <input type="text" name="phone" class="form-input" placeholder="+1 (555) 000-0000" />
              </div>
            </div>

            <div class="form-group">
              <label>Business Address</label>
              <textarea name="address" class="form-input" rows="2" placeholder="Street Address, City, Country"></textarea>
            </div>

            <div class="form-grid-2">
              <div class="form-group">
                <label>Tax / VAT Number</label>
                <input type="text" name="tax_id" class="form-input" placeholder="e.g. GB-VAT-123456" />
              </div>
              <div class="form-group">
                <label>Website</label>
                <input type="url" name="website" class="form-input" placeholder="https://example.com" />
              </div>
            </div>

            <div class="form-section-title">BANK & REMITTANCE DETAILS</div>
            <div class="form-grid-2">
              <div class="form-group">
                <label>Bank Name</label>
                <input type="text" name="bank_name" class="form-input" placeholder="e.g. Barclays Bank" />
              </div>
              <div class="form-group">
                <label>Account Holder Name</label>
                <input type="text" name="account_name" class="form-input" placeholder="Company Legal Name" />
              </div>
            </div>

            <div class="form-grid-3">
              <div class="form-group">
                <label>Account Number</label>
                <input type="text" name="account_number" class="form-input" placeholder="12345678" />
              </div>
              <div class="form-group">
                <label>IBAN</label>
                <input type="text" name="iban" class="form-input" placeholder="GB29 BARK ..." />
              </div>
              <div class="form-group">
                <label>SWIFT / BIC</label>
                <input type="text" name="swift" class="form-input" placeholder="BARCGB22" />
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="document.getElementById('companyModal').style.display='none'">Cancel</button>
            <button type="submit" class="btn btn-primary">Create Company Profile</button>
          </div>
        </form>
      </div>
    `;

    modal.style.display = 'flex';

    modal.querySelector('#createCompanyForm').onsubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const data = Object.fromEntries(formData.entries());

      try {
        const res = await API.createCompany(data);
        State.notify('Company profile created successfully!', 'success');
        modal.style.display = 'none';
        
        // Refresh companies list and switch to newly created company
        const refreshed = await API.getCompanies();
        State.companies = refreshed.data || [];
        State.setCurrentCompany(res.data.id);
        CompanySelector.render();
      } catch (err) {
        State.notify(`Failed to create company: ${err.message}`, 'error');
      }
    };
  }
};

window.CompanySelector = CompanySelector;
