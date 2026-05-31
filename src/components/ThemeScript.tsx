// No 'use client' — this is a Server Component.
// It injects a blocking inline script before hydration runs,
// preventing flash of wrong theme. Must be placed in <head> in layout.tsx.

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
