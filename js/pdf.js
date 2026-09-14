/**
 * PDF Generator module using html2pdf.js for standard A4 export
 */
class PDFExporter {
  /**
   * Export the invoice preview DOM element to a high-quality A4 PDF
   * @param {HTMLElement} element - The DOM element containing the invoice preview
   * @param {InvoiceModel} invoice - The current invoice model instance
   * @param {Function} onProgress - Optional callback for UI progress feedback
   * @returns {Promise<string>} Downloaded filename
   */
  static async exportToPDF(element, invoice, onProgress = null) {
    if (!element) {
      throw new Error('Invoice preview element not found.');
    }

    const filename = invoice.getFilename();

    if (onProgress) onProgress({ status: 'starting', message: 'Preparing invoice document...' });

    // Check if html2pdf is available
    if (typeof html2pdf === 'undefined') {
      console.warn('html2pdf library not loaded, falling back to window.print()');
      if (onProgress) onProgress({ status: 'fallback', message: 'Opening system print dialog...' });
      window.print();
      return filename;
    }

    // Configure high-resolution A4 settings
    const opt = {
      margin: [8, 8, 8, 8], // mm
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2, // High resolution (2x retina quality)
        useCORS: true,
        logging: false,
        letterRendering: true,
        scrollY: 0,
        scrollX: 0
      },
      jsPDF: {
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait',
        compress: true
      },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    try {
      if (onProgress) onProgress({ status: 'rendering', message: 'Rendering A4 PDF canvas...' });

      // Create a temporary clone for rendering to ensure exact A4 styling without UI scale distortion
      const clone = element.cloneNode(true);
      clone.classList.add('pdf-render-mode');
      clone.style.width = '210mm';
      clone.style.minHeight = '297mm';
      clone.style.padding = '12mm';
      clone.style.boxShadow = 'none';
      clone.style.borderRadius = '0';
      clone.style.backgroundColor = '#ffffff';
      clone.style.position = 'fixed';
      clone.style.top = '-9999px';
      clone.style.left = '-9999px';
      clone.style.zIndex = '-1000';
      
      document.body.appendChild(clone);

      if (onProgress) onProgress({ status: 'generating', message: 'Compiling PDF document...' });

      await html2pdf().set(opt).from(clone).save();

      // Clean up clone
      document.body.removeChild(clone);

      if (onProgress) onProgress({ status: 'complete', message: `Saved ${filename}` });
      return filename;
    } catch (err) {
      console.error('PDF generation error:', err);
      if (onProgress) onProgress({ status: 'error', message: 'Failed to generate PDF: ' + err.message });
      throw err;
    }
  }

  /**
   * Native Print trigger
   */
  static printInvoice() {
    window.print();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PDFExporter };
}
