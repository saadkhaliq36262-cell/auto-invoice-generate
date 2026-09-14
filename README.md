# AutoInvoice Pro — Automated Invoice Generator & Email Drafter

AutoInvoice Pro is a complete, standalone, client-side web application for rapid invoice generation, real-time live preview, high-resolution A4 PDF downloads, and prepared email drafting.

---

## ✨ Features

- **⚡ Quick Raw Text Parser**: Paste unstructured text, emails, or notes to automatically extract company & customer details, line items, taxes, discounts, and payment terms.
- **🎨 Interactive Invoice Editor**: Manage line items dynamically, upload company logos, set currency, customize payment terms, and apply theme colors.
- **📄 Pixel-Perfect A4 Live Preview**: Instant visual preview formatted for standard corporate A4 dimensions.
- **📥 One-Click A4 PDF Download**: Generates high-resolution A4 PDF with the automatic naming format:
  `Invoice-[Invoice Number]-[Customer Name].pdf` (e.g. `Invoice-INV-0001-Ali-Khan.pdf`).
- **✉️ Email Draft Generator**: Pre-populates recipient, subject, and professional invoice body with 1-click launch into **Gmail Web**, **Default Mail Client (`mailto:`)**, or **Outlook Web**, along with quick clipboard copy buttons.
- **📂 Offline Invoice History**: Automatically saves invoices in `localStorage` for offline searching, reloading, and management.
- **🔒 100% Client-Side & Private**: Runs completely in the browser without any third-party APIs or backend server requirements.

---

## 🚀 Getting Started

Simply open `index.html` in any modern web browser.

```bash
# Clone the repository
git clone <your-repo-url>

# Open in browser
open index.html # on macOS
start index.html # on Windows
```

---

## 🧪 Testing

Run the automated test suite using Node.js:

```bash
node tests/run_tests.js
```

Or open `tests/test_suite.html` directly in your browser.

---

## 📁 Project Structure

```text
├── css/
│   └── style.css            # Responsive styles and A4 print media queries
├── js/
│   ├── app.js               # Main application coordinator
│   ├── email.js             # Email draft manager & mailto/web links
│   ├── invoice.js           # Invoice data model & financial engine
│   ├── parser.js            # Raw text NLP & regex extraction
│   ├── pdf.js               # A4 PDF generator (html2pdf integration)
│   └── storage.js           # LocalStorage invoice persistence
├── libs/
│   └── html2pdf.bundle.min.js
├── tests/
│   ├── run_tests.js         # Node.js CLI test suite
│   └── test_suite.html      # Browser test suite
├── index.html               # Main single-page application
└── README.md                # Documentation
```

---

## 📄 License

MIT License
