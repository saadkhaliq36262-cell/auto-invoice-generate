/**
 * Email Routes & Service for AutoInvoice Pro
 * Full SMTP sending with Nodemailer, PDF attachment, scheduled sending,
 * IMAP reply synchronization with imapflow & mailparser, and email account configuration.
 */
const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const { db } = require('../db');
const { v4: uuidv4 } = require('uuid');

// Predefined professional email templates matching Invco references
const EMAIL_TEMPLATES = [
  {
    id: 'formal',
    name: 'Formal / Standard Invoice',
    subject: 'Invoice {{invoice_number}} from {{company_name}}',
    body: `Dear {{client_name}},

Please find attached invoice {{invoice_number}} for {{total_amount}} regarding recent professional services rendered.

Invoice Summary:
• Invoice Number: {{invoice_number}}
• Issue Date: {{invoice_date}}
• Due Date: {{due_date}}
• Total Amount Due: {{total_amount}}

Payment can be completed via the bank account details outlined on the attached invoice. Please let us know if you have any questions or require any adjustments.

Thank you for your business.

Warm regards,
{{company_name}}
{{company_email}}`
  },
  {
    id: 'friendly',
    name: 'Friendly / Polite Notice',
    subject: 'New Invoice {{invoice_number}} – {{company_name}}',
    body: `Hi {{client_name}},

Hope you're having a wonderful week!

We've finalized invoice {{invoice_number}} for {{total_amount}} with a due date of {{due_date}}. You will find the complete itemized breakdown in the attached PDF.

If you have any questions at all, feel free to hit reply.

Thanks again for working with us!

Best,
{{company_name}}`
  },
  {
    id: 'reminder',
    name: 'Gentle Payment Reminder',
    subject: 'Gentle Reminder: Invoice {{invoice_number}} Due {{due_date}}',
    body: `Dear {{client_name}},

This is a friendly reminder that invoice {{invoice_number}} for {{total_amount}} is scheduled for payment on {{due_date}}.

For your convenience, we have re-attached the invoice PDF. If payment has already been initiated, please disregard this notice with our thanks.

Sincerely,
{{company_name}} Accounts Team`
  },
  {
    id: 'urgent',
    name: 'Urgent / Overdue Notice',
    subject: 'OVERDUE: Invoice {{invoice_number}} – Payment Required',
    body: `Attention: Accounts Payable / {{client_name}},

According to our records, invoice {{invoice_number}} in the amount of {{total_amount}} was due on {{due_date}} and remains outstanding.

Please review the attached invoice and arrange settlement today, or reply immediately with payment confirmation or remittance advice.

Thank you for your prompt attention to this matter.

Regards,
{{company_name}} Credit Control`
  }
];

// GET /api/email/templates
router.get('/templates', (req, res) => {
  res.json({ success: true, data: EMAIL_TEMPLATES });
});

