/**
 * Invoice Data Model and Financial Calculation Engine
 */

const CURRENCIES = {
  USD: { symbol: '$', code: 'USD', name: 'US Dollar ($)' },
  EUR: { symbol: '€', code: 'EUR', name: 'Euro (€)' },
  GBP: { symbol: '£', code: 'GBP', name: 'British Pound (£)' },
  CAD: { symbol: 'CA$', code: 'CAD', name: 'Canadian Dollar (CA$)' },
  AUD: { symbol: 'AU$', code: 'AUD', name: 'Australian Dollar (AU$)' },
  PKR: { symbol: 'Rs ', code: 'PKR', name: 'Pakistani Rupee (Rs)' },
  INR: { symbol: '₹', code: 'INR', name: 'Indian Rupee (₹)' },
  AED: { symbol: 'AED ', code: 'AED', name: 'UAE Dirham (AED)' },
  SAR: { symbol: 'SAR ', code: 'SAR', name: 'Saudi Riyal (SAR)' },
  JPY: { symbol: '¥', code: 'JPY', name: 'Japanese Yen (¥)' },
  SGD: { symbol: 'SG$', code: 'SGD', name: 'Singapore Dollar (SG$)' },
  CHF: { symbol: 'CHF ', code: 'CHF', name: 'Swiss Franc (CHF)' }
};

class InvoiceModel {
  constructor(data = {}) {
    this.id = data.id || 'inv_' + Date.now();
    this.company = {
      name: data.company?.name || 'Acme Solutions Inc.',
      email: data.company?.email || 'billing@acmesolutions.com',
      phone: data.company?.phone || '+1 (555) 234-5678',
      address: data.company?.address || '742 Evergreen Terrace, Suite 100\nSpringfield, OR 97477',
      taxId: data.company?.taxId || 'TAX-US-98765432',
      logoUrl: data.company?.logoUrl || ''
    };

    this.customer = {
      name: data.customer?.name || 'Ali Khan',
      email: data.customer?.email || 'ali.khan@example.com',
      phone: data.customer?.phone || '+1 (555) 987-6543',
      address: data.customer?.address || '456 Innovation Way, Tech Park\nSeattle, WA 98101',
      customerId: data.customer?.customerId || 'CUST-0892'
    };

    const today = new Date().toISOString().split('T')[0];
    const defaultDue = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];

    this.invoiceMeta = {
      invoiceNumber: data.invoiceMeta?.invoiceNumber || 'INV-0001',
      invoiceDate: data.invoiceMeta?.invoiceDate || today,
      dueDate: data.invoiceMeta?.dueDate || defaultDue,
      paymentStatus: data.invoiceMeta?.paymentStatus || 'Pending', // 'Pending', 'Paid', 'Overdue', 'Draft'
      paymentTerms: data.invoiceMeta?.paymentTerms || 'Net 14', // 'Due on Receipt', 'Net 14', 'Net 30', 'Net 60', 'Custom'
      poNumber: data.invoiceMeta?.poNumber || '',
      currency: data.invoiceMeta?.currency || 'USD'
    };

    this.items = (data.items && data.items.length > 0) ? data.items.map(item => ({
      id: item.id || 'item_' + Math.random().toString(36).substr(2, 9),
      description: item.description || '',
      quantity: parseFloat(item.quantity) || 1,
      price: parseFloat(item.price) || 0,
      taxRate: parseFloat(item.taxRate) || 0
    })) : [
      {
        id: 'item_1',
        description: 'Full-Stack Web Application Development & API Integration',
        quantity: 1,
        price: 3500.00,
        taxRate: 0
      },
      {
        id: 'item_2',
        description: 'Cloud Infrastructure Architecture & Automated CI/CD Setup',
        quantity: 1,
        price: 850.00,
        taxRate: 0
      },
      {
        id: 'item_3',
        description: 'Ongoing Maintenance & Technical Support (Monthly Retainer)',
        quantity: 2,
        price: 300.00,
        taxRate: 0
      }
    ];

    this.discount = {
      type: data.discount?.type || 'fixed', // 'fixed' or 'percentage'
      value: parseFloat(data.discount?.value) || 200.00
    };

    this.tax = {
      type: data.tax?.type || 'percentage', // 'percentage' or 'fixed'
      rate: parseFloat(data.tax?.rate) || 10.00
    };

    this.shipping = parseFloat(data.shipping) || 0;

    this.notes = data.notes !== undefined ? data.notes : 'Payment is due within 14 days of invoice date. Thank you for choosing Acme Solutions for your digital technology needs.';
    
