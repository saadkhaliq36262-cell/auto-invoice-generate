/**
 * Email Draft and Mail Client Integrations
 */
class EmailDraftManager {
  /**
   * Generates formatted email draft components from an InvoiceModel instance
   * @param {InvoiceModel} invoice 
   * @returns {Object} { recipient, subject, body, filename }
   */
  static generateDraft(invoice) {
    return invoice.generateEmailDraft();
  }

  /**
   * Opens the user's default desktop/mobile email client using mailto:
   * @param {Object} draft - { recipient, subject, body }
   */
  static openDefaultMailClient(draft) {
    const to = encodeURIComponent(draft.recipient || '');
    const subject = encodeURIComponent(draft.subject || '');
    const body = encodeURIComponent(draft.body || '');
    
    const mailtoUrl = `mailto:${to}?subject=${subject}&body=${body}`;
    window.location.href = mailtoUrl;
  }

  /**
   * Generates direct Gmail Web compose URL with pre-filled fields
   * @param {Object} draft - { recipient, subject, body }
   * @returns {string}
   */
  static getGmailComposeUrl(draft) {
    const to = encodeURIComponent(draft.recipient || '');
    const su = encodeURIComponent(draft.subject || '');
    const body = encodeURIComponent(draft.body || '');

    return `https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${su}&body=${body}`;
  }

  /**
   * Opens Gmail Web Compose in a new browser tab with prefilled fields
   * @param {Object} draft - { recipient, subject, body }
   */
  static openGmailCompose(draft) {
    const gmailUrl = this.getGmailComposeUrl(draft);

    // Open without 'noreferrer' so Google maintains active login session
    const win = window.open(gmailUrl, '_blank', 'noopener');
    if (!win || win.closed || typeof win.closed === 'undefined') {
      // Fallback navigation if popup blocker intercepted window.open
      window.location.href = gmailUrl;
    }
    return gmailUrl;
  }

  /**
   * Opens Outlook Web Compose in a new browser tab with prefilled fields
   * @param {Object} draft - { recipient, subject, body }
   */
  static openOutlookCompose(draft) {
    const to = encodeURIComponent(draft.recipient || '');
    const subject = encodeURIComponent(draft.subject || '');
    const body = encodeURIComponent(draft.body || '');

    const outlookUrl = `https://outlook.live.com/mail/0/deeplink/compose?to=${to}&subject=${subject}&body=${body}`;
    window.open(outlookUrl, '_blank', 'noopener,noreferrer');
  }

  /**
   * Copy text to user's system clipboard
   * @param {string} text 
   * @returns {Promise<boolean>}
   */
  static async copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      } else {
        // Fallback for non-https or older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        textArea.remove();
        return successful;
      }
    } catch (err) {
      console.error('Failed to copy text: ', err);
      return false;
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { EmailDraftManager };
}
