/**
 * Parser module for extracting invoice details from unstructured or semi-structured raw text.
 */
class RawInvoiceParser {
  /**
   * Parse arbitrary text into structured invoice object
   * @param {string} rawText 
   * @returns {Object} Structured invoice fields
   */
  static parse(rawText) {
    if (!rawText || typeof rawText !== 'string') {
      return {};
    }

    const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    const parsed = {
      company: {},
      customer: {},
      invoiceMeta: {},
      items: [],
      notes: '',
      paymentTerms: '',
      paymentStatus: '',
      bankDetails: '',
      discount: null,
      taxRate: null,
      shipping: null
    };

    let currentSection = 'general';

    // 1. Line-by-line scanning & Key-Value matching
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Detect section headers
      if (/^(items|services|products|line items|order details)\s*:?$/i.test(line)) {
        currentSection = 'items';
        continue;
      }
      if (/^(notes|additional notes|remarks)\s*:?/i.test(line)) {
        currentSection = 'notes';
        const noteContent = line.replace(/^(notes|additional notes|remarks)[:\s-]*/i, '').trim();
        if (noteContent) parsed.notes = noteContent;
        continue;
      }
      if (/^(payment details|bank details|wire instructions|payment info)\s*:?/i.test(line)) {
        currentSection = 'bankDetails';
        const bankContent = line.replace(/^(payment details|bank details|wire instructions|payment info)[:\s-]*/i, '').trim();
        if (bankContent) parsed.bankDetails = bankContent;
        continue;
      }

      // Check if this line is an explicit Key-Value pair first
      const handledKV = this.parseKeyValue(line, parsed);
      if (handledKV) {
        if (handledKV === 'tax' || handledKV === 'discount' || handledKV === 'meta' || handledKV === 'company' || handledKV === 'customer') {
          currentSection = 'general';
        }
        continue;
      }

      // In notes section
      if (currentSection === 'notes') {
        parsed.notes = (parsed.notes ? parsed.notes + '\n' : '') + line;
        continue;
      }

      // In bank details section
      if (currentSection === 'bankDetails') {
        parsed.bankDetails = (parsed.bankDetails ? parsed.bankDetails + '\n' : '') + line;
        continue;
      }

      // In items section (or if line looks like an item)
      if (currentSection === 'items' || this.isItemLine(line)) {
        const item = this.parseItemLine(line);
        if (item) {
          parsed.items.push(item);
          continue;
        }
      }
    }

    // 2. Full text regex fallback for critical fields if not yet extracted
    this.applyGlobalFallbacks(rawText, parsed);

