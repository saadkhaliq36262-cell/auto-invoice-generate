/**
 * Invoice Templates Library View for AutoInvoice Pro
 * Matches Reference Screenshot 2 with template cards, default indicators, and creation actions.
 */
const TemplatesView = {
  companyFilter: 'all',

  async render(container) {
    this.companyFilter = State.currentCompanyId;
    const active = State.activeCompany;

    container.innerHTML = `
      <div class="view-header">
        <div>
          <div class="view-title">Invoice Templates</div>
          <div class="view-subtitle">Design, customize, and manage distinct invoice branding for each company</div>
        </div>
        <div class="view-actions">
          <a href="#templates/pdf-upload" class="btn btn-secondary">📄 Upload PDF Template</a>
          <a href="#templates/designer" class="btn btn-primary">🎨 Design a Template</a>
        </div>
      </div>

      <!-- Company Filter Toolbar -->
      <div class="toolbar-card flex-between">
        <div class="flex-center gap-2">
          <span class="text-xs text-muted font-bold">FILTER BY COMPANY:</span>
          <select id="tmplCompanyFilter" class="form-input form-input-sm" style="width: 240px;">
            <option value="all" ${this.companyFilter === 'all' ? 'selected' : ''}>🌐 All Companies</option>
            ${State.companies.map(c => `
              <option value="${c.id}" ${c.id === this.companyFilter ? 'selected' : ''}>${c.name}</option>
            `).join('')}
          </select>
        </div>
        <div class="text-xs text-muted" id="tmplCountSummary">Loading templates...</div>
      </div>

      <!-- Templates Grid -->
      <div class="templates-grid" id="templatesGrid">
        <div class="text-center py-5 text-muted col-span-full">Loading template library...</div>
      </div>
    `;

    this.bindEvents(container);
    await this.loadTemplates();
  },

  bindEvents(container) {
    const filterSel = container.querySelector('#tmplCompanyFilter');
    if (filterSel) {
      filterSel.onchange = () => {
        this.companyFilter = filterSel.value;
        this.loadTemplates();
      };
    }
  },

  async loadTemplates() {
    const grid = document.getElementById('templatesGrid');
    const summary = document.getElementById('tmplCountSummary');
    if (!grid) return;

    try {
      const res = await API.getTemplates(this.companyFilter);
      const list = res.data || [];

      if (summary) summary.innerText = `Showing ${list.length} template(s)`;

      if (list.length === 0) {
        grid.innerHTML = `
          <div class="col-span-full text-center py-5">
            <div class="empty-state-icon">🎨</div>
            <h3>No templates found for this company</h3>
            <p class="text-muted">Create a custom invoice design with our drag-and-drop designer.</p>
            <a href="#templates/designer" class="btn btn-primary mt-3">🎨 Design First Template</a>
          </div>
        `;
        return;
      }

      grid.innerHTML = list.map(t => {
        const isDefault = Boolean(t.is_default);
        const typeBadge = t.type === 'pdf_upload' ? 'PDF Upload' : 'Visual Designer';
        
        return `
          <div class="template-card ${isDefault ? 'is-default' : ''}">
            <!-- Mockup Preview Banner -->
            <div class="template-preview-frame">
              <div class="template-mini-sheet ${t.name.toLowerCase().includes('gradient') ? 'sheet-style-gradient' : ''}">
                <div class="mini-bar"></div>
                <div class="mini-title-line"></div>
                <div class="mini-grid">
                  <div class="mini-box"></div>
                  <div class="mini-box"></div>
                </div>
                <div class="mini-table-line"></div>
                <div class="mini-table-line"></div>
                <div class="mini-total-line"></div>
              </div>
              ${isDefault ? `<span class="default-badge">⭐ Default Template</span>` : ''}
            </div>

            <!-- Card Body & Meta -->
            <div class="template-card-body">
              <div class="flex-between">
                <h3 class="template-title">${t.name}</h3>
                <span class="badge badge-subtle">${typeBadge}</span>
              </div>
              <div class="template-company-name">🏢 ${t.company_name}</div>
              <div class="template-usage-text">Used on ${t.usage_count || 0} invoice(s)</div>

              <div class="template-card-actions">
                ${!isDefault ? `
                  <button class="btn btn-secondary btn-sm" onclick="TemplatesView.setDefault('${t.id}')">
                    Set Default
                  </button>
                ` : `
                  <button class="btn btn-ghost btn-sm text-success" disabled>
                    ✓ Default
                  </button>
                `}
                
                <a href="#templates/designer/${t.id}" class="btn btn-primary btn-sm">
                  ✏️ Edit
                </a>

                <button class="btn-icon" title="Duplicate" onclick="TemplatesView.duplicate('${t.id}')">📋</button>
                <button class="btn-icon btn-icon-danger" title="Delete" onclick="TemplatesView.delete('${t.id}')">🗑️</button>
              </div>
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      console.error('Error loading templates:', err);
      grid.innerHTML = `<div class="col-span-full alert alert-danger">Error: ${err.message}</div>`;
    }
  },

  async setDefault(templateId) {
    try {
      await API.setDefaultTemplate(templateId);
      State.notify('Default template updated successfully for this company!', 'success');
      this.loadTemplates();
    } catch (err) {
      State.notify(err.message, 'error');
    }
  },

  async duplicate(templateId) {
    try {
      const res = await API.duplicateTemplate(templateId);
      State.notify(`Template duplicated successfully!`, 'success');
      this.loadTemplates();
    } catch (err) {
      State.notify(err.message, 'error');
    }
  },

  async delete(templateId) {
    if (!confirm('Are you sure you want to delete this template?')) return;
    try {
      await API.deleteTemplate(templateId);
      State.notify('Template deleted.', 'info');
      this.loadTemplates();
    } catch (err) {
      State.notify(err.message, 'error');
    }
  }
};

window.TemplatesView = TemplatesView;
