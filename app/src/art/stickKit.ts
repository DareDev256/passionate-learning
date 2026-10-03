/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
// Ported verbatim from ai-se-for-idiots/src/stick.js (James's stickman kit). Returns SVG strings from internal data only.
// Stickman illustration kit. Every figure is drawn in local units with the
// feet at (0,0) and the head centre at (0,-92); scenes place and scale them.

const INK = 'var(--ink)';
const ACC = 'var(--accent)';
const PAPER = 'var(--paper)';

const HEAD = { x: 0, y: -92, r: 13 };
const SHOULDER = [0, -70];
const HIP = [0, -38];

export const LEGS = {
  stand: [[-6, -19, -13, 0], [6, -19, 13, 0]],
  wide: [[-10, -19, -22, 0], [10, -19, 22, 0]],
  run: [[-12, -22, -26, -12], [10, -20, 10, 0]],
  sit: [[16, -38, 17, 0], [20, -36, 23, 0]],
  kneel: [[-4, -20, -18, -18], [10, -20, 10, 0]],
  jump: [[-10, -26, -16, -10], [10, -26, 16, -10]],
};

// [elbowX, elbowY, handX, handY] for viewer-left and viewer-right arms.
export const ARMS = {
  stand: [[-10, -55, -14, -40], [10, -55, 14, -40]],
  point: [[-10, -55, -14, -40], [18, -72, 38, -78]],
  pointL: [[-18, -72, -38, -78], [10, -55, 14, -40]],
  pointUp: [[-10, -55, -14, -40], [14, -80, 16, -104]],
  shrug: [[-17, -62, -24, -76], [17, -62, 24, -76]],
  panic: [[-14, -84, -22, -102], [14, -84, 22, -102]],
  cheer: [[-18, -84, -30, -100], [18, -84, 30, -100]],
  think: [[-10, -55, -14, -40], [14, -60, 6, -80]],
  facepalm: [[-10, -55, -14, -40], [15, -68, 3, -92]],
  hold: [[-14, -86, -18, -106], [14, -86, 18, -106]],
  type: [[4, -56, 24, -54], [14, -58, 30, -56]],
  wave: [[-10, -55, -14, -40], [18, -78, 22, -100]],
  nope: [[-10, -55, -14, -40], [15, -72, 20, -92]],
  hips: [[-14, -56, -6, -40], [14, -56, 6, -40]],
  run: [[-12, -58, -4, -46], [12, -60, 24, -72]],
  present: [[-16, -60, -30, -58], [16, -60, 30, -58]],
  holdOut: [[-10, -55, -14, -40], [14, -58, 30, -56]],
  hug: [[-14, -60, 4, -54], [14, -60, -4, -54]],
};

const eye = (x, y) => `<circle cx="${x}" cy="${y}" r="1.7" fill="${INK}"/>`;
const xEye = (x, y) => `<path d="M${x - 2.4} ${y - 2.4}l4.8 4.8M${x + 2.4} ${y - 2.4}l-4.8 4.8" stroke="${INK}" stroke-width="1.6"/>`;

