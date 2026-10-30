/**
 * Referrals View for AutoInvoice Pro
 * Referral code sharing, stats, commission tracker, and referral invitations.
 */
const ReferralsView = {
  async render(container) {
    container.innerHTML = `
      <div class="view-header">
        <div>
          <div class="view-title">Partner Referral Program</div>
          <div class="view-subtitle">Earn 15% recurring commission by referring businesses, agencies, and freelancers</div>
        </div>
      </div>

      <!-- Referral Code Banner Card -->
      <div class="card referral-banner-card">
        <div class="flex-between">
          <div>
            <div class="card-title">Your Exclusive Referral Code</div>
            <div class="text-sm text-muted mt-1">Share this code or link with clients to track rewards directly to your account.</div>
          </div>
          <span class="badge badge-accent">15% Lifetime Commission</span>
        </div>

        <div class="referral-share-box mt-3">
          <div class="referral-code-pill" id="refCodeText">SAAD-VIP</div>
          <button class="btn btn-primary" id="btnCopyRefLink">📋 Copy Share Link</button>
        </div>
      </div>

      <!-- Referral Metrics -->
      <div class="kpi-grid mt-4" id="refKpis">
        <div class="kpi-card">
          <div class="kpi-label">Total Referrals</div>
          <div class="kpi-value" id="kpiTotalRefs">0</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Active Clients</div>
          <div class="kpi-value" id="kpiActiveRefs">0</div>
        </div>
        <div class="kpi-card kpi-success">
          <div class="kpi-label">Rewarded Settlements</div>
          <div class="kpi-value" id="kpiRewardedRefs">0</div>
        </div>
        <div class="kpi-card kpi-success">
          <div class="kpi-label">Total Earnings</div>
          <div class="kpi-value" id="kpiEarningsVal">$0.00</div>
        </div>
      </div>

      <!-- Refer Client Form & Tracking Table Grid -->
      <div class="form-grid-2 mt-4" style="grid-template-columns: 350px 1fr;">
        
        <!-- Invite Form -->
        <div class="card">
          <div class="card-header"><span class="card-header-title">Register a Referral</span></div>
          <div class="card-body">
            <form id="addReferralForm">
              <div class="form-group">
                <label>Referrer Name</label>
                <input type="text" name="referrer_name" class="form-input" value="Saad Khaliq" required />
              </div>
              <div class="form-group">
                <label>Referral Code</label>
                <input type="text" name="referral_code" class="form-input" value="SAAD-VIP" required />
              </div>
              <div class="form-group">
                <label>Client / Business Email *</label>
                <input type="email" name="client_email" class="form-input" placeholder="partner@example.com" required />
              </div>
              <button type="submit" class="btn btn-primary btn-block mt-3">Register Referral</button>
            </form>
          </div>
        </div>

        <!-- Referrals Tracking Table -->
        <div class="card">
          <div class="card-header"><span class="card-header-title">Referral Ledger &amp; Payouts</span></div>
          <div class="card-body p-0">
            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Client Email</th>
                    <th>Referral Code</th>
                    <th>Status</th>
                    <th>Commission</th>
                    <th>Reward Earned</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody id="referralsTbody">
                  <tr><td colspan="6" class="text-center py-4">Loading referrals...</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    `;

    this.bindEvents(container);
    await this.loadStats();
  },

  bindEvents(container) {
    const copyBtn = container.querySelector('#btnCopyRefLink');
    if (copyBtn) {
      copyBtn.onclick = () => {
        const link = `${window.location.origin}/#ref=SAAD-VIP`;
        navigator.clipboard.writeText(link);
        State.notify('Referral link copied to clipboard!', 'success');
      };
    }

    const form = container.querySelector('#addReferralForm');
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(form).entries());
        try {
          await API.createReferral(data);
          State.notify('Referral registered successfully!', 'success');
          form.querySelector('input[name="client_email"]').value = '';
          this.loadStats();
        } catch (err) {
          State.notify(`Error: ${err.message}`, 'error');
        }
      };
    }
  },

  async loadStats() {
    try {
      const res = await API.getReferralStats();
      if (!res.success) return;
      const d = res.data;

      const codeEl = document.getElementById('refCodeText');
      if (codeEl) codeEl.innerText = d.referral_code;

      document.getElementById('kpiTotalRefs').innerText = d.total_referrals;
      document.getElementById('kpiActiveRefs').innerText = d.active_count;
      document.getElementById('kpiRewardedRefs').innerText = d.rewarded_count;
      document.getElementById('kpiEarningsVal').innerText = `$${(d.total_earnings || 0).toFixed(2)}`;

      const tbody = document.getElementById('referralsTbody');
      if (!tbody) return;

      const list = d.referrals || [];
      if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">No referrals registered yet.</td></tr>`;
        return;
      }

      tbody.innerHTML = list.map(r => `
        <tr>
          <td><strong>${r.client_email}</strong></td>
          <td><span class="badge badge-subtle">${r.referral_code}</span></td>
          <td><span class="status-pill status-${r.status}">${r.status}</span></td>
          <td>${r.commission_rate}%</td>
          <td><strong>$${(r.reward_amount || 0).toFixed(2)}</strong></td>
          <td class="text-xs text-muted">${State.formatDate(r.created_at)}</td>
        </tr>
      `).join('');
    } catch (err) {
      console.error('Error loading referrals:', err);
    }
  }
};

window.ReferralsView = ReferralsView;
