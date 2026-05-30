'use client'

export function ThemeScript() {
  const script = `
    (function() {
      try {
        var stored = localStorage.getItem('cvcheck-theme');
        var theme = stored || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        document.documentElement.setAttribute('data-theme', theme);
      } catch(e) {}
    })();
  `
  return <script dangerouslySetInnerHTML={{ __html: script }} />
}
