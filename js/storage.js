/**
 * Storage Manager for localStorage persistence of Invoices, History, and Profiles
 */
class StorageManager {
  static HISTORY_KEY = 'agy_invoice_history';
  static COMPANY_KEY = 'agy_company_profile';
  static SETTINGS_KEY = 'agy_app_settings';

  /**
   * Get all saved invoices from history
   * @returns {Array<Object>}
   */
  static getInvoices() {
    try {
      const data = localStorage.getItem(this.HISTORY_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Error reading invoice history:', e);
      return [];
    }
  }

  /**
   * Save or update an invoice in history
   * @param {InvoiceModel} invoice 
   * @returns {Array<Object>} Updated history list
   */
  static saveInvoice(invoice) {
    const history = this.getInvoices();
    const invoiceJson = invoice.toJSON();
    const existingIndex = history.findIndex(item => item.id === invoiceJson.id);

    if (existingIndex >= 0) {
      history[existingIndex] = invoiceJson;
    } else {
      history.unshift(invoiceJson); // Add newest at front
    }

    try {
      localStorage.setItem(this.HISTORY_KEY, JSON.stringify(history));
    } catch (e) {
      console.error('Error saving invoice:', e);
    }
    return history;
  }

  /**
   * Delete an invoice by ID
   * @param {string} id 
   * @returns {Array<Object>}
   */
  static deleteInvoice(id) {
    let history = this.getInvoices();
    history = history.filter(item => item.id !== id);
    try {
      localStorage.setItem(this.HISTORY_KEY, JSON.stringify(history));
    } catch (e) {
      console.error('Error deleting invoice:', e);
    }
    return history;
  }

  /**
   * Get an invoice by ID
   * @param {string} id 
   * @returns {Object|null}
   */
  static getInvoiceById(id) {
    const history = this.getInvoices();
    return history.find(item => item.id === id) || null;
  }

  /**
   * Save default company profile
   * @param {Object} companyData 
   */
  static saveCompanyProfile(companyData) {
    try {
      localStorage.setItem(this.COMPANY_KEY, JSON.stringify(companyData));
    } catch (e) {
      console.error('Error saving company profile:', e);
    }
  }

  /**
   * Get default company profile
   * @returns {Object|null}
   */
  static getCompanyProfile() {
    try {
      const data = localStorage.getItem(this.COMPANY_KEY);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('Error reading company profile:', e);
      return null;
    }
  }

  /**
   * Helper to calculate the next invoice number based on history
   * @returns {string} Next formatted invoice number (e.g. INV-0002)
   */
  static getNextInvoiceNumber() {
    const history = this.getInvoices();
    if (!history || history.length === 0) return 'INV-0001';

    let maxNum = 0;
    let prefix = 'INV-';

    for (const inv of history) {
      const numStr = inv.invoiceMeta?.invoiceNumber || '';
      const match = numStr.match(/^(.*?)(\d+)$/);
      if (match) {
        prefix = match[1] || 'INV-';
        const num = parseInt(match[2], 10);
        if (num > maxNum) maxNum = num;
      }
    }

    const nextVal = maxNum + 1;
    const padded = String(nextVal).padStart(4, '0');
    return `${prefix}${padded}`;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { StorageManager };
}