// GET /api/email/accounts?company_id=...
router.get('/accounts', (req, res) => {
  try {
    const { company_id } = req.query;
    if (!company_id) {
      return res.status(400).json({ success: false, error: 'company_id required' });
    }

    const account = db.prepare('SELECT * FROM email_accounts WHERE company_id = ?').get(company_id);
    if (!account) {
      return res.json({ success: true, data: null });
    }

    // Mask password for security
    const sanitized = {
      ...account,
      has_password: Boolean(account.password),
      password: account.password ? '••••••••' : ''
    };

    res.json({ success: true, data: sanitized });
  } catch (err) {
    console.error('Error fetching email account:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/email/accounts
router.post('/accounts', (req, res) => {
  try {
    const {
      company_id,
      provider = 'smtp',
      host = '',
      port = 587,
      secure = false,
      username = '',
      password = '',
      from_email = '',
      from_name = '',
      imap_host = '',
      imap_port = 993,
      imap_secure = true
    } = req.body;

    if (!company_id) {
      return res.status(400).json({ success: false, error: 'company_id is required' });
    }

    const existing = db.prepare('SELECT * FROM email_accounts WHERE company_id = ?').get(company_id);

    // If existing and password wasn't provided, retain existing password
    let actualPassword = password;
    if (existing && (!password || password === '••••••••')) {
      actualPassword = existing.password;
    }

    const id = existing ? existing.id : 'acc_' + uuidv4().slice(0, 12);

    db.prepare(`
      INSERT INTO email_accounts (
        id, company_id, provider, host, port, secure, username, password, 
        from_email, from_name, imap_host, imap_port, imap_secure, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        provider = excluded.provider,
        host = excluded.host,
        port = excluded.port,
        secure = excluded.secure,
        username = excluded.username,
        password = excluded.password,
        from_email = excluded.from_email,
        from_name = excluded.from_name,
        imap_host = excluded.imap_host,
        imap_port = excluded.imap_port,
        imap_secure = excluded.imap_secure,
        updated_at = datetime('now')
    `).run(
      id, company_id, provider, host, parseInt(port, 10), secure ? 1 : 0,
      username, actualPassword, from_email, from_name,
      imap_host, parseInt(imap_port, 10), imap_secure ? 1 : 0
    );

    res.json({ success: true, message: 'Email configuration saved successfully' });
  } catch (err) {
    console.error('Error saving email account:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/email/messages?company_id=...&direction=...&status=...&invoice_id=...
router.get('/messages', (req, res) => {
  try {
    const { company_id, direction, status, invoice_id } = req.query;
    let query = `
      SELECT 
        m.*,
        c.name as company_name,
        i.invoice_number,
        i.total as invoice_total,
        i.currency as invoice_currency
      FROM email_messages m
      LEFT JOIN companies c ON m.company_id = c.id
      LEFT JOIN invoices i ON m.invoice_id = i.id
      WHERE 1=1
    `;
    const params = [];

    if (company_id && company_id !== 'all') {
      query += ` AND m.company_id = ?`;
      params.push(company_id);
    }
    if (direction) {
      query += ` AND m.direction = ?`;
      params.push(direction);
    }
    if (status) {
      query += ` AND m.status = ?`;
      params.push(status);
    }
    if (invoice_id) {
      query += ` AND m.invoice_id = ?`;
      params.push(invoice_id);
    }

    query += ` ORDER BY m.created_at DESC`;

    const messages = db.prepare(query).all(...params);
    res.json({ success: true, data: messages });
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/email/send
// Supports immediate send or scheduled send, replaces merge variables, attaches PDF
router.post('/send', async (req, res) => {
  try {
    const {
      company_id,
      invoice_id,
      to_email,
      cc,
      subject,
      body,
      scheduled_for, // ISO string or null
      pdf_base64,    // Optional base64 PDF attachment data
      pdf_filename
    } = req.body;

    if (!to_email || !subject || !body) {
      return res.status(400).json({ success: false, error: 'Recipient, subject, and body are required' });
    }

    // Lookup company
    let compId = company_id;
    let invoice = null;
    if (invoice_id) {
      invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoice_id);
      if (invoice && !compId) compId = invoice.company_id;
    }

    if (!compId) {
      const firstComp = db.prepare('SELECT id FROM companies LIMIT 1').get();
      compId = firstComp ? firstComp.id : 'comp_default';
    }

    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(compId);
    const emailAccount = db.prepare('SELECT * FROM email_accounts WHERE company_id = ?').get(compId);

    const fromAddress = (emailAccount && emailAccount.from_email)
      ? `"${emailAccount.from_name || company.name}" <${emailAccount.from_email}>`
      : `"${company ? company.name : 'AutoInvoice Pro'}" <billing@autoinvoice.pro>`;

    const msgId = 'msg_' + uuidv4().slice(0, 16);
    const isScheduled = Boolean(scheduled_for && new Date(scheduled_for) > new Date());

    if (isScheduled) {
      // Save as scheduled message
      db.prepare(`
        INSERT INTO email_messages (
          id, company_id, invoice_id, direction, from_email, to_email, cc, subject, body, status, scheduled_for
        ) VALUES (?, ?, ?, 'outgoing', ?, ?, ?, ?, ?, 'scheduled', ?)
      `).run(
        msgId, compId, invoice_id || null, fromAddress, to_email, cc || '', subject, body, scheduled_for
      );

      return res.json({
        success: true,
        message: `Email scheduled for delivery on ${new Date(scheduled_for).toLocaleString()}`,
        data: { id: msgId, status: 'scheduled', scheduled_for }
      });
    }

    // Send immediately via Nodemailer
    let transporter;
    let sentSuccess = false;
    let transportError = null;
    let deliveryMessageId = `mock-${uuidv4()}@autoinvoice.pro`;

    if (emailAccount && emailAccount.host && emailAccount.username && emailAccount.password) {
      transporter = nodemailer.createTransport({
        host: emailAccount.host,
        port: emailAccount.port,
        secure: Boolean(emailAccount.secure),
        auth: {
          user: emailAccount.username,
          pass: emailAccount.password
        }
      });
    } else {
      // Test / development mock transporter
      transporter = nodemailer.createTransport({
        streamTransport: true,
        newline: 'windows'
      });
    }

    // Prepare attachments
    const attachments = [];
    if (pdf_base64) {
      const cleanBase64 = pdf_base64.replace(/^data:application\/pdf;base64,/, '');
      attachments.push({
        filename: pdf_filename || `${invoice ? invoice.invoice_number : 'Invoice'}.pdf`,
        content: Buffer.from(cleanBase64, 'base64'),
        contentType: 'application/pdf'
      });
    }

    try {
      const mailOptions = {
        from: fromAddress,
        to: to_email,
        cc: cc || undefined,
        subject,
        text: body,
        html: body.replace(/\n/g, '<br/>'),
        attachments
      };

      const info = await transporter.sendMail(mailOptions);
      sentSuccess = true;
      if (info && info.messageId) {
        deliveryMessageId = info.messageId;
      }
    } catch (sendErr) {
      console.warn('Real SMTP failed (falling back to simulated delivery):', sendErr.message);
      transportError = sendErr.message;
      // If credentials were test or invalid, we record it and inform the user
      sentSuccess = false;
    }

    const status = sentSuccess ? 'sent' : (transportError ? 'failed' : 'sent');

    // Save record to database
    db.prepare(`
      INSERT INTO email_messages (
        id, company_id, invoice_id, direction, from_email, to_email, cc, subject, body, status, sent_at, message_id, error_message
      ) VALUES (?, ?, ?, 'outgoing', ?, ?, ?, ?, ?, ?, datetime('now'), ?, ?)
    `).run(
      msgId, compId, invoice_id || null, fromAddress, to_email, cc || '', subject, body, status, deliveryMessageId, transportError || ''
    );

    // Update invoice status to 'sent' if currently 'draft'
    if (invoice && invoice.status === 'draft') {
      db.prepare(`UPDATE invoices SET status = 'sent', updated_at = datetime('now') WHERE id = ?`).run(invoice.id);
    }

    res.json({
      success: true,
      data: {
        id: msgId,
        status,
        from: fromAddress,
        to: to_email,
        subject,
        messageId: deliveryMessageId,
        sent_at: new Date().toISOString(),
        error: transportError
      }
    });
  } catch (err) {
    console.error('Error sending email:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/email/sync-replies
// Uses imapflow and mailparser to check for incoming replies and matches to invoices
router.post('/sync-replies', async (req, res) => {
  try {
    const { company_id } = req.body;
    if (!company_id) {
      return res.status(400).json({ success: false, error: 'company_id is required' });
    }

    const emailAccount = db.prepare('SELECT * FROM email_accounts WHERE company_id = ?').get(company_id);
    if (!emailAccount || !emailAccount.imap_host || !emailAccount.username || !emailAccount.password) {
      return res.json({
        success: true,
        synced_count: 0,
        message: 'No IMAP credentials configured for this company. Configure IMAP in Settings > Mail to sync live inbox.'
      });
    }

    const client = new ImapFlow({
      host: emailAccount.imap_host,
      port: emailAccount.imap_port || 993,
      secure: Boolean(emailAccount.imap_secure),
      auth: {
        user: emailAccount.username,
        pass: emailAccount.password
      },
      logger: false
    });

    let newCount = 0;
    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');
      try {
        // Fetch recent messages
        const messages = client.fetch({ seq: '1:*' }, { envelope: true, source: true });
        for await (const msg of messages) {
          const parsed = await simpleParser(msg.source);
          const fromEmail = parsed.from ? parsed.from.text : '';
          const subject = parsed.subject || '';
          const textBody = parsed.text || '';
          const msgUid = msg.uid ? `imap_${msg.uid}` : 'msg_' + uuidv4().slice(0, 10);

          // Check if already stored
          const exists = db.prepare('SELECT id FROM email_messages WHERE message_id = ?').get(msgUid);
          if (!exists) {
            // Check if subject or body references an invoice number (e.g. SV-0001, NX-0101)
            let matchedInvoiceId = null;
            const invMatches = subject.match(/[A-Z]{2,4}-\d{3,6}/g);
            if (invMatches && invMatches.length > 0) {
              const matchedInv = db.prepare('SELECT id FROM invoices WHERE invoice_number = ? AND company_id = ?').get(invMatches[0], company_id);
              if (matchedInv) matchedInvoiceId = matchedInv.id;
            }

            db.prepare(`
              INSERT INTO email_messages (
                id, company_id, invoice_id, direction, from_email, to_email, subject, body, status, sent_at, message_id
              ) VALUES (?, ?, ?, 'incoming', ?, ?, ?, ?, 'sent', datetime('now'), ?)
            `).run(
              'msg_' + uuidv4().slice(0, 16),
              company_id,
              matchedInvoiceId,
              fromEmail,
              emailAccount.from_email || emailAccount.username,
              subject,
              textBody,
              msgUid
            );
            newCount++;
          }
        }
      } finally {
        lock.release();
      }
      await client.logout();
    } catch (imapErr) {
      console.warn('IMAP Sync note:', imapErr.message);
      return res.json({
        success: true,
        synced_count: 0,
        warning: `Could not connect to IMAP server (${imapErr.message}). Check mail server settings in Settings.`
      });
    }

    res.json({
      success: true,
      synced_count: newCount,
      message: `Successfully synchronized ${newCount} incoming message(s).`
    });
  } catch (err) {
    console.error('Error syncing replies:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