    return parsed;
  }

  /**
   * Parse a line for key-value pairs
   * @returns {string|null} Key category if matched, or null
   */
  static parseKeyValue(line, parsed) {
    const colonIdx = line.indexOf(':');
    const eqIdx = line.indexOf('=');
    const sepIdx = colonIdx !== -1 ? colonIdx : eqIdx;

    if (sepIdx !== -1) {
      const key = line.substring(0, sepIdx).trim().toLowerCase();
      const val = line.substring(sepIdx + 1).trim();

      // Specific keys checked first
      // 1. Company Specifics
      if (/^(company email|from email|sender email|business email|vendor email)$/.test(key)) {
        parsed.company.email = val;
        return 'company';
      }
      if (/^(company phone|from phone|sender phone|business phone|vendor phone|tel)$/.test(key)) {
        parsed.company.phone = val;
        return 'company';
      }
      if (/^(company address|from address|sender address|business address|vendor address)$/.test(key)) {
        parsed.company.address = val;
        return 'company';
      }
      if (/^(tax id|vat id|company vat|reg no|registration number|ein|tax number)$/.test(key)) {
        parsed.company.taxId = val;
        return 'company';
      }
      if (/^(company name|company|from|sender|business name|vendor|seller|my company)$/.test(key)) {
        parsed.company.name = val;
        return 'company';
      }

      // 2. Customer Specifics
      if (/^(customer email|client email|to email|buyer email|recipient email)$/.test(key)) {
        parsed.customer.email = val;
        return 'customer';
      }
      if (/^(customer phone|client phone|to phone|buyer phone|recipient phone|mobile)$/.test(key)) {
        parsed.customer.phone = val;
        return 'customer';
      }
      if (/^(customer address|client address|to address|billing address|buyer address|recipient address)$/.test(key)) {
        parsed.customer.address = val;
        return 'customer';
      }
      if (/^(customer name|customer|client name|client|bill to|to|buyer|recipient|billed to)$/.test(key)) {
        const emailMatch = val.match(/\b([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,})\b/);
        if (emailMatch) {
          parsed.customer.email = emailMatch[1];
          parsed.customer.name = val.replace(emailMatch[0], '').replace(/[()<>]/g, '').trim();
        } else {
          parsed.customer.name = val;
        }
        return 'customer';
      }

      // 3. Discount & Tax
      if (/^(discount|discount amount|discount rate)$/.test(key)) {
        parsed.discount = this.parseNumericOrPercent(val);
        return 'discount';
      }
      if (/^(tax|tax rate|vat|gst|sales tax)$/.test(key)) {
        parsed.taxRate = this.parseNumericOrPercent(val);
        return 'tax';
      }
      if (/^(shipping|shipping fee|handling)$/.test(key)) {
        parsed.shipping = parseFloat(val.replace(/[^0-9.]/g, '')) || 0;
        return 'meta';
      }

      // 4. Invoice metadata
      if (/^(invoice number|invoice #|invoice no|inv #|inv no|invoice id)$/.test(key)) {
        parsed.invoiceMeta.invoiceNumber = val;
        return 'meta';
      }
      if (/^(invoice date|date|issue date|created date|invoiced on)$/.test(key)) {
        parsed.invoiceMeta.invoiceDate = this.normalizeDate(val);
        return 'meta';
      }
      if (/^(due date|due on|payment due|expires on|pay by|due)$/.test(key)) {
        parsed.invoiceMeta.dueDate = this.normalizeDate(val);
        return 'meta';
      }
      if (/^(payment terms|terms|terms of payment)$/.test(key)) {
        parsed.paymentTerms = val;
        return 'meta';
      }
      if (/^(payment status|status)$/.test(key)) {
        parsed.paymentStatus = val;
        return 'meta';
      }
      if (/^(notes|note|comments|remarks)$/.test(key)) {
        parsed.notes = val;
        return 'notes';
      }
      if (/^(bank details|payment details|bank info|iban|wire instructions)$/.test(key)) {
        parsed.bankDetails = val;
        return 'bankDetails';
      }
    }
    return null;
  }

  /**
   * Determine if a text line represents a line item
   */
  static isItemLine(line) {
    if (/^(?:[•\-\*]|\d+\.)\s+/i.test(line)) return true;
    if (/\b(qty|rate|price|unit|x|@)\b/i.test(line) && /\d/.test(line)) return true;
    if (line.includes('|') && /\d/.test(line)) return true;
    return false;
  }

  /**
   * Parse a single item line into { description, quantity, price, tax }
   */
  static parseItemLine(line) {
    // Strip ONLY leading list bullets like "- ", "* ", "• ", or "1. " (NOT numbers like "3 x")
    let clean = line.replace(/^(?:[•\-\*]|\d+\.)\s*/, '').trim();
    if (!clean) return null;

    let desc = clean;
    let qty = 1;
    let price = 0;
    let tax = 0;

    // Pattern 1: Pipe separated: "Web Design | Qty: 2 | Rate: 500 | Tax: 10%"
    if (clean.includes('|')) {
      const parts = clean.split('|').map(p => p.trim());
      desc = parts[0];
      for (let i = 1; i < parts.length; i++) {
        const part = parts[i];
        if (/^(qty|quantity|units?|hrs?|hours?)\b[:\s]*/i.test(part)) {
          qty = parseFloat(part.replace(/^(qty|quantity|units?|hrs?|hours?)[:\s]*/i, '').trim()) || 1;
        } else if (/^(rate|price|unit price|cost|amount)\b[:\s]*/i.test(part)) {
          price = parseFloat(part.replace(/[^0-9.]/g, '')) || 0;
        } else if (/^(tax|vat|gst)\b[:\s]*/i.test(part)) {
          tax = parseFloat(part.replace(/[^0-9.]/g, '')) || 0;
        } else if (/^\$?[0-9,.]+$/.test(part.trim())) {
          price = parseFloat(part.replace(/[^0-9.]/g, '')) || 0;
        }
      }
      return { description: desc, quantity: qty, price: price, tax: tax };
    }

    // Pattern 2: "3 x Brand Identity Design @ $400" or "2x Web Design at $500"
    const patternQtyFirst = /^(\d+(?:\.\d+)?)\s*(?:x|units?|hrs?|hours?|items?)\s+(?:of\s+)?(.+?)\s+(?:@|at|\$|for)\s+\$?([0-9,]+(?:\.\d+)?)/i;
    const match1 = clean.match(patternQtyFirst);
    if (match1) {
      qty = parseFloat(match1[1]) || 1;
      desc = match1[2].trim();
      price = parseFloat(match1[3].replace(/,/g, '')) || 0;
      return { description: desc, quantity: qty, price: price, tax: 0 };
    }

    // Pattern 3: "Web Design - 2 x $500" or "Web Design: 2 at $500"
    const patternDescFirst = /^(.+?)[:\-\–]\s*(\d+(?:\.\d+)?)\s*(?:x|units?|@|at)\s+\$?([0-9,]+(?:\.\d+)?)/i;
    const match2 = clean.match(patternDescFirst);
    if (match2) {
      desc = match2[1].trim();
      qty = parseFloat(match2[2]) || 1;
      price = parseFloat(match2[3].replace(/,/g, '')) || 0;
      return { description: desc, quantity: qty, price: price, tax: 0 };
    }

    // Pattern 4: "Web Design ($500)" or "Web Design: $500"
    const patternSimple = /^(.+?)[\:\-\–\(\$]\s*\$?([0-9,]+(?:\.\d+)?)\)?$/i;
    const match3 = clean.match(patternSimple);
    if (match3) {
      desc = match3[1].trim();
      price = parseFloat(match3[2].replace(/,/g, '')) || 0;
      return { description: desc, quantity: 1, price: price, tax: 0 };
    }

    return null;
  }

  /**
   * Scan full text with regex fallbacks
   */
  static applyGlobalFallbacks(rawText, parsed) {
    if (!parsed.invoiceMeta.invoiceNumber) {
      const invMatch = rawText.match(/\b(INV-[0-9A-Za-z_-]+|#\s*[0-9A-Za-z_-]{3,}|Invoice\s*#?\s*([0-9A-Za-z_-]+))\b/i);
      if (invMatch) {
        parsed.invoiceMeta.invoiceNumber = invMatch[2] || invMatch[1].replace(/^#\s*/, '');
      }
    }

    const allEmails = rawText.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g) || [];
    if (allEmails.length > 0) {
      if (!parsed.customer.email && allEmails.length > 0) {
        parsed.customer.email = allEmails[allEmails.length - 1];
      }
      if (!parsed.company.email && allEmails.length > 1) {
        parsed.company.email = allEmails[0];
      }
    }

    const allPhones = rawText.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g) || [];
    if (allPhones.length > 0) {
      if (!parsed.company.phone && allPhones.length > 0) parsed.company.phone = allPhones[0];
      if (!parsed.customer.phone && allPhones.length > 1) parsed.customer.phone = allPhones[1];
    }

    const dateRegex = /\b(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})\b/gi;
    const dates = rawText.match(dateRegex) || [];
    if (dates.length > 0) {
      if (!parsed.invoiceMeta.invoiceDate) parsed.invoiceMeta.invoiceDate = this.normalizeDate(dates[0]);
      if (!parsed.invoiceMeta.dueDate && dates.length > 1) parsed.invoiceMeta.dueDate = this.normalizeDate(dates[1]);
    }
  }

  static normalizeDate(dateStr) {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        return d.toISOString().split('T')[0];
      }
    } catch (e) {
      // fallback
    }
    return dateStr;
  }

  static parseNumericOrPercent(val) {
    if (!val) return null;
    const isPercent = String(val).includes('%');
    const num = parseFloat(String(val).replace(/[^0-9.]/g, '')) || 0;
    return {
      value: num,
      isPercentage: isPercent
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { RawInvoiceParser };
}
