/**
 * AutoInvoice Pro - Backend Server Entrypoint
 * Express 5 application with persistent SQLite, REST API, Streamable MCP Server, and Background Scheduler.
 */
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { db } = require('./db');
const { setupMcpServer } = require('./mcp/server');
const { startScheduler } = require('./scheduler');

// Route modules
const companiesRouter = require('./routes/companies');
const clientsRouter = require('./routes/clients');
const invoicesRouter = require('./routes/invoices');
const templatesRouter = require('./routes/templates');
const dashboardRouter = require('./routes/dashboard');
const paymentsRouter = require('./routes/payments');
const emailRouter = require('./routes/email');
const referralsRouter = require('./routes/referrals');
const mcpTokensRouter = require('./routes/mcp_tokens');
const assistantRouter = require('./routes/assistant');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Global Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve uploaded assets
app.use('/uploads', express.static(uploadsDir));

// Mount REST API Routers
app.use('/api/companies', companiesRouter);
app.use('/api/clients', clientsRouter);
app.use('/api/invoices', invoicesRouter);
app.use('/api/templates', templatesRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/email', emailRouter);
app.use('/api/referrals', referralsRouter);
app.use('/api/mcp-tokens', mcpTokensRouter);
app.use('/api/assistant', assistantRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'AutoInvoice Pro',
    version: '2.0.0',
    timestamp: new Date().toISOString()
  });
});

// Setup Model Context Protocol (MCP) Streamable Server at /mcp
setupMcpServer(app).catch(err => {
  console.error('Warning: MCP Server failed to initialize:', err);
});

// Serve frontend static assets
const clientDir = path.join(__dirname, '..');
app.use('/css', express.static(path.join(clientDir, 'css')));
app.use('/js', express.static(path.join(clientDir, 'js')));
app.use('/assets', express.static(path.join(clientDir, 'assets')));
app.use('/libs', express.static(path.join(clientDir, 'libs')));

// Single Page Application fallback to index.html
app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  if (req.path.startsWith('/api/') || req.path.startsWith('/mcp') || req.path.startsWith('/uploads/')) {
    return next();
  }
  res.sendFile(path.join(clientDir, 'index.html'));
});

// Start listening
const server = app.listen(PORT, () => {
  console.log(`🚀 AutoInvoice Pro running on http://localhost:${PORT}`);
  console.log(`📡 Model Context Protocol (MCP) streamable endpoint live at http://localhost:${PORT}/mcp`);
  
  // Start background cron scheduler for due invoices and overdue status
  startScheduler(30000);
});

module.exports = { app, server };
