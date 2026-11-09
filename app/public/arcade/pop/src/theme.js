// What's Poppin: themes. The app owns the catalogue (src/lib/themes.ts); this is the game's copy, and
// a unit test fails if the ids, grounds, inks, accents or outfits drift. The app opens the game as
// index.html?theme=<id>. An unknown id falls back to Notebook.
(function () {
  const WP_THEMES = [
    { id: 'notebook',    name: 'Notebook',    ground: '#ffffff', ink: '#0a0a0a', accent: '#ff3b1f', wear: ['hero'] },
    { id: 'blackout',    name: 'Blackout',    ground: '#000000', ink: '#ffffff', accent: '#c6ff00', wear: ['hero', 'glasses'] },
    { id: 'redline',     name: 'Redline',     ground: '#ff2a1a', ink: '#0a0a0a', accent: '#ffffff', wear: ['hero', 'steam'] },
    { id: 'greenroom',   name: 'Greenroom',   ground: '#00b84a', ink: '#0a0a0a', accent: '#fff200', wear: ['hero', 'hair'] },
    { id: 'ultraviolet', name: 'Ultraviolet', ground: '#5b21ff', ink: '#ffffff', accent: '#ffe500', wear: ['hero', 'sparkle'] },
    { id: 'bubblegum',   name: 'Bubblegum',   ground: '#ff2e93', ink: '#0a0a0a', accent: '#fff200', wear: ['hero', 'bun'] },
  ];
  let wanted = 'notebook';
  try { wanted = new URLSearchParams(location.search).get('theme') || 'notebook'; } catch (_) { /* node (tests) or no URL */ }
  const found = WP_THEMES.find((t) => t.id === wanted) || WP_THEMES[0];
  if (typeof window !== 'undefined') { window.WP_THEMES = WP_THEMES; window.WP_THEME = found; }
  if (typeof module !== 'undefined') module.exports = { WP_THEMES };
})();