    this.paymentDetails = data.paymentDetails !== undefined ? data.paymentDetails : 'Bank Name: Silicon Valley Bank\nAccount Name: Acme Solutions Inc.\nAccount No: 9876-5432-1098\nRouting / SWIFT: SVBUS6SXXX';

    this.themeColor = data.themeColor || 'blue';
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  // Calculation helpers
  getItemSubtotal(item) {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.price) || 0;
    return qty * price;
  }

  calculateSubtotal() {
    return this.items.reduce((sum, item) => sum + this.getItemSubtotal(item), 0);
  }

  calculateDiscountAmount() {
    const subtotal = this.calculateSubtotal();
    const val = parseFloat(this.discount.value) || 0;
    if (this.discount.type === 'percentage') {
      return (subtotal * val) / 100;
    }
    return Math.min(val, subtotal);
  }

  calculateTaxableAmount() {
    const subtotal = this.calculateSubtotal();
    const discount = this.calculateDiscountAmount();
    return Math.max(0, subtotal - discount);
  }

  calculateTaxAmount() {
    const taxable = this.calculateTaxableAmount();
    const rate = parseFloat(this.tax.rate) || 0;
    if (this.tax.type === 'percentage') {
      return (taxable * rate) / 100;
    }
    return rate;
  }

  calculateGrandTotal() {
    const subtotal = this.calculateSubtotal();
    const discount = this.calculateDiscountAmount();
    const tax = this.calculateTaxAmount();
    const shipping = parseFloat(this.shipping) || 0;
    return Math.max(0, subtotal - discount + tax + shipping);
  }

  getCurrencyConfig() {
    return CURRENCIES[this.invoiceMeta.currency] || CURRENCIES.USD;
  }

  formatCurrency(amount) {
    const curr = this.getCurrencyConfig();
    const num = parseFloat(amount) || 0;
    const formattedNum = num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return `${curr.symbol}${formattedNum}`;
  }

  /**
   * Generates exact required PDF filename:
   * Invoice-[Invoice Number]-[Customer Name].pdf
   * Example: Invoice-INV-0001-Ali-Khan.pdf
   */
  getFilename() {
    const rawInvNum = (this.invoiceMeta.invoiceNumber || 'INV-0001').trim();
    const rawCustName = (this.customer.name || 'Customer').trim();

    const sanitize = (str) => {
      return str
        .replace(/[^a-zA-Z0-9.\-_ ]/g, '')
        .trim()
        .replace(/\s+/g, '-');
    };

    const safeInvNum = sanitize(rawInvNum) || 'INV-0001';
    const safeCustName = sanitize(rawCustName) || 'Customer';

    return `Invoice-${safeInvNum}-${safeCustName}.pdf`;
  }

  /**
   * Generates required email draft fields
   */
  generateEmailDraft() {
    const customerEmail = (this.customer.email || '').trim();
    const customerName = (this.customer.name || 'Customer').trim();
    const invoiceNumber = (this.invoiceMeta.invoiceNumber || 'INV-0001').trim();
    const companyName = (this.company.name || 'Our Company').trim();
    const invoiceDate = this.invoiceMeta.invoiceDate || '';
    const dueDate = this.invoiceMeta.dueDate || '';
    const grandTotal = this.formatCurrency(this.calculateGrandTotal());

    const subject = `Invoice ${invoiceNumber} - ${companyName}`;

    const body = `Dear ${customerName},

Please find the invoice details below.

Invoice Number: ${invoiceNumber}
Invoice Date: ${invoiceDate}
Amount Due: ${grandTotal}
Due Date: ${dueDate}

Please review the invoice and let us know if you have any questions.

Thank you for your business.

Best regards,
${companyName}`;

    return {
      recipient: customerEmail,
      subject: subject,
      body: body,
      filename: this.getFilename()
    };
  }

  clone() {
    return new InvoiceModel(JSON.parse(JSON.stringify(this)));
  }

  toJSON() {
    return {
      id: this.id,
      company: { ...this.company },
      customer: { ...this.customer },
      invoiceMeta: { ...this.invoiceMeta },
      items: this.items.map(i => ({ ...i })),
      discount: { ...this.discount },
      tax: { ...this.tax },
      shipping: this.shipping,
      notes: this.notes,
      paymentDetails: this.paymentDetails,
      themeColor: this.themeColor,
      updatedAt: new Date().toISOString()
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { InvoiceModel, CURRENCIES };
}
