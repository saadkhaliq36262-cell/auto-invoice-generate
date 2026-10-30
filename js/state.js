/**
 * Global State & Utilities for AutoInvoice Pro
 */
const State = {
  currentCompanyId: localStorage.getItem('autoinvoice_company_id') || 'all',
  companies: [],
  activeCompany: null,
  userProfile: {
    name: 'Saad Khaliq',
    role: 'Admin / Owner',
    email: 'saad.digiaura360@gmail.com'
  },

  async init() {
    try {
      const res = await API.getCompanies();
      this.companies = res.data || [];
      
      // If current company not found or set to default, resolve
      if (this.currentCompanyId !== 'all') {
        this.activeCompany = this.companies.find(c => c.id === this.currentCompanyId) || null;
        if (!this.activeCompany && this.companies.length > 0) {
          const defaultComp = this.companies.find(c => c.is_default) || this.companies[0];
          this.setCurrentCompany(defaultComp.id);
        }
      } else {
        this.activeCompany = null;
      }
    } catch (err) {
      console.error('Failed to initialize state companies:', err);
    }
  },

  setCurrentCompany(companyId) {
    this.currentCompanyId = companyId;
    localStorage.setItem('autoinvoice_company_id', companyId);
    this.activeCompany = this.companies.find(c => c.id === companyId) || null;
    
    // Dispatch custom event for views to re-render
    window.dispatchEvent(new CustomEvent('companyChanged', { detail: { companyId, company: this.activeCompany } }));
  },

  getCurrencySymbol(currencyCode) {
    const map = {
      'GBP': '£',
      'USD': '$',
      'EUR': '€',
      'PKR': 'Rs.',
      'CAD': 'CA$',
      'AUD': 'A$',
      'AED': 'AED '
    };
    return map[currencyCode] || currencyCode || '$';
  },

  formatMoney(amount, currencyCode = null) {
    const code = currencyCode || (this.activeCompany ? this.activeCompany.currency : 'USD');
    const symbol = this.getCurrencySymbol(code);
    const num = parseFloat(amount) || 0;
    return `${symbol}${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  },

  formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  },

  notify(message, type = 'info') {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    toast.innerHTML = `<span class="toast-icon">${icon}</span> <div class="toast-message">${message}</div>`;
    
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('toast-fadeout');
      setTimeout(() => toast.remove(), 400);
    }, 3500);
  }
};

window.State = State;
