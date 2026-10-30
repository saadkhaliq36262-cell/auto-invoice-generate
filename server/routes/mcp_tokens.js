/**
 * MCP Tokens & Configuration Routes for AutoInvoice Pro
 * Enables generating, managing, and validating tokens for Model Context Protocol integration.
 */
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { db } = require('../db');
const { v4: uuidv4 } = require('uuid');

// GET /api/mcp-tokens
router.get('/', (req, res) => {
  try {
    const tokens = db.prepare('SELECT id, name, token, permissions, last_used_at, is_active, created_at FROM mcp_tokens ORDER BY created_at DESC').all();
    res.json({ success: true, data: tokens });
  } catch (err) {
    console.error('Error fetching MCP tokens:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/mcp-tokens
router.post('/', (req, res) => {
  try {
    const { name = 'External Agent Token', permissions = 'full' } = req.body;
    const rawToken = 'mcp_live_' + crypto.randomBytes(16).toString('hex');
    const id = 'tok_' + uuidv4().slice(0, 10);

    db.prepare(`
      INSERT INTO mcp_tokens (id, name, token, permissions, is_active)
      VALUES (?, ?, ?, ?, 1)
    `).run(id, name, rawToken, permissions);

    res.json({
      success: true,
      message: 'MCP Token generated successfully',
      data: {
        id,
        name,
        token: rawToken,
        permissions
      }
    });
  } catch (err) {
    console.error('Error generating MCP token:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/mcp-tokens/:id
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM mcp_tokens WHERE id = ?').run(id);
    res.json({ success: true, message: 'MCP Token revoked successfully' });
  } catch (err) {
    console.error('Error deleting MCP token:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/mcp-tokens/info
router.get('/info', (req, res) => {
  const host = req.get('host') || 'localhost:3000';
  const protocol = req.protocol || 'http';
  res.json({
    success: true,
    data: {
      endpoint_url: `${protocol}://${host}/mcp`,
      server_name: 'autoinvoice-pro-mcp',
      protocol_version: '2024-11-05',
      available_tools_count: 30,
      documentation_url: '/#settings?tab=mcp'
    }
  });
});

module.exports = router;