function face(kind = 'happy', look = 0, open = null, blink = false) {
  const ex = 4.6, ey = -94, lx = look * 3;
  let eyes = eye(-ex + lx, ey) + eye(ex + lx, ey);
  let mouth = '', extra = '';
  switch (kind) {
    case 'happy': mouth = `M${-5 + lx} -87.5Q${lx} -82.5 ${5 + lx} -87.5`; break;
    case 'grin':
      mouth = '';
      extra = `<path d="M${-6 + lx} -88.5Q${lx} -79 ${6 + lx} -88.5Z" fill="${INK}"/>`;
      break;
    case 'sad': mouth = `M${-5 + lx} -84.5Q${lx} -89 ${5 + lx} -84.5`; break;
    case 'flat': mouth = `M${-4 + lx} -86.5h8`; break;
    case 'shock':
      extra = `<ellipse cx="${lx}" cy="-85.5" rx="2.6" ry="3.4" fill="none" stroke="${INK}" stroke-width="1.6"/>`;
      break;
    case 'smug':
      mouth = `M${-3 + lx} -86.5Q${2 + lx} -84.5 ${6 + lx} -89`;
      extra = `<path d="M${-7 + lx} -99l5 1.5M${2 + lx} -97.5l5 -1.5" stroke="${INK}" stroke-width="1.4"/>`;
      break;
    case 'angry':
      mouth = `M${-5 + lx} -85Q${lx} -89 ${5 + lx} -85`;
      extra = `<path d="M${-7 + lx} -100l5 3M${7 + lx} -100l-5 3" stroke="${INK}" stroke-width="1.6"/>`;
      break;
    case 'dead':
      eyes = xEye(-ex, ey) + xEye(ex, ey);
      mouth = `M-4 -86.5q2 -2 4 0t4 0`;
      break;
    case 'cool':
      eyes = `<path d="M-10 -96.5h20v3.5q-1.5 4 -5.5 4t-4.5 -3.5q-0.5 3.5 -4.5 3.5t-5.5 -4z" fill="${INK}"/>`;
      mouth = `M-4 -86Q1 -83.5 5 -87`;
      break;
    case 'cry':
      mouth = `M-5 -84.5Q0 -89 5 -84.5`;
      extra = `<path d="M-5 -91v6M5 -91v6" stroke="${ACC}" stroke-width="1.6"/>`;
      break;
    case 'zen':
      eyes = `<path d="M-7 -94q2.5 2 5 0M2 -94q2.5 2 5 0" fill="none" stroke="${INK}" stroke-width="1.5"/>`;
      mouth = `M-4 -87.5Q0 -84.5 4 -87.5`;
      break;
    case 'spiral':
      eyes = `<path d="M-4.6 -94m-2.6 0a2.6 2.6 0 1 1 2.6 2.6a1.4 1.4 0 1 1 0 -1.6M4.6 -94m-2.6 0a2.6 2.6 0 1 1 2.6 2.6a1.4 1.4 0 1 1 0 -1.6" fill="none" stroke="${INK}" stroke-width="1.2"/>`;
      mouth = `M-4 -86q2 -2 4 0t4 0`;
      break;
  }
  // Animation overrides: a talking mouth sized by voice loudness, and a blink.
  if (open !== null) {
    if (kind === 'grin' || kind === 'shock') extra = '';
    if (kind === 'cry') extra = `<path d="M-5 -91v6M5 -91v6" stroke="${ACC}" stroke-width="1.6"/>`;
    mouth = '';
    extra += `<ellipse cx="${lx}" cy="-86.5" rx="${3.2 + open * 1.4}" ry="${0.7 + open * 3.4}" fill="${INK}"/>`;
  }
  if (blink && kind !== 'cool' && kind !== 'dead') eyes = `<path d="M${-ex - 2 + lx} ${ey}h4M${ex - 2 + lx} ${ey}h4" stroke="${INK}" stroke-width="1.6"/>`;
  return eyes + (mouth ? `<path d="${mouth}" fill="none" stroke="${INK}" stroke-width="1.7"/>` : '') + extra;
}

const ACCESSORIES = {
  // The protagonist: a vermilion headband with tails.
  hero: `<path d="M-13 -97.5Q0 -101 13 -97.5" stroke="${ACC}" stroke-width="4.2" fill="none"/>
         <path d="M-12.5 -97.5q-9 -2 -16 3.5M-12.5 -97q-8 3 -12 10" stroke="${ACC}" stroke-width="2.6" fill="none"/>`,
  tie: `<path d="M0 -76l-3 4 3 18 3 -18z" fill="${INK}"/>`,
  glasses: `<g fill="${PAPER}" stroke="${INK}" stroke-width="1.4"><circle cx="-5" cy="-94" r="3.6"/><circle cx="5" cy="-94" r="3.6"/></g><path d="M-1.4 -94h2.8" stroke="${INK}" stroke-width="1.4"/>`,
  hair: `<path d="M-12 -98l3 -9 3 5 3 -8 3 7 4 -7 2 8 4 -3 -2 8" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>`,
  bun: `<circle cx="0" cy="-108" r="5.5" fill="${INK}"/>`,
  cap: `<path d="M-13 -98q13 -14 26 0z" fill="${INK}"/><path d="M8 -98h14" stroke="${INK}" stroke-width="3"/>`,
  sweat: `<path d="M16 -104q-4 6 0 8q4 -2 0 -8z" fill="${PAPER}" stroke="${INK}" stroke-width="1.3"/><path d="M20 -94q-3 4 0 6q3 -2 0 -6z" fill="${PAPER}" stroke="${INK}" stroke-width="1.1"/>`,
  sparkle: `<path d="M20 -108l2 -6 2 6 6 2 -6 2 -2 6 -2 -6 -6 -2z" fill="${ACC}"/>`,
  question: `<text x="16" y="-104" font-family="Archivo Black, sans-serif" font-size="20" fill="${ACC}">?</text>`,
  bang: `<text x="15" y="-104" font-family="Archivo Black, sans-serif" font-size="20" fill="${ACC}">!</text>`,
  zzz: `<text x="14" y="-104" font-family="Archivo Black, sans-serif" font-size="11" fill="${INK}">z<tspan dy="-6" font-size="14">Z</tspan></text>`,
  steam: `<path d="M-10 -112q-3 -5 0 -9t0 -9M0 -114q-3 -5 0 -9t0 -9M10 -112q-3 -5 0 -9t0 -9" fill="none" stroke="${ACC}" stroke-width="1.8"/>`,
};

