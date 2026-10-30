/**
 * Full Canvas Invoice Designer for AutoInvoice Pro
 * Matches Reference Screenshot 1 with drag-and-drop elements, resize handles,
 * dynamic field bindings, properties panel, layers panel, zoom controls, and undo/redo.
 */
const DesignerView = {
  templateId: null,
  companyId: null,
  templateName: 'Custom Designed Template',
  isDefault: false,
  zoomLevel: 1.0,
  snapToGrid: true,
  selectedElementId: null,
  elements: [],
  history: [],
  historyIndex: -1,

  async render(container, templateId = null) {
    this.templateId = templateId;
    this.companyId = State.currentCompanyId !== 'all' ? State.currentCompanyId : (State.companies[0]?.id || '');
    this.elements = [];
    this.history = [];
    this.historyIndex = -1;
    this.selectedElementId = null;

    if (templateId) {
      try {
        const res = await API.getTemplate(templateId);
        if (res.success && res.data) {
          const t = res.data;
          this.templateName = t.name;
          this.companyId = t.company_id;
          this.isDefault = Boolean(t.is_default);
          if (t.config_json) {
            try {
              const cfg = JSON.parse(t.config_json);
              this.elements = cfg.elements || [];
            } catch (e) {
              console.warn('Error parsing template config:', e);
            }
          }
        }
      } catch (err) {
        console.error('Error loading template for design:', err);
      }
    }

    if (this.elements.length === 0) {
      this.initDefaultCanvasElements();
    }
    this.pushHistoryState();

    container.innerHTML = `
      <!-- Designer Header Bar -->
      <div class="designer-top-bar">
        <div class="designer-header-left">
          <a href="#templates" class="back-link">&larr; Back to Templates</a>
          <input type="text" id="designerTmplName" class="designer-title-input" value="${this.templateName}" placeholder="Template Title..." />
          <select id="designerCompanySelect" class="form-input form-input-sm" style="width: 200px;">
            ${State.companies.map(c => `
              <option value="${c.id}" ${c.id === this.companyId ? 'selected' : ''}>${c.name}</option>
            `).join('')}
          </select>
          <label class="checkbox-label text-xs">
            <input type="checkbox" id="designerIsDefault" ${this.isDefault ? 'checked' : ''} />
            <span>Set as Default</span>
          </label>
        </div>

        <div class="designer-header-center">
          <button class="btn-icon" id="btnUndo" title="Undo (Ctrl+Z)">↩️</button>
          <button class="btn-icon" id="btnRedo" title="Redo (Ctrl+Y)">↪️</button>
          <div class="zoom-controls">
            <button class="btn-icon btn-sm" id="btnZoomOut">-</button>
            <span class="zoom-text" id="zoomDisplay">100%</span>
            <button class="btn-icon btn-sm" id="btnZoomIn">+</button>
            <button class="btn-icon btn-sm" id="btnZoomFit" title="Fit Screen">🔍</button>
          </div>
          <label class="checkbox-label text-xs ml-2">
            <input type="checkbox" id="chkSnapGrid" ${this.snapToGrid ? 'checked' : ''} />
            <span>Snap Grid</span>
          </label>
        </div>

        <div class="designer-header-right">
          <button class="btn btn-secondary btn-sm" id="btnPreviewCanvasPdf">👁️ Preview PDF</button>
          <button class="btn btn-primary btn-sm" id="btnSaveTemplate">💾 Save Template</button>
        </div>
      </div>

      <!-- 3-Column Designer Workspace -->
      <div class="designer-workspace">
        
        <!-- Left Column: Tool Palette -->
        <div class="designer-tools-panel">
          <div class="tools-panel-header">ELEMENTS</div>
          <div class="tools-grid">
            <button class="tool-btn" data-tool="text"><span class="tool-icon">📝</span> Add Text</button>
            <button class="tool-btn" data-tool="field"><span class="tool-icon">🏷️</span> Add Field</button>
            <button class="tool-btn" data-tool="image"><span class="tool-icon">🖼️</span> Add Logo/Image</button>
            <button class="tool-btn" data-tool="box"><span class="tool-icon">◻️</span> Add Box</button>
            <button class="tool-btn" data-tool="line"><span class="tool-icon">➖</span> Add Line</button>
            <button class="tool-btn" data-tool="table"><span class="tool-icon">📊</span> Items Table</button>
            <button class="tool-btn" data-tool="totals"><span class="tool-icon">🔢</span> Totals Block</button>
            <button class="tool-btn" data-tool="bill_to"><span class="tool-icon">👤</span> Bill To Block</button>
            <button class="tool-btn" data-tool="from"><span class="tool-icon">🏢</span> From Block</button>
            <button class="tool-btn" data-tool="bank"><span class="tool-icon">🏦</span> Bank Details</button>
            <button class="tool-btn" data-tool="notes"><span class="tool-icon">📌</span> Notes Block</button>
          </div>

          <div class="tools-panel-header mt-4">DYNAMIC FIELDS</div>
          <div class="field-chips-list">
            <div class="field-chip" data-field="{{invoice_number}}">Invoice #</div>
            <div class="field-chip" data-field="{{invoice_date}}">Issue Date</div>
            <div class="field-chip" data-field="{{due_date}}">Due Date</div>
            <div class="field-chip" data-field="{{company_name}}">Company Name</div>
            <div class="field-chip" data-field="{{client_name}}">Client Name</div>
            <div class="field-chip" data-field="{{grand_total}}">Grand Total</div>
            <div class="field-chip" data-field="{{bank_details}}">Bank Remittance</div>
          </div>
        </div>

        <!-- Center Column: Scrollable Canvas Workspace (A4 Scaled) -->
        <div class="designer-canvas-viewport" id="canvasViewport">
          <div class="canvas-a4-sheet" id="canvasSheet">
            <div class="canvas-grid-overlay" id="gridOverlay"></div>
            <!-- Canvas elements will render here -->
          </div>
        </div>

        <!-- Right Column: Properties & Layers Tabs -->
        <div class="designer-props-panel">
          <div class="props-tabs">
            <button class="props-tab active" data-tab="props" id="tabPropsBtn">Properties</button>
            <button class="props-tab" data-tab="layers" id="tabLayersBtn">Layers (<span id="layerCount">0</span>)</button>
          </div>

          <!-- Properties Tab Content -->
          <div class="props-tab-content" id="tabPropsContent">
            <div id="noSelectionMsg" class="p-3 text-center text-muted text-sm">
              Click an element on the canvas to configure typography, colors, and layout.
            </div>
            <div id="propsFormWrapper" class="hidden">
              <!-- Dynamically populated according to selected element -->
            </div>
          </div>

          <!-- Layers Tab Content -->
          <div class="props-tab-content hidden" id="tabLayersContent">
            <div class="layers-list" id="layersList"></div>
          </div>
        </div>

      </div>
    `;

    this.bindEvents(container);
    this.renderCanvas();
    this.updateLayersList();
  },

  initDefaultCanvasElements() {
    this.elements = [
      {
        id: 'el_' + Date.now() + '_1',
        type: 'from',
        content: '{{company_name}}\n{{company_address}}\n{{company_email}}',
        x: 40,
        y: 40,
        width: 260,
        height: 80,
        fontSize: 14,
        fontFamily: 'Inter',
        color: '#111827',
        align: 'left',
        zIndex: 1
      },
      {
        id: 'el_' + Date.now() + '_2',
        type: 'text',
        content: 'INVOICE',
        x: 350,
        y: 40,
        width: 200,
        height: 45,
        fontSize: 28,
        fontWeight: 'bold',
        fontFamily: 'Inter',
        color: '#2563eb',
        align: 'right',
        zIndex: 2
      },
      {
        id: 'el_' + Date.now() + '_3',
        type: 'field',
        content: 'Invoice #: {{invoice_number}}\nDate: {{invoice_date}}\nDue Date: {{due_date}}',
        x: 350,
        y: 90,
        width: 200,
        height: 60,
        fontSize: 12,
        fontFamily: 'Inter',
        color: '#4b5563',
        align: 'right',
        zIndex: 3
      },
      {
        id: 'el_' + Date.now() + '_4',
        type: 'line',
        x: 40,
        y: 160,
        width: 510,
        height: 2,
        bgColor: '#e5e7eb',
        zIndex: 4
      },
      {
        id: 'el_' + Date.now() + '_5',
        type: 'bill_to',
        content: 'BILLED TO:\n{{client_name}}\n{{client_address}}\n{{client_email}}',
        x: 40,
        y: 180,
        width: 260,
        height: 75,
        fontSize: 12,
        fontFamily: 'Inter',
        color: '#1f2937',
        align: 'left',
        zIndex: 5
      },
      {
        id: 'el_' + Date.now() + '_6',
        type: 'table',
        content: '{{items_table}}',
        x: 40,
        y: 270,
        width: 510,
        height: 180,
        fontSize: 12,
        fontFamily: 'Inter',
        color: '#111827',
        zIndex: 6
      },
      {
        id: 'el_' + Date.now() + '_7',
        type: 'totals',
        content: 'Subtotal: {{subtotal}}\nTax: {{tax_amount}}\nDiscount: {{discount_amount}}\nTotal: {{grand_total}}',
        x: 330,
        y: 470,
        width: 220,
        height: 100,
        fontSize: 13,
        fontFamily: 'Inter',
        color: '#111827',
        align: 'right',
        zIndex: 7
      },
      {
        id: 'el_' + Date.now() + '_8',
        type: 'bank',
        content: 'BANK REMITTANCE:\n{{bank_details}}',
        x: 40,
        y: 590,
        width: 320,
        height: 70,
        fontSize: 11,
        fontFamily: 'Inter',
        color: '#4b5563',
        zIndex: 8
      },
      {
        id: 'el_' + Date.now() + '_9',
        type: 'notes',
        content: 'Payment Terms & Notes: {{notes}}',
        x: 40,
        y: 680,
        width: 510,
        height: 50,
        fontSize: 11,
        fontFamily: 'Inter',
        color: '#6b7280',
        zIndex: 9
      }
    ];
  },

  renderCanvas() {
    const sheet = document.getElementById('canvasSheet');
    if (!sheet) return;

    // Apply zoom
    sheet.style.transform = `scale(${this.zoomLevel})`;
    sheet.style.transformOrigin = 'top center';

    // Remove old elements except grid
    const oldEls = sheet.querySelectorAll('.canvas-element');
    oldEls.forEach(el => el.remove());

    this.elements.forEach(item => {
      const elDiv = document.createElement('div');
      elDiv.id = item.id;
      elDiv.className = `canvas-element el-type-${item.type} ${item.id === this.selectedElementId ? 'selected' : ''}`;
      
      elDiv.style.left = `${item.x}px`;
      elDiv.style.top = `${item.y}px`;
      elDiv.style.width = `${item.width}px`;
      elDiv.style.height = `${item.height}px`;
      elDiv.style.zIndex = item.zIndex || 1;

      if (item.bgColor) elDiv.style.backgroundColor = item.bgColor;
      if (item.color) elDiv.style.color = item.color;
      if (item.fontSize) elDiv.style.fontSize = `${item.fontSize}px`;
      if (item.fontFamily) elDiv.style.fontFamily = item.fontFamily;
      if (item.fontWeight) elDiv.style.fontWeight = item.fontWeight;
      if (item.align) elDiv.style.textAlign = item.align;
      if (item.borderWidth) elDiv.style.border = `${item.borderWidth}px ${item.borderStyle || 'solid'} ${item.borderColor || '#cbd5e1'}`;
      if (item.borderRadius) elDiv.style.borderRadius = `${item.borderRadius}px`;
      if (item.padding) elDiv.style.padding = `${item.padding}px`;

      // Render content
      elDiv.innerHTML = this.renderElementContent(item);

      // Add resize handles if selected
      if (item.id === this.selectedElementId) {
        elDiv.appendChild(this.createResizeHandles());
      }

      this.makeElementInteractive(elDiv, item);
      sheet.appendChild(elDiv);
    });

    this.renderPropertiesPanel();
  },

  renderElementContent(item) {
    if (item.type === 'table') {
      return `
        <table class="designer-mock-table">
          <thead>
            <tr>
              <th>Description</th>
              <th style="width: 50px;">Qty</th>
              <th style="width: 70px;">Price</th>
              <th style="width: 80px;">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Backend API Integration</td><td>1</td><td>£1,500.00</td><td>£1,500.00</td></tr>
            <tr><td>Cloud Architecture Retainer</td><td>2</td><td>£450.00</td><td>£900.00</td></tr>
          </tbody>
        </table>
      `;
    }
    if (item.type === 'line') {
      return `<div style="width: 100%; height: 100%; background: ${item.bgColor || '#e5e7eb'};"></div>`;
    }
    if (item.type === 'image') {
      return `<div class="mock-logo-box">${item.imgUrl ? `<img src="${item.imgUrl}" alt="logo"/>` : '🏢 [Company Logo Placeholder]'}</div>`;
    }
    return `<div class="element-text-content">${(item.content || '').replace(/\n/g, '<br/>')}</div>`;
  },

  createResizeHandles() {
    const wrap = document.createElement('div');
    wrap.className = 'resize-handles-group';
    ['nw', 'ne', 'sw', 'se', 'e', 's'].forEach(dir => {
      const handle = document.createElement('div');
      handle.className = `resize-handle handle-${dir}`;
      handle.setAttribute('data-handle', dir);
      wrap.appendChild(handle);
    });
    return wrap;
  },

  makeElementInteractive(domEl, item) {
    let isDragging = false;
    let isResizing = false;
    let resizeDir = '';
    let startX = 0, startY = 0;
    let origX = 0, origY = 0, origW = 0, origH = 0;

    domEl.onmousedown = (e) => {
      e.stopPropagation();
      this.selectedElementId = item.id;
      this.renderCanvas();
      this.updateLayersList();

      const handle = e.target.getAttribute('data-handle');
      if (handle) {
        isResizing = true;
        resizeDir = handle;
      } else {
        isDragging = true;
      }

      startX = e.clientX;
      startY = e.clientY;
      origX = item.x;
      origY = item.y;
      origW = item.width;
      origH = item.height;

      const onMouseMove = (moveEvent) => {
        const dx = (moveEvent.clientX - startX) / this.zoomLevel;
        const dy = (moveEvent.clientY - startY) / this.zoomLevel;

        if (isDragging) {
          let newX = origX + dx;
          let newY = origY + dy;
          if (this.snapToGrid) {
            newX = Math.round(newX / 10) * 10;
            newY = Math.round(newY / 10) * 10;
          }
          item.x = Math.max(0, Math.min(595 - item.width, newX));
          item.y = Math.max(0, Math.min(842 - item.height, newY));
          domEl.style.left = `${item.x}px`;
          domEl.style.top = `${item.y}px`;
        } else if (isResizing) {
          if (resizeDir.includes('e')) {
            item.width = Math.max(30, origW + dx);
            domEl.style.width = `${item.width}px`;
          }
          if (resizeDir.includes('s')) {
            item.height = Math.max(15, origH + dy);
            domEl.style.height = `${item.height}px`;
          }
        }
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        if (isDragging || isResizing) {
          this.pushHistoryState();
          this.renderPropertiesPanel();
        }
        isDragging = false;
        isResizing = false;
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    // Double-click to inline edit text
    domEl.ondblclick = (e) => {
      e.stopPropagation();
      if (item.type === 'line' || item.type === 'table') return;
      const newText = prompt('Edit element text content / merge fields:', item.content);
      if (newText !== null) {
        item.content = newText;
        this.renderCanvas();
        this.pushHistoryState();
      }
    };
  },

  renderPropertiesPanel() {
    const noSel = document.getElementById('noSelectionMsg');
    const formWrap = document.getElementById('propsFormWrapper');
    if (!noSel || !formWrap) return;

    const item = this.elements.find(e => e.id === this.selectedElementId);
    if (!item) {
      noSel.classList.remove('hidden');
      formWrap.classList.add('hidden');
      return;
    }

    noSel.classList.add('hidden');
    formWrap.classList.remove('hidden');

    formWrap.innerHTML = `
      <div class="props-section-title">ELEMENT TYPE: ${item.type.toUpperCase()}</div>

      <!-- Text / Content -->
      ${item.type !== 'line' && item.type !== 'table' ? `
        <div class="form-group">
          <label>Content / Dynamic Template</label>
          <textarea id="propContent" class="form-input" rows="3">${item.content || ''}</textarea>
        </div>
      ` : ''}

      <!-- Typography -->
      ${item.type !== 'line' ? `
        <div class="props-section-title">TYPOGRAPHY</div>
        <div class="form-grid-2">
          <div class="form-group">
            <label>Font Size (px)</label>
            <input type="number" id="propFontSize" class="form-input" value="${item.fontSize || 12}" min="8" max="72" />
          </div>
          <div class="form-group">
            <label>Font Weight</label>
            <select id="propFontWeight" class="form-input">
              <option value="normal" ${item.fontWeight !== 'bold' ? 'selected' : ''}>Regular</option>
              <option value="bold" ${item.fontWeight === 'bold' ? 'selected' : ''}>Bold</option>
            </select>
          </div>
        </div>
        <div class="form-grid-2">
          <div class="form-group">
            <label>Font Family</label>
            <select id="propFontFamily" class="form-input">
              <option value="Inter">Inter (Sans)</option>
              <option value="Roboto">Roboto</option>
              <option value="Playfair Display">Playfair (Serif)</option>
              <option value="Courier New">Courier (Mono)</option>
            </select>
          </div>
          <div class="form-group">
            <label>Text Align</label>
            <select id="propAlign" class="form-input">
              <option value="left" ${item.align === 'left' ? 'selected' : ''}>Left</option>
              <option value="center" ${item.align === 'center' ? 'selected' : ''}>Center</option>
              <option value="right" ${item.align === 'right' ? 'selected' : ''}>Right</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>Text Color</label>
          <input type="color" id="propTextColor" class="form-input" value="${item.color || '#111827'}" />
        </div>
      ` : ''}

      <!-- Appearance -->
      <div class="props-section-title">APPEARANCE</div>
      <div class="form-grid-2">
        <div class="form-group">
          <label>Background Color</label>
          <input type="color" id="propBgColor" class="form-input" value="${item.bgColor || '#ffffff'}" />
        </div>
        <div class="form-group">
          <label>Border Width (px)</label>
          <input type="number" id="propBorderWidth" class="form-input" value="${item.borderWidth || 0}" min="0" max="10" />
        </div>
      </div>
      <div class="form-grid-2">
        <div class="form-group">
          <label>Border Color</label>
          <input type="color" id="propBorderColor" class="form-input" value="${item.borderColor || '#cbd5e1'}" />
        </div>
        <div class="form-group">
          <label>Border Radius</label>
          <input type="number" id="propBorderRadius" class="form-input" value="${item.borderRadius || 0}" min="0" max="30" />
        </div>
      </div>

      <!-- Geometry -->
      <div class="props-section-title">POSITION &amp; DIMENSIONS</div>
      <div class="form-grid-2">
        <div class="form-group">
          <label>X (Left)</label>
          <input type="number" id="propX" class="form-input" value="${Math.round(item.x)}" />
        </div>
        <div class="form-group">
          <label>Y (Top)</label>
          <input type="number" id="propY" class="form-input" value="${Math.round(item.y)}" />
        </div>
      </div>
      <div class="form-grid-2">
        <div class="form-group">
          <label>Width</label>
          <input type="number" id="propW" class="form-input" value="${Math.round(item.width)}" />
        </div>
        <div class="form-group">
          <label>Height</label>
          <input type="number" id="propH" class="form-input" value="${Math.round(item.height)}" />
        </div>
      </div>

      <div class="mt-4 flex-between">
        <button class="btn btn-danger btn-sm" id="btnDeleteSelectedEl">🗑️ Delete Element</button>
      </div>
    `;

    // Bind property changes
    const bindProp = (id, prop, isNum = false) => {
      const el = formWrap.querySelector(`#${id}`);
      if (el) {
        el.oninput = () => {
          item[prop] = isNum ? parseFloat(el.value) || 0 : el.value;
          this.renderCanvas();
        };
      }
    };

    bindProp('propContent', 'content');
    bindProp('propFontSize', 'fontSize', true);
    bindProp('propFontWeight', 'fontWeight');
    bindProp('propFontFamily', 'fontFamily');
    bindProp('propAlign', 'align');
    bindProp('propTextColor', 'color');
    bindProp('propBgColor', 'bgColor');
    bindProp('propBorderWidth', 'borderWidth', true);
    bindProp('propBorderColor', 'borderColor');
    bindProp('propBorderRadius', 'borderRadius', true);
    bindProp('propX', 'x', true);
    bindProp('propY', 'y', true);
    bindProp('propW', 'width', true);
    bindProp('propH', 'height', true);

    const delBtn = formWrap.querySelector('#btnDeleteSelectedEl');
    if (delBtn) {
      delBtn.onclick = () => {
        this.elements = this.elements.filter(e => e.id !== this.selectedElementId);
        this.selectedElementId = null;
        this.renderCanvas();
        this.updateLayersList();
        this.pushHistoryState();
      };
    }
  },

  updateLayersList() {
    const listEl = document.getElementById('layersList');
    const countEl = document.getElementById('layerCount');
    if (!listEl) return;

    if (countEl) countEl.innerText = this.elements.length;

    listEl.innerHTML = this.elements.map((item, idx) => `
      <div class="layer-item ${item.id === this.selectedElementId ? 'active' : ''}" data-id="${item.id}">
        <span class="layer-name">${item.type.toUpperCase()}: ${(item.content || item.id).slice(0, 18)}</span>
        <div class="layer-actions">
          <button class="btn-icon btn-sm" onclick="DesignerView.reorderLayer('${item.id}', -1)" title="Send Backward">▼</button>
          <button class="btn-icon btn-sm" onclick="DesignerView.reorderLayer('${item.id}', 1)" title="Bring Forward">▲</button>
        </div>
      </div>
    `).join('');

    listEl.querySelectorAll('.layer-item').forEach(li => {
      li.onclick = (e) => {
        if (e.target.tagName === 'BUTTON') return;
        this.selectedElementId = li.getAttribute('data-id');
        this.renderCanvas();
        this.updateLayersList();
      };
    });
  },

  reorderLayer(id, direction) {
    const idx = this.elements.findIndex(e => e.id === id);
    if (idx === -1) return;
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= this.elements.length) return;

    const tmp = this.elements[idx];
    this.elements[idx] = this.elements[targetIdx];
    this.elements[targetIdx] = tmp;

    // re-assign zIndexes
    this.elements.forEach((el, i) => { el.zIndex = i + 1; });
    this.renderCanvas();
    this.updateLayersList();
    this.pushHistoryState();
  },

  bindEvents(container) {
    // Add Elements Tool buttons
    container.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
      btn.onclick = () => {
        const tool = btn.getAttribute('data-tool');
        this.addElement(tool);
      };
    });

    // Add Dynamic Field Chips
    container.querySelectorAll('.field-chip').forEach(chip => {
      chip.onclick = () => {
        const field = chip.getAttribute('data-field');
        this.addElement('field', field);
      };
    });

    // Zoom buttons
    const zoomText = container.querySelector('#zoomDisplay');
    const updateZoom = (z) => {
      this.zoomLevel = Math.max(0.4, Math.min(2.0, z));
      if (zoomText) zoomText.innerText = `${Math.round(this.zoomLevel * 100)}%`;
      this.renderCanvas();
    };

    container.querySelector('#btnZoomIn').onclick = () => updateZoom(this.zoomLevel + 0.15);
    container.querySelector('#btnZoomOut').onclick = () => updateZoom(this.zoomLevel - 0.15);
    container.querySelector('#btnZoomFit').onclick = () => updateZoom(1.0);

    // Snap to grid
    const chkGrid = container.querySelector('#chkSnapGrid');
    if (chkGrid) {
      chkGrid.onchange = () => {
        this.snapToGrid = chkGrid.checked;
        const overlay = document.getElementById('gridOverlay');
        if (overlay) overlay.style.display = this.snapToGrid ? 'block' : 'none';
      };
    }

    // Tabs in Right Panel
    const tabProps = container.querySelector('#tabPropsBtn');
    const tabLayers = container.querySelector('#tabLayersBtn');
    const contentProps = container.querySelector('#tabPropsContent');
    const contentLayers = container.querySelector('#tabLayersContent');

    tabProps.onclick = () => {
      tabProps.classList.add('active');
      tabLayers.classList.remove('active');
      contentProps.classList.remove('hidden');
      contentLayers.classList.add('hidden');
    };
    tabLayers.onclick = () => {
      tabLayers.classList.add('active');
      tabProps.classList.remove('active');
      contentLayers.classList.remove('hidden');
      contentProps.classList.add('hidden');
      this.updateLayersList();
    };

    // Undo / Redo
    container.querySelector('#btnUndo').onclick = () => this.undo();
    container.querySelector('#btnRedo').onclick = () => this.redo();

    // Deselect on canvas click
    const canvasSheet = container.querySelector('#canvasSheet');
    canvasSheet.onmousedown = (e) => {
      if (e.target === canvasSheet || e.target.id === 'gridOverlay') {
        this.selectedElementId = null;
        this.renderCanvas();
        this.updateLayersList();
      }
    };

    // Keyboard delete & shortcuts
    document.onkeydown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (this.selectedElementId) {
          this.elements = this.elements.filter(el => el.id !== this.selectedElementId);
          this.selectedElementId = null;
          this.renderCanvas();
          this.updateLayersList();
          this.pushHistoryState();
        }
      } else if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        this.undo();
      } else if (e.ctrlKey && e.key === 'y') {
        e.preventDefault();
        this.redo();
      }
    };

    // Save Template
    const saveBtn = container.querySelector('#btnSaveTemplate');
    saveBtn.onclick = async () => {
      const name = container.querySelector('#designerTmplName')?.value || 'Custom Template';
      const company_id = container.querySelector('#designerCompanySelect')?.value;
      const is_default = container.querySelector('#designerIsDefault')?.checked;

      const payload = {
        name,
        company_id,
        is_default,
        type: 'designer',
        config_json: JSON.stringify({ elements: this.elements })
      };

      try {
        if (this.templateId) {
          await API.updateTemplate(this.templateId, payload);
          State.notify('Template saved successfully!', 'success');
        } else {
          const res = await API.createTemplate(payload);
          this.templateId = res.data.id;
          State.notify('New template created and saved!', 'success');
        }
      } catch (err) {
        State.notify(`Error saving template: ${err.message}`, 'error');
      }
    };

    // Preview PDF
    const prevBtn = container.querySelector('#btnPreviewCanvasPdf');
    prevBtn.onclick = () => {
      if (window.html2pdf) {
        const sheet = document.getElementById('canvasSheet');
        const opt = {
          margin: 0,
          filename: `${container.querySelector('#designerTmplName')?.value || 'Template'}-Sample.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2 },
          jsPDF: { unit: 'pt', format: 'a4', orientation: 'portrait' }
        };
        html2pdf().set(opt).from(sheet).save();
      }
    };
  },

  addElement(toolType, customContent = '') {
    const id = 'el_' + Date.now();
    const newEl = {
      id,
      type: toolType,
      content: customContent || (toolType === 'text' ? 'New Text Header' : `{{${toolType}}}`),
      x: 100,
      y: 150,
      width: toolType === 'line' ? 400 : (toolType === 'table' ? 510 : 200),
      height: toolType === 'line' ? 2 : (toolType === 'table' ? 120 : 40),
      fontSize: toolType === 'text' ? 16 : 12,
      fontFamily: 'Inter',
      color: '#111827',
      align: 'left',
      zIndex: this.elements.length + 1
    };

    if (toolType === 'box') {
      newEl.content = '';
      newEl.width = 180;
      newEl.height = 80;
      newEl.bgColor = '#f8fafc';
      newEl.borderWidth = 1;
      newEl.borderColor = '#cbd5e1';
      newEl.borderRadius = 6;
    }

    this.elements.push(newEl);
    this.selectedElementId = id;
    this.renderCanvas();
    this.updateLayersList();
    this.pushHistoryState();
  },

  pushHistoryState() {
    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push(JSON.stringify(this.elements));
    this.historyIndex++;
  },

  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.elements = JSON.parse(this.history[this.historyIndex]);
      this.renderCanvas();
      this.updateLayersList();
    }
  },

  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.elements = JSON.parse(this.history[this.historyIndex]);
      this.renderCanvas();
      this.updateLayersList();
    }
  }
};

window.DesignerView = DesignerView;
