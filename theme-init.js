// Runs in <head> so the saved theme applies before first paint.
try {
  const theme = JSON.parse(localStorage.getItem('softtab.theme'));
  if (theme === 'light' || theme === 'dark') document.documentElement.setAttribute('data-theme', theme);
} catch {}
