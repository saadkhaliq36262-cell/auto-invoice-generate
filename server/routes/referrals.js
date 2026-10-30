/**
 * Referrals Route for AutoInvoice Pro
 * Manages referral codes, commissions, tracking, and rewards.
 */
const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { v4: uuidv4 } = require('uuid');

// GET /api/referrals/stats
router.get('/stats', (req, res) => {
  try {
    const list = db.prepare('SELECT * FROM referrals ORDER BY created_at DESC').all();

    let totalEarnings = 0;
    let pendingCount = 0;
    let activeCount = 0;
    let rewardedCount = 0;

    for (const r of list) {
      if (r.status === 'rewarded') {
        rewardedCount++;
        totalEarnings += r.reward_amount || 0;
      } else if (r.status === 'active') {
        activeCount++;
      } else {
        pendingCount++;
      }
    }

    res.json({
      success: true,
      data: {
        referral_code: list.length > 0 ? list[0].referral_code : 'SAAD-VIP',
        commission_rate: '15%',
        total_referrals: list.length,
        pending_count: pendingCount,
        active_count: activeCount,
        rewarded_count: rewardedCount,
        total_earnings: totalEarnings,
        referrals: list
      }
    });
  } catch (err) {
    console.error('Error fetching referrals:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/referrals
router.post('/', (req, res) => {
  try {
    const { referrer_name = 'Saad Khaliq', referral_code = 'SAAD-VIP', client_email, commission_rate = 15.0 } = req.body;
    if (!client_email) {
      return res.status(400).json({ success: false, error: 'client_email is required' });
    }

    const id = 'ref_' + uuidv4().slice(0, 10);
    db.prepare(`
      INSERT INTO referrals (id, referrer_name, referral_code, client_email, status, commission_rate, reward_amount)
      VALUES (?, ?, ?, ?, 'pending', ?, 0.0)
    `).run(id, referrer_name, referral_code, client_email, parseFloat(commission_rate));

    res.json({
      success: true,
      message: 'Referral registered successfully',
      data: { id, referral_code, client_email }
    });
  } catch (err) {
    console.error('Error creating referral:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
