const currentPage = window.location.pathname.split('/').pop() || 'index.html';

for (const link of document.querySelectorAll('nav a')) {
  if (link.getAttribute('href') === currentPage) {
    link.setAttribute('aria-current', 'page');
  }
}

for (const year of document.querySelectorAll('[data-current-year]')) {
  year.textContent = String(new Date().getFullYear());
}

for (const button of document.querySelectorAll('[data-copy]')) {
  button.addEventListener('click', async () => {
    const value = button.getAttribute('data-copy');
    if (!value || !navigator.clipboard) return;

    try {
      await navigator.clipboard.writeText(value);
      button.setAttribute('aria-label', `Copied ${value}`);
    } catch {
      button.setAttribute('aria-label', `Copy ${value}`);
    }
  });
}
