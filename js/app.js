/**
 * AutoInvoice Pro - Client-Side SaaS Application Entrypoint
 * Initializes State, Company Selector, Router, and In-App AI Assistant.
 */
document.addEventListener('DOMContentLoaded', async () => {
  console.log('⚡ Initializing AutoInvoice Pro Multi-Company SaaS Platform...');

  // Initialize State & load companies
  await State.init();

  // Render Sidebar Company Switcher
  CompanySelector.render();

  // Render In-App Floating AI Assistant
  Assistant.render();

  // Initialize SPA Router
  Router.init();

  // Listen for global shortcuts
  document.addEventListener('keydown', (e) => {
    // Quick New Invoice: Ctrl+N / Cmd+N
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      window.location.hash = '#invoices/new';
    }
  });

  console.log('✅ AutoInvoice Pro ready.');
});