function robotHead(f, open = null) {
  const mouth = {
    happy: `<path d="M-5 -86q5 4 10 0" fill="none" stroke="${INK}" stroke-width="1.7"/>`,
    sad: `<path d="M-5 -84q5 -4 10 0" fill="none" stroke="${INK}" stroke-width="1.7"/>`,
    smug: `<path d="M-4 -86q6 2 9 -3" fill="none" stroke="${INK}" stroke-width="1.7"/>`,
    shock: `<rect x="-2.5" y="-89" width="5" height="5" fill="none" stroke="${INK}" stroke-width="1.6"/>`,
  }[f] || `<path d="M-5 -86h10" stroke="${INK}" stroke-width="1.7"/>`;
  const talk = open !== null ? `<rect x="-6" y="${-87 - open * 3}" width="12" height="${1.6 + open * 6}" fill="${INK}"/>` : '';
  return `<rect x="-14" y="-106" width="28" height="26" rx="6" fill="${PAPER}" stroke="${INK}" stroke-width="3"/>
    <path d="M0 -106v-8" stroke="${INK}" stroke-width="2.4"/><circle cx="0" cy="-117" r="3.6" fill="${ACC}"/>
    <rect x="-8" y="-98" width="4.4" height="4.4" fill="${INK}"/><rect x="3.6" y="-98" width="4.4" height="4.4" fill="${INK}"/>${talk || mouth}`;
}

function line(ax, ay, bx, by, cx, cy) {
  return `<path d="M${ax} ${ay}L${bx} ${by}L${cx} ${cy}" fill="none"/>`;
}

// One figure as an SVG <g>, feet at the origin.
export function figure({ pose = 'stand', legs, face: f = 'happy', look = 0, wear = [], robot = false, flip = false, armsXY, legsXY, open = null, blink = false } = {}) {
  const arms = armsXY || ARMS[pose] || ARMS.stand;
  const legSet = legsXY || LEGS[legs || (pose === 'panic' || pose === 'cheer' ? 'wide' : pose === 'run' ? 'run' : 'stand')];
  const body = [
    line(...HIP, legSet[0][0], legSet[0][1], legSet[0][2], legSet[0][3]),
    line(...HIP, legSet[1][0], legSet[1][1], legSet[1][2], legSet[1][3]),
    `<path d="M0 -79L0 -38" fill="none"/>`,
    line(...SHOULDER, ...arms[0]),
    line(...SHOULDER, ...arms[1]),
  ].join('');
  const head = robot
    ? robotHead(f, open)
    : `<circle cx="${HEAD.x}" cy="${HEAD.y}" r="${HEAD.r}" fill="${PAPER}" stroke="${INK}" stroke-width="3"/>${face(f, look, open, blink)}`;
  const acc = wear.map((w) => ACCESSORIES[w] || '').join('');
  const behind = wear.includes('hero') ? '' : '';
  return `<g ${flip ? 'transform="scale(-1,1)"' : ''}><g stroke="${INK}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">${body}</g>${behind}${head}${acc}</g>`;
}

