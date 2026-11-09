// What's Poppin: themes. The app owns the catalogue (src/lib/themes.ts); this is the game's copy, and
// a unit test fails if the ids, grounds, inks, accents or outfits drift. The app opens the game as
// index.html?theme=<id>. An unknown id falls back to Notebook.
(function () {
  const WP_THEMES = [
    { id: 'notebook',    name: 'Notebook',    ground: '#ffffff', ink: '#0a0a0a', accent: '#ff3b1f', wear: ['hero'], bubbles: ['#ff3b1f','#00b8ff','#12c15a','#ffd400','#8a3dff','#ff4fa3'] },
    { id: 'blackout',    name: 'Blackout',    ground: '#000000', ink: '#ffffff', accent: '#c6ff00', wear: ['hero', 'glasses'], bubbles: ['#ff3b1f','#00d4ff','#3dff7a','#ffe500','#a56bff','#ff4fa3'] },
    { id: 'redline',     name: 'Redline',     ground: '#ff2a1a', ink: '#0a0a0a', accent: '#ffffff', wear: ['hero', 'steam'], bubbles: ['#ffffff','#0a0a0a','#ffe100','#00d0ff','#00e060','#7a2cff'] },
    { id: 'greenroom',   name: 'Greenroom',   ground: '#00b84a', ink: '#0a0a0a', accent: '#fff200', wear: ['hero', 'hair'], bubbles: ['#ffffff','#0a0a0a','#ff2e93','#fff200','#00a2ff','#ff7a00'] },
    { id: 'ultraviolet', name: 'Ultraviolet', ground: '#5b21ff', ink: '#ffffff', accent: '#ffe500', wear: ['hero', 'sparkle'], bubbles: ['#ffe500','#ff4fa3','#00e5ff','#3dff7a','#ff8a00','#ffffff'] },
    { id: 'bubblegum',   name: 'Bubblegum',   ground: '#ff2e93', ink: '#0a0a0a', accent: '#fff200', wear: ['hero', 'bun'], bubbles: ['#00e5ff','#fff200','#6a2cff','#00d060','#ffffff','#ff8a00'] },
  ];
  let wanted = 'notebook';
  try { wanted = new URLSearchParams(location.search).get('theme') || 'notebook'; } catch (_) { /* node (tests) or no URL */ }
  const found = WP_THEMES.find((t) => t.id === wanted) || WP_THEMES[0];
  if (typeof window !== 'undefined') { window.WP_THEMES = WP_THEMES; window.WP_THEME = found; }
  if (typeof module !== 'undefined') module.exports = { WP_THEMES };
})();
