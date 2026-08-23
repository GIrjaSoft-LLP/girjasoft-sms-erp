import { DESIGN_STORAGE_KEY } from "@/config/ui-theme";

export function ThemeInitScript() {
  const script = `
(function(){
  try {
    var raw = localStorage.getItem(${JSON.stringify(DESIGN_STORAGE_KEY)});
    if (!raw) return;
    var p = JSON.parse(raw);
    var root = document.documentElement;
    if (p.theme) root.setAttribute('data-theme', p.theme);
    var mode = p.mode || 'system';
    var dark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    root.setAttribute('data-mode', dark ? 'dark' : 'light');
    if (p.accentColor) {
      root.style.setProperty('--accent', p.accentColor);
      root.style.setProperty('--primary', p.accentColor);
    }
  } catch (e) {}
})();
`;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
