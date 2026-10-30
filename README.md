# AutoInvoice Pro — Enterprise Multi-Company Invoicing SaaS Platform

AutoInvoice Pro is a complete, full-stack, multi-company invoicing SaaS platform inspired by modern enterprise fintech standards. It features independent company workspaces, a visual drag-and-drop canvas invoice designer, high-resolution A4 PDF downloads, real SMTP/IMAP email communications, persistent SQLite database storage, background automated scheduling, and an authenticated **Model Context Protocol (MCP)** server with 35 tools for AI agents.

---

## ✨ Core Platform Features

### 🏢 1. Multi-Company Management & Instant Switching
- Create unlimited independent business profiles.
- Strict data isolation: separate branding, logos, tax/VAT IDs, banking details (IBAN, SWIFT, Account #), currencies (£ GBP, $ USD, € EUR, PKR, etc.), and custom invoice prefixes (e.g., `SV-`, `NX-`, `VX-`).
- Instant company switcher in the sidebar with aggregated **"All Companies"** consolidated view.

### 🎨 2. Complete Invoice Template Management & Canvas Designer
- **Template Library**: Manage multiple custom invoice designs per company with default templates and usage statistics.
- **Visual Canvas Invoice Designer**: Drag-and-drop A4 canvas editor to design invoices without writing code.
  - Elements: Text, Dynamic Merge Fields (`{{invoice_number}}`, `{{due_date}}`, `{{client_name}}`, `{{grand_total}}`, etc.), Box, Line, Items Table, Totals, Bill To, From, Bank Remittance, Notes.
  - Properties Panel: Font family, size, weight, text alignment, background colors, borders, radius, dimensions, and positioning.
  - Layers Panel: Bring forward, send backward, lock, and delete.
  - Undo/Redo history stack and Canvas zoom (50% – 200%).
- **PDF Template Uploader**: Upload existing branded vector PDFs and map coordinate fields.

### 📄 3. Invoice Management & Automatic Financial Math
- Visual form builder + **⚡ Smart Text Parser** (paste raw unstructured order notes/emails to auto-fill invoices).
- Automatic sequential invoice numbering per company.
- Automated financial calculations: Line items, Subtotal, Discount (fixed or percentage), Tax, Shipping, and Total.
- Actions: Save draft, finalize & view, duplicate, mark as sent/paid, and delete.

### 💳 4. Payments Ledger & Balance Tracking
- Record partial or full payments with payment method, transaction reference, and notes.
- Real-time balance due recalculation and automated invoice status transitions (`draft` &rarr; `sent` &rarr; `partially_paid` &rarr; `paid` &rarr; `overdue`).

### ✉️ 5. Real Email Integration & Split-Screen Composer
- Split-screen composer: Left-side configuration + right-side real-time recipient preview with PDF attachment card.
- Dynamic variable interpolation (`{{client_name}}`, `{{invoice_number}}`, `{{total_amount}}`, etc.).
- Predefined professional email tones: Formal / Standard, Polite / Friendly, Gentle Reminder, Urgent / Overdue.
- SMTP integration: Gmail, Google Workspace, Hostinger, and Custom SMTP.
- Instant sending or scheduled delivery via background cron scheduler.

### 📥 6. Mailbox & Incoming IMAP Replies
- Dedicated Mail section with folders: Inbox, Sent, Scheduled, Drafts, Failed.
- Synchronize incoming client email replies via IMAP and auto-link them to invoice records.

### 📡 7. Model Context Protocol (MCP) Streamable Server
- Fully compliant MCP endpoint running at `/mcp` supporting HTTP streamable transport.
- **35 Registered Developer Tools** covering Companies, Clients, Invoices, Templates, Mail, and Dashboard KPIs.
- In-app token manager with one-click copyable configuration snippets for **Cursor**, **Claude Desktop**, and **Windsurf**.

### ✨ 8. In-App AI Assistant
- Floating chat assistant executing database queries and invoicing actions via natural language.

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18+ (tested on Node.js v22)

### Installation & Run

```bash
# Clone the repository
git clone https://github.com/saadkhaliq36262-cell/auto-invoice-generate.git
cd auto-invoice-generate

# Install dependencies
npm install

# Start the full-stack SaaS platform
npm start
```

Open your browser at:
```text
http://localhost:3000
```

MCP Streamable Server is active at:
```text
http://localhost:3000/mcp
```

---

## 🧪 Automated Test Suite

Run the comprehensive test suite covering all 10 core subsystems:

```bash
npm test
```

Test coverage:
1. System Health Check
2. Multi-Company Management & Currency Isolation
3. Clients Directory & Ledger Balances
4. Invoice Management & Automatic Financial Math
5. Template Company Isolation & Defaults
6. Payment Recording & Status Lifecycle
7. Dashboard KPIs & Aggregation
8. Email Dispatch & Scheduled Cron Queue
9. Model Context Protocol (MCP) 35 Tools
10. In-App AI Assistant NLP Execution

---

## 📁 Architecture Overview

```text
├── autoinvoice.db               # Persistent SQLite relational database
├── css/
│   └── style.css                # Enterprise fintech UI stylesheet
├── js/
│   ├── api.js                   # Central REST API client
│   ├── app.js                   # Application bootstrap
│   ├── router.js                # Hash-based SPA router
│   ├── state.js                 # Global state & multi-company reactive context
│   ├── components/
│   │   ├── assistant.js         # Floating AI Assistant widget
│   │   └── companySelector.js   # Sidebar company switcher dropdown
│   └── views/
│       ├── dashboard.js         # KPIs & recent activity feed
│       ├── invoices.js          # Invoices list & details (Screenshot 4)
│       ├── invoiceForm.js       # Visual form & smart raw text parser
│       ├── emailComposer.js     # Split-screen composer (Screenshot 3)
│       ├── templates.js         # Template library (Screenshot 2)
│       ├── designer.js          # Full visual canvas designer (Screenshot 1)
│       ├── pdfUpload.js         # PDF template upload & field mapper
│       ├── clients.js           # Clients directory & customer ledgers
│       ├── mail.js              # Mailbox & IMAP sync
│       ├── referrals.js         # Referrals code sharing & earnings
│       └── settings.js          # Companies, SMTP/IMAP & MCP Protocol Hub
├── libs/
│   └── html2pdf.bundle.min.js   # Client-side A4 PDF renderer
├── server/
│   ├── db.js                    # Database engine & multi-company seeds
│   ├── index.js                 # Express 5 entrypoint
│   ├── scheduler.js             # Background cron runner for scheduled emails
│   ├── mcp/
│   │   └── server.js            # 35-tool Model Context Protocol server
│   └── routes/                  # Modular REST API routes
├── tests/
│   └── platform_tests.js        # Automated test suite
├── index.html                   # Master single-page application shell
├── package.json
└── README.md
```

---

## 📄 License
ISC License — AutoInvoice Pro