// Props, drawn with the same origin convention (sitting on the ground line).
export const PROPS = {
  laptop: (x = 0) => `<g transform="translate(${x},0)"><rect x="-22" y="-60" width="44" height="4" fill="${INK}"/><path d="M-18 -60l4 -26h32l-4 26z" fill="${PAPER}" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/><circle cx="1" cy="-73" r="3" fill="${ACC}"/></g>`,
  desk: (x = 0, w = 70) => `<g transform="translate(${x},0)" stroke="${INK}" stroke-width="3" stroke-linecap="round"><path d="M${-w / 2} -56h${w}M${-w / 2 + 6} -56v56M${w / 2 - 6} -56v56"/></g>`,
  chair: (x = 0) => `<g transform="translate(${x},0)" stroke="${INK}" stroke-width="2.6" stroke-linecap="round" fill="none"><path d="M-2 -60v24h26M22 -36v36M0 -36v36"/></g>`,
  coffee: (x = 0, y = -56) => `<g transform="translate(${x},${y})"><path d="M-6 -12h12l-2 12h-8z" fill="${PAPER}" stroke="${INK}" stroke-width="2"/><path d="M-2 -16q-2 -3 0 -6M3 -16q-2 -3 0 -6" stroke="${INK}" stroke-width="1.3" fill="none"/></g>`,
  fire: (x = 0, s = 1) => `<g transform="translate(${x},0) scale(${s})"><path d="M-14 0q-8 -18 4 -30q-2 10 6 12q-4 -16 8 -28q0 14 10 20q4 -8 2 -14q12 14 2 40z" fill="${ACC}"/><path d="M-6 0q-4 -10 3 -16q0 6 5 7q-1 -9 5 -14q2 12 5 14q-2 6 -4 9z" fill="#ffd34d"/></g>`,
  sign: (x, y, w, h) => `<rect x="${x - w / 2}" y="${y - h}" width="${w}" height="${h}" fill="${PAPER}" stroke="${INK}" stroke-width="2.6"/>`,
  box: (x, y, w, h, fill = PAPER) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${fill}" stroke="${INK}" stroke-width="2.6"/>`,
  butterfly: (x, y) => `<g transform="translate(${x},${y})" stroke="${INK}" stroke-width="2"><path d="M0 0q-16 -18 -18 -2q2 10 18 2q-10 14 -2 16q6 0 2 -16" fill="${ACC}"/><path d="M0 0q16 -18 18 -2q-2 10 -18 2q10 14 2 16q-6 0 -2 -16" fill="${ACC}"/><path d="M0 -8v16" /></g>`,
  cloud: (x, y, s = 1) => `<g transform="translate(${x},${y}) scale(${s})"><path d="M-30 10q-12 0 -10 -12q2 -10 14 -8q2 -14 18 -12q10 -10 22 0q14 -2 14 12q12 2 8 14q-2 6 -10 6z" fill="${PAPER}" stroke="${INK}" stroke-width="2.4"/></g>`,
  arrow: (x1, y1, x2, y2) => `<g stroke="${ACC}" stroke-width="3" fill="none" stroke-linecap="round"><path d="M${x1} ${y1}L${x2} ${y2}"/><path d="M${x2} ${y2}l-8 -3M${x2} ${y2}l-3 -8" transform="rotate(${(Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI - 45} ${x2} ${y2})"/></g>`,
  db: (x, y) => `<g transform="translate(${x},${y})" fill="${PAPER}" stroke="${INK}" stroke-width="2.4"><path d="M-14 -30v26q14 8 28 0v-26"/><ellipse cx="0" cy="-30" rx="14" ry="5"/><path d="M-14 -17q14 8 28 0" fill="none"/></g>`,
  doc: (x, y, lbl = '') => `<g transform="translate(${x},${y})"><path d="M-10 -30h14l6 6v24h-20z" fill="${PAPER}" stroke="${INK}" stroke-width="2.2"/><path d="M-6 -20h11M-6 -14h11M-6 -8h8" stroke="${INK}" stroke-width="1.4"/>${lbl ? `<text x="0" y="12" text-anchor="middle" font-size="9" font-family="JetBrains Mono, monospace" fill="${INK}">${lbl}</text>` : ''}</g>`,
  phone: (x, y) => `<rect x="${x - 5}" y="${y - 16}" width="10" height="16" rx="2" fill="${INK}"/>`,
  trophy: (x, y) => `<g transform="translate(${x},${y})"><path d="M-10 -30h20v8q0 10 -10 12q-10 -2 -10 -12z" fill="${ACC}" stroke="${INK}" stroke-width="2"/><path d="M-3 -10h6v6h5v4h-16v-4h5z" fill="${INK}"/></g>`,
};

// A scene: an SVG canvas with figures and props placed on a ground line.
export function scene({ w = 320, h = 160, ground = h - 12, groundLine = true, items = [], extra = '', cls = '' }) {
  const parts = items.map((it) => {
    if (typeof it === 'string') return `<g transform="translate(0,${ground})">${it}</g>`;
    const { x = w / 2, y = ground, s = 1, ...f } = it;
    return `<g transform="translate(${x},${y}) scale(${s})">${figure(f)}</g>`;
  });
  const gl = groundLine ? `<path d="M8 ${ground + 1}H${w - 8}" stroke="var(--ink)" stroke-width="2" stroke-dasharray="1 7" stroke-linecap="round"/>` : '';
  return `<svg class="scene ${cls}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img"><g filter="url(#rough)">${gl}${parts.join('')}${extra}</g></svg>`;
}

// A single figure cropped tight, for inline use in callouts.
export function mini(opts = {}, size = 64) {
  const pad = opts.robot ? 124 : 118;
  return `<svg class="mini" width="${size}" height="${size * 1.25}" viewBox="-40 ${-pad} 80 ${pad + 6}" xmlns="http://www.w3.org/2000/svg"><g filter="url(#rough)">${figure(opts)}</g></svg>`;
}

export const DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
<filter id="rough" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="7" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.4" xChannelSelector="R" yChannelSelector="G"/></filter>
</defs></svg>`;
