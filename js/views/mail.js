/**
 * Mail & Communications View for AutoInvoice Pro
 * Mailbox with Inbox, Sent, Scheduled, Drafts, Failed tabs and IMAP synchronization.
 */
const MailView = {
  activeTab: 'sent', // 'sent', 'inbox', 'scheduled', 'failed'
  selectedMessage: null,

  async render(container) {
    const companyId = State.currentCompanyId;

    container.innerHTML = `
      <div class="view-header">
        <div>
          <div class="view-title">Mail &amp; Client Communications</div>
          <div class="view-subtitle">SMTP invoice dispatch history and synchronized IMAP incoming client replies</div>
        </div>
        <div class="view-actions">
          <button class="btn btn-secondary" id="btnSyncMailbox">🔄 Sync Inbox (IMAP)</button>
        </div>
      </div>

      <!-- Mailbox Split Layout -->
      <div class="mail-layout card">
        
        <!-- Left Sidebar: Folders / Tabs -->
        <div class="mail-sidebar">
          <div class="mail-folder-item ${this.activeTab === 'inbox' ? 'active' : ''}" data-tab="inbox">
            <span class="folder-icon">📥</span>
            <span>Inbox (Replies)</span>
          </div>
          <div class="mail-folder-item ${this.activeTab === 'sent' ? 'active' : ''}" data-tab="sent">
            <span class="folder-icon">📤</span>
            <span>Sent Messages</span>
          </div>
          <div class="mail-folder-item ${this.activeTab === 'scheduled' ? 'active' : ''}" data-tab="scheduled">
            <span class="folder-icon">⏰</span>
            <span>Scheduled Queue</span>
          </div>
          <div class="mail-folder-item ${this.activeTab === 'failed' ? 'active' : ''}" data-tab="failed">
            <span class="folder-icon">⚠️</span>
            <span>Failed Deliveries</span>
          </div>
          
          <div class="mt-4 p-3 bg-subtle rounded text-xs text-muted">
            Configure live IMAP credentials in <strong>Settings &gt; Mail</strong> to sync incoming replies automatically.
          </div>
        </div>

        <!-- Center: Message List -->
        <div class="mail-list-pane">
          <div class="mail-list-header flex-between">
            <span class="text-xs font-bold" id="mailFolderTitle">SENT MESSAGES</span>
            <span class="text-xs text-muted" id="mailMessageCount">0 messages</span>
          </div>
          <div class="mail-list-scroll" id="mailListScroll">
            <div class="p-4 text-center text-muted text-sm">Loading messages...</div>
          </div>
        </div>

        <!-- Right: Message Detail Reader -->
        <div class="mail-reader-pane" id="mailReaderPane">
          <div class="empty-state p-5">
            <span class="empty-state-icon">✉️</span>
            <h4>No Message Selected</h4>
            <p class="text-muted text-sm">Select an email from the list to view its complete content and metadata.</p>
          </div>
        </div>

      </div>
    `;

    this.bindEvents(container);
    await this.loadMessages();
  },

  bindEvents(container) {
    container.querySelectorAll('.mail-folder-item').forEach(item => {
      item.onclick = () => {
        container.querySelectorAll('.mail-folder-item').forEach(f => f.classList.remove('active'));
        item.classList.add('active');
        this.activeTab = item.getAttribute('data-tab');
        this.selectedMessage = null;
        this.loadMessages();
      };
    });

    const syncBtn = container.querySelector('#btnSyncMailbox');
    if (syncBtn) {
      syncBtn.onclick = async () => {
        syncBtn.disabled = true;
        syncBtn.innerText = 'Syncing IMAP...';
        try {
          const compToSync = State.currentCompanyId === 'all' ? (State.companies[0]?.id || '') : State.currentCompanyId;
          const res = await API.syncEmailReplies(compToSync);
          State.notify(res.message || 'Mailbox synchronized!', 'success');
          this.loadMessages();
        } catch (e) {
          State.notify(e.message, 'error');
        } finally {
          syncBtn.disabled = false;
          syncBtn.innerText = '🔄 Sync Inbox (IMAP)';
        }
      };
    }
  },

  async loadMessages() {
    const listScroll = document.getElementById('mailListScroll');
    const folderTitle = document.getElementById('mailFolderTitle');
    const countEl = document.getElementById('mailMessageCount');
    if (!listScroll) return;

    if (folderTitle) folderTitle.innerText = `${this.activeTab.toUpperCase()}`;

    const params = {};
    if (State.currentCompanyId !== 'all') params.company_id = State.currentCompanyId;

    if (this.activeTab === 'inbox') {
      params.direction = 'incoming';
    } else if (this.activeTab === 'sent') {
      params.direction = 'outgoing';
      params.status = 'sent';
    } else if (this.activeTab === 'scheduled') {
      params.status = 'scheduled';
    } else if (this.activeTab === 'failed') {
      params.status = 'failed';
    }

    try {
      const res = await API.getEmailMessages(params);
      const messages = res.data || [];

      if (countEl) countEl.innerText = `${messages.length} message(s)`;

      if (messages.length === 0) {
        listScroll.innerHTML = `<div class="p-4 text-center text-muted text-sm">No messages found in this folder.</div>`;
        return;
      }

      listScroll.innerHTML = messages.map(m => `
        <div class="mail-item ${this.selectedMessage?.id === m.id ? 'active' : ''}" data-id="${m.id}">
          <div class="flex-between">
            <strong class="mail-item-sender text-sm">${m.direction === 'outgoing' ? m.to_email : m.from_email}</strong>
            <span class="text-xs text-muted">${State.formatDate(m.sent_at || m.created_at)}</span>
          </div>
          <div class="mail-item-subject text-xs font-bold mt-1">${m.subject}</div>
          <div class="mail-item-snippet text-xs text-muted">${(m.body || '').slice(0, 70)}...</div>
          ${m.invoice_number ? `<span class="badge badge-subtle mt-1 text-xs"># ${m.invoice_number}</span>` : ''}
        </div>
      `).join('');

      listScroll.querySelectorAll('.mail-item').forEach(item => {
        item.onclick = () => {
          const id = item.getAttribute('data-id');
          this.selectedMessage = messages.find(m => m.id === id);
          listScroll.querySelectorAll('.mail-item').forEach(el => el.classList.remove('active'));
          item.classList.add('active');
          this.renderMessageDetail();
        };
      });

      // Select first message if none selected
      if (!this.selectedMessage && messages.length > 0) {
        this.selectedMessage = messages[0];
        listScroll.querySelector('.mail-item')?.classList.add('active');
        this.renderMessageDetail();
      }
    } catch (err) {
      console.error('Error loading mail messages:', err);
      listScroll.innerHTML = `<div class="p-3 text-danger text-sm">Failed to load messages: ${err.message}</div>`;
    }
  },

  renderMessageDetail() {
    const pane = document.getElementById('mailReaderPane');
    if (!pane || !this.selectedMessage) return;

    const m = this.selectedMessage;

    pane.innerHTML = `
      <div class="mail-reader-header">
        <div class="flex-between">
          <h2 class="mail-reader-subject">${m.subject}</h2>
          <span class="status-pill status-${m.status}">${m.status}</span>
        </div>
        <div class="mail-meta-row mt-2">
          <span><strong>From:</strong> ${m.from_email}</span>
          <span class="text-xs text-muted">${new Date(m.sent_at || m.created_at).toLocaleString()}</span>
        </div>
        <div class="mail-meta-row">
          <span><strong>To:</strong> ${m.to_email} ${m.cc ? `(CC: ${m.cc})` : ''}</span>
        </div>
        ${m.invoice_number ? `
          <div class="mt-2">
            <a href="#invoices/${m.invoice_id}" class="badge badge-accent">
              📄 Linked to Invoice ${m.invoice_number} &rarr;
            </a>
          </div>
        ` : ''}
      </div>

      <div class="mail-reader-body">
        ${(m.body || '').replace(/\n/g, '<br/>')}
      </div>

      ${m.error_message ? `
        <div class="alert alert-danger m-3">
          <strong>Delivery Error:</strong> ${m.error_message}
        </div>
      ` : ''}
    `;
  }
};

window.MailView = MailView;
