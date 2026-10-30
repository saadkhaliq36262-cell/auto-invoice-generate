/**
 * Background Scheduler for AutoInvoice Pro
 * Automatically processes scheduled invoice email dispatches and checks for overdue invoices.
 */
const { db } = require('./db');
const nodemailer = require('nodemailer');

let schedulerInterval = null;

function startScheduler(intervalMs = 30000) {
  console.log('⏰ AutoInvoice Pro Background Scheduler started (interval: 30s)...');

  // Run initial check
  processScheduledEmails();
  checkOverdueInvoices();

  schedulerInterval = setInterval(() => {
    processScheduledEmails();
    checkOverdueInvoices();
  }, intervalMs);
}

function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('Scheduler stopped.');
  }
}

/**
 * Find due scheduled emails and dispatch them
 */
async function processScheduledEmails() {
  try {
    const dueMessages = db.prepare(`
      SELECT * FROM email_messages 
      WHERE status = 'scheduled' AND scheduled_for <= datetime('now')
    `).all();

    if (dueMessages.length === 0) return;

    console.log(`Processing ${dueMessages.length} scheduled email message(s)...`);

    for (const msg of dueMessages) {
      try {
        const emailAccount = db.prepare('SELECT * FROM email_accounts WHERE company_id = ?').get(msg.company_id);
        
        let transporter;
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
          transporter = nodemailer.createTransport({
            streamTransport: true,
            newline: 'windows'
          });
        }

        await transporter.sendMail({
          from: msg.from_email,
          to: msg.to_email,
          cc: msg.cc || undefined,
          subject: msg.subject,
          text: msg.body,
          html: msg.body.replace(/\n/g, '<br/>')
        });

        db.prepare(`
          UPDATE email_messages 
          SET status = 'sent', sent_at = datetime('now'), updated_at = datetime('now')
          WHERE id = ?
        `).run(msg.id);

        if (msg.invoice_id) {
          db.prepare(`UPDATE invoices SET status = 'sent', updated_at = datetime('now') WHERE id = ?`).run(msg.invoice_id);
        }

        console.log(`✅ Dispatched scheduled email ${msg.id} to ${msg.to_email}`);
      } catch (sendErr) {
        console.error(`Failed to send scheduled message ${msg.id}:`, sendErr.message);
        db.prepare(`
          UPDATE email_messages 
          SET status = 'failed', error_message = ?
          WHERE id = ?
        `).run(sendErr.message, msg.id);
      }
    }
  } catch (err) {
    console.error('Error in processScheduledEmails:', err);
  }
}

/**
 * Automatically transition invoices to 'overdue' if due_date has passed
 */
function checkOverdueInvoices() {
  try {
    const res = db.prepare(`
      UPDATE invoices 
      SET status = 'overdue', updated_at = datetime('now')
      WHERE due_date < date('now') 
        AND status IN ('sent', 'partially_paid')
    `).run();

    if (res.changes > 0) {
      console.log(`Updated ${res.changes} invoice(s) to overdue status.`);
    }
  } catch (err) {
    console.error('Error checking overdue invoices:', err);
  }
}

module.exports = {
  startScheduler,
  stopScheduler,
  processScheduledEmails,
  checkOverdueInvoices
};
