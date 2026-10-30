/**
 * In-App AI Assistant Drawer Component for AutoInvoice Pro
 */
const Assistant = {
  isOpen: false,
  messages: [
    {
      sender: 'assistant',
      text: 'Hello! I am your **AutoInvoice Pro AI Assistant**. I can look up overdue invoices, create invoices, check outstanding revenue, or assist with client management. How can I help you today?'
    }
  ],

  render() {
    let el = document.getElementById('aiAssistantContainer');
    if (!el) {
      el = document.createElement('div');
      el.id = 'aiAssistantContainer';
      document.body.appendChild(el);
    }

    el.innerHTML = `
      <!-- Floating Trigger Button -->
      <button class="ai-trigger-btn" id="btnToggleAssistant" title="Open AI Assistant">
        <span class="ai-icon">✨</span>
        <span class="ai-label">AI Assistant</span>
      </button>

      <!-- Chat Drawer -->
      <div class="ai-drawer ${this.isOpen ? 'open' : ''}" id="aiDrawer">
        <div class="ai-header">
          <div class="ai-header-left">
            <span class="ai-sparkle">✨</span>
            <div>
              <div class="ai-title">AutoInvoice AI Assistant</div>
              <div class="ai-subtitle">Natural language SaaS actions & analytics</div>
            </div>
          </div>
          <button class="ai-close-btn" id="btnCloseAssistant">&times;</button>
        </div>

        <div class="ai-messages-body" id="aiMessagesBody">
          ${this.messages.map(m => this.renderMessage(m)).join('')}
        </div>

        <div class="ai-quick-prompts">
          <button class="ai-chip" data-prompt="What are my overdue invoices?">Overdue Invoices</button>
          <button class="ai-chip" data-prompt="Show outstanding balances">Outstanding Balances</button>
          <button class="ai-chip" data-prompt="List all companies">Companies</button>
          <button class="ai-chip" data-prompt="How to connect MCP?">Connect MCP</button>
        </div>

        <form class="ai-input-form" id="aiChatForm">
          <input type="text" id="aiInputText" class="ai-input" placeholder="Ask AI or execute invoicing command..." autocomplete="off" />
          <button type="submit" class="ai-send-btn">Send</button>
        </form>
      </div>
    `;

    this.bindEvents(el);
    this.scrollToBottom();
  },

  renderMessage(m) {
    const isUser = m.sender === 'user';
    const parsedText = (m.text || '')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br/>');

    let actionBtnHtml = '';
    if (m.action) {
      actionBtnHtml = `<div style="margin-top: 0.6rem;"><a href="${m.action.path}" class="btn btn-primary btn-sm" onclick="Assistant.handleActionClick('${m.action.path}')">${m.action.label || 'View'}</a></div>`;
    }

    return `
      <div class="ai-msg ${isUser ? 'user-msg' : 'assistant-msg'}">
        <div class="ai-msg-avatar">${isUser ? '👤' : '✨'}</div>
        <div class="ai-msg-bubble">
          <div class="ai-msg-text">${parsedText}</div>
          ${actionBtnHtml}
        </div>
      </div>
    `;
  },

  handleActionClick(path) {
    this.isOpen = false;
    this.render();
    if (path.startsWith('#')) {
      window.location.hash = path;
    }
  },

  bindEvents(container) {
    const toggleBtn = container.querySelector('#btnToggleAssistant');
    const closeBtn = container.querySelector('#btnCloseAssistant');
    const form = container.querySelector('#aiChatForm');
    const input = container.querySelector('#aiInputText');

    toggleBtn.onclick = () => {
      this.isOpen = !this.isOpen;
      this.render();
    };

    closeBtn.onclick = () => {
      this.isOpen = false;
      this.render();
    };

    container.querySelectorAll('.ai-chip').forEach(chip => {
      chip.onclick = () => {
        const prompt = chip.getAttribute('data-prompt');
        this.submitMessage(prompt);
      };
    });

    form.onsubmit = (e) => {
      e.preventDefault();
      const val = input.value.trim();
      if (!val) return;
      this.submitMessage(val);
      input.value = '';
    };
  },

  async submitMessage(text) {
    this.messages.push({ sender: 'user', text });
    this.render();

    // Show typing state
    this.messages.push({ sender: 'assistant', text: 'Thinking...', isTyping: true });
    this.render();

    try {
      const res = await API.askAssistant(text, State.currentCompanyId);
      // Remove typing message
      this.messages.pop();
      if (res.success && res.data) {
        this.messages.push({
          sender: 'assistant',
          text: res.data.reply,
          action: res.data.action
        });
      } else {
        this.messages.push({ sender: 'assistant', text: 'Sorry, I encountered an issue processing that.' });
      }
    } catch (err) {
      this.messages.pop();
      this.messages.push({ sender: 'assistant', text: `Error: ${err.message}` });
    }

    this.render();
  },

  scrollToBottom() {
    const body = document.getElementById('aiMessagesBody');
    if (body) {
      body.scrollTop = body.scrollHeight;
    }
  }
};

window.Assistant = Assistant;
