/**
 * PDF Template Uploader & Field Mapper for AutoInvoice Pro
 */
const PdfUploadView = {
  render(container) {
    const companies = State.companies || [];
    const defaultCompanyId = State.currentCompanyId !== 'all' ? State.currentCompanyId : (companies[0]?.id || '');

    container.innerHTML = `
      <div class="view-header">
        <div>
          <a href="#templates" class="back-link">&larr; Back to Templates</a>
          <div class="view-title">Upload PDF Template</div>
          <div class="view-subtitle">Upload an existing branded PDF background and map dynamic invoice text fields</div>
        </div>
      </div>

      <div class="card p-4">
        <form id="pdfUploadForm">
          <div class="form-grid-2">
            <div class="form-group">
              <label>Template Name *</label>
              <input type="text" name="name" class="form-input" placeholder="e.g. Corporate Standard PDF" required />
            </div>
            <div class="form-group">
              <label>Target Company *</label>
              <select name="company_id" class="form-input" required>
                ${companies.map(c => `
                  <option value="${c.id}" ${c.id === defaultCompanyId ? 'selected' : ''}>${c.name}</option>
                `).join('')}
              </select>
            </div>
          </div>

          <div class="upload-dropzone mt-3" id="pdfDropzone">
            <div class="dropzone-icon">📄</div>
            <div class="dropzone-title">Click to browse or drag &amp; drop your PDF invoice template</div>
            <div class="text-xs text-muted mt-1">A4 format recommended • Vector PDF supported</div>
            <input type="file" id="pdfFileInput" name="pdf" accept="application/pdf" class="hidden" required />
          </div>

          <div id="pdfSelectedInfo" class="mt-3 p-3 bg-subtle rounded hidden flex-between">
            <div>
              <strong id="pdfSelectedFilename">template.pdf</strong>
              <span class="text-xs text-muted" id="pdfSelectedSize">—</span>
            </div>
            <span class="text-success text-xs font-bold">✓ PDF Ready for Mapping</span>
          </div>

          <div class="form-section-title mt-4">DEFAULT DYNAMIC FIELD MAPPINGS</div>
          <div class="form-grid-3 text-sm">
            <label class="checkbox-label"><input type="checkbox" checked /> <span>Map Invoice Number</span></label>
            <label class="checkbox-label"><input type="checkbox" checked /> <span>Map Issue &amp; Due Dates</span></label>
            <label class="checkbox-label"><input type="checkbox" checked /> <span>Map Client Details</span></label>
            <label class="checkbox-label"><input type="checkbox" checked /> <span>Map Line Items Table</span></label>
            <label class="checkbox-label"><input type="checkbox" checked /> <span>Map Financial Totals</span></label>
            <label class="checkbox-label"><input type="checkbox" checked /> <span>Map Bank Wire Details</span></label>
          </div>

          <div class="mt-4 flex-end gap-2">
            <a href="#templates" class="btn btn-secondary">Cancel</a>
            <button type="submit" class="btn btn-primary" id="btnSubmitPdf">Save PDF Template</button>
          </div>
        </form>
      </div>
    `;

    this.bindEvents(container);
  },

  bindEvents(container) {
    const dropzone = container.querySelector('#pdfDropzone');
    const fileInput = container.querySelector('#pdfFileInput');
    const infoBox = container.querySelector('#pdfSelectedInfo');
    const nameEl = container.querySelector('#pdfSelectedFilename');
    const sizeEl = container.querySelector('#pdfSelectedSize');
    const form = container.querySelector('#pdfUploadForm');

    dropzone.onclick = () => fileInput.click();

    fileInput.onchange = () => {
      if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        nameEl.innerText = file.name;
        sizeEl.innerText = `${(file.size / 1024).toFixed(1)} KB`;
        infoBox.classList.remove('hidden');
      }
    };

    form.onsubmit = async (e) => {
      e.preventDefault();
      const file = fileInput.files[0];
      if (!file) {
        State.notify('Please select a PDF file first.', 'error');
        return;
      }

      const formData = new FormData(form);
      const submitBtn = container.querySelector('#btnSubmitPdf');
      submitBtn.disabled = true;
      submitBtn.innerText = 'Uploading & Mapping...';

      try {
        const res = await fetch('/api/templates/upload-pdf', {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');

        State.notify('PDF Template uploaded and saved successfully!', 'success');
        window.location.hash = '#templates';
      } catch (err) {
        State.notify(`Upload failed: ${err.message}`, 'error');
        submitBtn.disabled = false;
        submitBtn.innerText = 'Save PDF Template';
      }
    };
  }
};

window.PdfUploadView = PdfUploadView;
