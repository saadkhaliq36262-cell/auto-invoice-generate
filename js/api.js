/**
 * API Service for AutoInvoice Pro
 * Wraps all REST API calls with error handling and consistent JSON responses.
 */
const API = {
  baseUrl: '',

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return data;
    } catch (err) {
      console.error(`API Error on ${endpoint}:`, err);
      throw err;
    }
  },

  // --- Companies ---
  getCompanies(includeArchived = false) {
    return this.request(`/api/companies?include_archived=${includeArchived}`);
  },
  getCompany(id) {
    return this.request(`/api/companies/${id}`);
  },
  createCompany(data) {
    return this.request('/api/companies', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },
  updateCompany(id, data) {
    return this.request(`/api/companies/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },
  deleteCompany(id) {
    return this.request(`/api/companies/${id}`, {
      method: 'DELETE'
    });
  },
  setDefaultCompany(id) {
    return this.request(`/api/companies/${id}/set-default`, {
      method: 'POST'
    });
  },

  // --- Clients ---
  getClients(companyId = 'all', search = '') {
    let q = `/api/clients?company_id=${companyId}`;
    if (search) q += `&search=${encodeURIComponent(search)}`;
    return this.request(q);
  },
  getClient(id) {
    return this.request(`/api/clients/${id}`);
  },
  createClient(data) {
    return this.request('/api/clients', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },
  updateClient(id, data) {
    return this.request(`/api/clients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },
  deleteClient(id) {
    return this.request(`/api/clients/${id}`, {
      method: 'DELETE'
    });
  },

  // --- Invoices ---
  getInvoices(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/invoices?${query}`);
  },
  getInvoice(id) {
    return this.request(`/api/invoices/${id}`);
  },
  getNextInvoiceNumber(companyId) {
    return this.request(`/api/invoices/next-number?company_id=${companyId}`);
  },
  createInvoice(data) {
    return this.request('/api/invoices', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },
  updateInvoice(id, data) {
    return this.request(`/api/invoices/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },
  deleteInvoice(id) {
    return this.request(`/api/invoices/${id}`, {
      method: 'DELETE'
    });
  },
  duplicateInvoice(id) {
    return this.request(`/api/invoices/${id}/duplicate`, {
      method: 'POST'
    });
  },
  updateInvoiceStatus(id, status) {
    return this.request(`/api/invoices/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
  },

  // --- Payments ---
  getPayments(companyId = 'all') {
    return this.request(`/api/payments?company_id=${companyId}`);
  },
  getInvoicePayments(invoiceId) {
    return this.request(`/api/payments/invoice/${invoiceId}`);
  },
  recordPayment(data) {
    return this.request('/api/payments', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },
  deletePayment(id) {
    return this.request(`/api/payments/${id}`, {
      method: 'DELETE'
    });
  },

  // --- Templates ---
  getTemplates(companyId = 'all') {
    return this.request(`/api/templates?company_id=${companyId}`);
  },
  getTemplate(id) {
    return this.request(`/api/templates/${id}`);
  },
  createTemplate(data) {
    return this.request('/api/templates', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },
  updateTemplate(id, data) {
    return this.request(`/api/templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },
  deleteTemplate(id) {
    return this.request(`/api/templates/${id}`, {
      method: 'DELETE'
    });
  },
  duplicateTemplate(id) {
    return this.request(`/api/templates/${id}/duplicate`, {
      method: 'POST'
    });
  },
  setDefaultTemplate(id) {
    return this.request(`/api/templates/${id}/set-default`, {
      method: 'POST'
    });
  },

  // --- Dashboard ---
  getDashboardStats(companyId = 'all') {
    return this.request(`/api/dashboard/stats?company_id=${companyId}`);
  },
  getRecentInvoices(companyId = 'all', limit = 10) {
    return this.request(`/api/dashboard/recent-invoices?company_id=${companyId}&limit=${limit}`);
  },
  getMonthlyBreakdown(companyId = 'all') {
    return this.request(`/api/dashboard/monthly-breakdown?company_id=${companyId}`);
  },

  // --- Email & Mailbox ---
  getEmailTemplates() {
    return this.request('/api/email/templates');
  },
  getEmailAccount(companyId) {
    return this.request(`/api/email/accounts?company_id=${companyId}`);
  },
  saveEmailAccount(data) {
    return this.request('/api/email/accounts', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },
  getEmailMessages(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/email/messages?${query}`);
  },
  sendEmail(data) {
    return this.request('/api/email/send', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },
  syncEmailReplies(companyId) {
    return this.request('/api/email/sync-replies', {
      method: 'POST',
      body: JSON.stringify({ company_id: companyId })
    });
  },

  // --- Referrals ---
  getReferralStats() {
    return this.request('/api/referrals/stats');
  },
  createReferral(data) {
    return this.request('/api/referrals', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // --- MCP Tokens ---
  getMcpTokens() {
    return this.request('/api/mcp-tokens');
  },
  createMcpToken(data) {
    return this.request('/api/mcp-tokens', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },
  deleteMcpToken(id) {
    return this.request(`/api/mcp-tokens/${id}`, {
      method: 'DELETE'
    });
  },
  getMcpInfo() {
    return this.request('/api/mcp-tokens/info');
  },

  // --- AI Assistant ---
  askAssistant(message, companyId) {
    return this.request('/api/assistant/chat', {
      method: 'POST',
      body: JSON.stringify({ message, company_id: companyId })
    });
  }
};

window.API = API;
