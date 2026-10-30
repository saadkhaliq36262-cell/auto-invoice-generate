/**
 * Hash-based Single Page Application (SPA) Router for AutoInvoice Pro
 */
const Router = {
  routes: {},

  init() {
    window.addEventListener('hashchange', () => this.handleRoute());
    window.addEventListener('companyChanged', () => this.handleRoute());
    this.handleRoute();
  },

  handleRoute() {
    const rawHash = window.location.hash.slice(1) || 'dashboard';
    const [pathPart, queryPart] = rawHash.split('?');
    const path = pathPart.replace(/^\/+|\/+$/g, '') || 'dashboard';
    const container = document.getElementById('appView');

    if (!container) return;

    // Update active nav link
    const rootNav = path.split('/')[0];
    document.querySelectorAll('.sidebar-nav-item').forEach(link => {
      const linkTarget = (link.getAttribute('href') || '').replace('#', '').split('/')[0];
      link.classList.toggle('active', linkTarget === rootNav);
    });

    // 1. Dashboard
    if (path === 'dashboard' || path === '') {
      DashboardView.render(container);
    }
    // 2. Invoices
    else if (path === 'invoices') {
      InvoicesView.renderList(container);
    }
    else if (path === 'invoices/new') {
      InvoiceFormView.render(container);
    }
    else if (path.startsWith('invoices/') && path.endsWith('/edit')) {
      const id = path.split('/')[1];
      InvoiceFormView.render(container, id);
    }
    else if (path.startsWith('invoices/') && path.endsWith('/email')) {
      const id = path.split('/')[1];
      EmailComposerView.render(container, id);
    }
    else if (path.startsWith('invoices/')) {
      const id = path.split('/')[1];
      InvoicesView.renderDetails(container, id);
    }
    // 3. Clients
    else if (path === 'clients') {
      ClientsView.render(container);
    }
    // 4. Templates
    else if (path === 'templates') {
      TemplatesView.render(container);
    }
    else if (path === 'templates/designer') {
      DesignerView.render(container);
    }
    else if (path.startsWith('templates/designer/')) {
      const id = path.split('/')[2];
      DesignerView.render(container, id);
    }
    else if (path === 'templates/pdf-upload') {
      PdfUploadView.render(container);
    }
    // 5. Mail
    else if (path === 'mail') {
      MailView.render(container);
    }
    // 6. Referrals
    else if (path === 'referrals') {
      ReferralsView.render(container);
    }
    // 7. Settings
    else if (path === 'settings') {
      const params = new URLSearchParams(queryPart || '');
      const tab = params.get('tab') || 'mcp';
      SettingsView.render(container, tab);
    }
    // Fallback
    else {
      DashboardView.render(container);
    }
  }
};

window.Router = Router;
