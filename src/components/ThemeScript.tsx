// No 'use client' — this is a Server Component.
// It injects a blocking inline script before hydration runs,
// preventing flash of wrong theme. Must be placed in <head> in layout.tsx.

export function ThemeScript() {
  const script = `
    (function() {
      // Mark JS as available before first paint. CSS uses html:not(.js) to keep
      // JS-animated content (e.g. the framer-motion hero, which renders at
      // opacity:0 until its entrance animation runs) visible for no-JS clients
      // and crawlers. Once .js is set, framer-motion owns the animation.
      document.documentElement.classList.add('js');
      try {
        var stored = localStorage.getItem('cvcheck-theme');
        var theme = stored || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        document.documentElement.setAttribute('data-theme', theme);
      } catch(e) {}
    })();
  `
  return <script dangerouslySetInnerHTML={{ __html: script }} />
}
