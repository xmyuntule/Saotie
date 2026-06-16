const { heroui } = require('@heroui/react');

// HeroUI Pro-style palettes — each becomes a light + dark HeroUI theme.
// The matching CSS-token skins live in tokens.css ([data-skin="…"]).
const SKINS = {
  default: '#2b54f0',
  violet: '#7c3aed',
  emerald: '#10b981',
  sunset: '#f97316',
  rose: '#f43f5e',
  cyan: '#06b6d4',
};

const themes = {};
for (const [name, primary] of Object.entries(SKINS)) {
  const p = { DEFAULT: primary, foreground: '#ffffff', 500: primary };
  themes[name] = { extend: 'light', colors: { primary: p, focus: primary } };
  themes[`${name}-dark`] = { extend: 'dark', colors: { primary: p, focus: primary } };
}

module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
    // @heroui/theme is hoisted under each package's nested node_modules, not top-level
    './node_modules/@heroui/theme/dist/**/*.{js,cjs,mjs}',
    './node_modules/@heroui/*/node_modules/@heroui/theme/dist/**/*.{js,cjs,mjs}',
  ],
  // The dark theme class names (`<skin>-dark`) are assembled at runtime via a
  // template literal in ThemeContext, so those literal strings never appear in
  // any scanned file — without this safelist Tailwind purges the HeroUI theme
  // selectors and dark-mode Cards fall back to the light (white) palette.
  safelist: Object.keys(themes),
  // keep our hand-rolled design system intact during the migration
  corePlugins: { preflight: false },
  darkMode: 'class',
  theme: { extend: {} },
  plugins: [heroui({ defaultTheme: 'default', themes })],
};
