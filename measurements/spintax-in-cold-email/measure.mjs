// Measurements for the article "How much spintax in a cold email is too much".
// Run from the project root, or anywhere with @spintax/core installed:
//
//   npm install @spintax/core@0.6.1
//   node measure.mjs
//
// Every MEASURED number in the article comes out of this file (the Gmail and
// Outlook requirements are quoted from their pages). The engine is the published
// @spintax/core; the lint rules mirror the language-neutral half of the n8n
// node's Lint operation (packages/n8n-node/src/ops/lint.ts in
// investblog/spintax-js): `repeat.word` over a six-word window, four-letter
// words and longer, English function words excluded; and the punctuation joins
// a bad render leaves behind.
import { render } from '@spintax/core';

// ── one cold email, five lines, a signature with two links ───────────────────
// SLOTS are the places a synonym set can be switched on, three options each,
// in the order a copywriter would add them: subject and opener first, the
// signature never. Some sets share vocabulary on purpose (quick/short/brief,
// call/chat) — that is what real templates look like after the third edit, and
// it is what the lint exists to catch.
const SLOTS = [
  ['Quick', 'Short', 'Brief'], // 0 subject
  ['question', 'note', 'thought'], // 1 subject
  ['Hi', 'Hello', 'Hey'], // 2 opener
  ['noticed', 'saw', 'spotted'], // 3 opener
  ['is hiring', 'has open roles', 'is growing the team'], // 4 opener
  ['We help', 'We work with', 'We support'], // 5 value
  ['teams like yours', 'companies at your stage', 'growing teams'], // 6 value
  ['cut', 'shorten', 'reduce'], // 7 value
  ['onboarding time', 'ramp-up time', 'time to first deal'], // 8 value
  ['Last quarter', 'Recently', 'This spring'], // 9 proof
  ['a team of twelve', 'a twelve-person team', 'a team your size'], // 10 proof
  ['went from', 'moved from', 'got from'], // 11 proof
  ['six weeks to nine days', 'six weeks down to nine days', 'six weeks to under two'], // 12 proof
  ['Worth', 'Open to', 'Up for'], // 13 cta
  ['a quick call', 'a short chat', 'a brief conversation'], // 14 cta
  ['next week', 'this week', 'sometime next week'], // 15 cta
  ['to see if it fits', 'to check the fit', 'to see whether it applies'], // 16 cta
  ['If not', 'If the timing is off', 'If this is not relevant'], // 17 close
  ['no worries', 'no problem', 'all good'], // 18 close
  ['just', 'simply', 'do'], // 19 close
  ['reply', 'answer', 'write back'], // 20 close
  ['and I will', 'and I shall', 'and I can'], // 21 close
  ['stop', 'close the loop', 'leave it there'], // 22 close
  ['Best', 'Thanks', 'Cheers'], // 23 sign-off
];
const opt = (i, live) => (live ? `{${SLOTS[i].join('|')}}` : SLOTS[i][0]);

/** The email with the first `k` slots live and the rest frozen to their first option. */
function email(k) {
  const s = SLOTS.map((_, i) => opt(i, i < k));
  return [
    `Subject: ${s[0]} ${s[1]} about %company%`,
    '',
    `${s[2]} %name%, I ${s[3]} %company% ${s[4]}.`,
    `${s[5]} ${s[6]} ${s[7]} ${s[8]}. ${s[9]} ${s[10]} ${s[11]} ${s[12]}.`,
    `${s[13]} ${s[14]} ${s[15]} ${s[16]}? ${s[17]}, ${s[18]}: ${s[19]} ${s[20]} ${s[21]} ${s[22]}.`,
    '',
    `${s[23]},`,
    'Dana Reyes',
    'Head of Growth, Northwind Onboarding',
    'https://northwind.example/book — https://northwind.example/unsubscribe',
  ].join('\n');
}

// 500 recipients: 50 first names x 10 companies, every pair distinct.
const NAMES = ['Ada', 'Ben', 'Chloe', 'Dan', 'Eva', 'Finn', 'Gus', 'Hana', 'Ivan', 'Jo',
  'Kim', 'Leo', 'Mia', 'Ned', 'Ola', 'Pia', 'Quinn', 'Rae', 'Sam', 'Tia',
  'Uma', 'Val', 'Wes', 'Xia', 'Yan', 'Zed', 'Ana', 'Bo', 'Cal', 'Dee',
  'Eli', 'Fay', 'Gil', 'Hal', 'Ida', 'Jay', 'Kai', 'Lou', 'Max', 'Nia',
  'Otto', 'Pat', 'Raj', 'Sol', 'Tom', 'Ula', 'Vic', 'Wren', 'Yara', 'Zoe'];
const COMPANIES = ['Acme', 'Borealis', 'Cobalt', 'Delta Labs', 'Everline', 'Fathom', 'Granite', 'Helix', 'Ionic', 'Juniper'];
const RECIPIENTS = NAMES.flatMap((name) => COMPANIES.map((company) => ({ name, company })));
const N = RECIPIENTS.length; // 500

function sends(k) {
  const tpl = email(k);
  return RECIPIENTS.map((ctx, i) => render(tpl, { context: ctx, seed: i + 1 }));
}

/**
 * The same sends with the two merge values replaced by a sentinel — the seed fixes every
 * other choice, so this is exactly the body minus the data. Used wherever two sends are
 * compared as text: a name can be a substring of another word (Ana in Dana), so blanking
 * the rendered text afterwards is not safe.
 */
const IGNORED = 'spxignoredword';
function blanked(k) {
  const tpl = email(k);
  return RECIPIENTS.map((_, i) => render(tpl, { context: { name: IGNORED, company: IGNORED }, seed: i + 1 }));
}

const f3 = (x) => x.toFixed(3);
const pct = (x) => `${(100 * x).toFixed(1)}%`;

// ── E1. Identical bodies among 500 sends, as the number of live slots grows ──
console.log(`E1  ${N} sends: live slots -> distinct messages (subject + body) / largest identical group / sends sharing their text with someone / predicted distinct`);
for (const k of [0, 2, 4, 6, 8, 10, 12]) {
  const bodies = blanked(k);
  const counts = new Map();
  for (const b of bodies) counts.set(b, (counts.get(b) ?? 0) + 1);
  const combos = 3 ** k;
  // Birthday arithmetic: C combinations, N draws -> about C * (1 - e^(-N/C)) distinct
  // on average (the Poisson approximation of C * (1 - (1 - 1/C)^N)).
  const predicted = combos * (1 - Math.exp(-N / combos));
  const shared = [...counts.values()].filter((c) => c > 1).reduce((a, c) => a + c, 0);
  console.log(`  ${String(k).padStart(2)} slots  ${String(counts.size).padStart(3)} distinct  largest ${String(Math.max(...counts.values())).padStart(3)}  shared ${String(shared).padStart(3)}  predicted ${predicted.toFixed(0)}  (3^${k} = ${combos})`);
}

// ── E2. What never changes: the share of each body that is identical in ≥95% of sends ──
function words(text) {
  return text.toLowerCase().replace(/https?:\/\/\S+/g, ' URL ').replace(/[\p{P}\p{S}]/gu, ' ').replace(/\s+/gu, ' ').trim().split(' ');
}
function shingles(ws, w = 5) {
  const out = new Set();
  for (let i = 0; i + w <= ws.length; i++) out.add(ws.slice(i, i + w).join(' '));
  return out;
}
console.log(`\nE2  share of a body's 5-word shingles that appear in 95% or more of the ${N} sends`);
for (const k of [0, 8, 24]) {
  const docs = blanked(k).map((t) => shingles(words(t)));
  const df = new Map();
  for (const d of docs) for (const s of d) df.set(s, (df.get(s) ?? 0) + 1);
  const constant = new Set([...df].filter(([, c]) => c >= 0.95 * N).map(([s]) => s));
  const share = docs.reduce((acc, d) => acc + [...d].filter((s) => constant.has(s)).length / d.size, 0) / docs.length;
  console.log(`  ${String(k).padStart(2)} slots  ${pct(share)} of every body is the same text in almost every send`);
}

// ── E3. Lint: renders with at least one defect, as the slots grow ────────────
const STOP = new Set(['that', 'this', 'with', 'from', 'have', 'has', 'had', 'will', 'would', 'could',
  'should', 'they', 'them', 'their', 'there', 'these', 'those', 'your', 'yours',
  'about', 'which', 'when', 'what', 'where', 'were', 'been', 'into', 'than', 'then', 'some',
  'more', 'most', 'less', 'fewer', 'just', 'like', 'also', 'only', 'even', 'very', 'much', 'each',
  'over', 'after', 'before', 'while', 'because', 'here']);
const WINDOW = 6;
function lint(text) {
  const findings = [];
  const body = text.replace(/https?:\/\/\S+/g, 'URL');
  if (/ {2,}/.test(body)) findings.push('punctuation.double-space');
  if (/ [,.;:!?]/.test(body)) findings.push('punctuation.space-before');
  if (/([,.;:!?])\1/.test(body)) findings.push('punctuation.duplicated');
  const ws = body.toLowerCase().replace(/[\p{P}\p{S}]/gu, ' ').replace(/\s+/gu, ' ').trim().split(' ');
  for (let i = 0; i < ws.length; i++) {
    const w = ws[i];
    if (w.length < 4 || STOP.has(w) || w === IGNORED) continue;
    for (let j = i + 1; j < Math.min(ws.length, i + WINDOW); j++) {
      if (ws[j] === w) { findings.push(`repeat.word:${w}`); break; }
    }
  }
  return findings;
}
console.log(`\nE3  renders with at least one lint finding (repeat.word within ${WINDOW} words, or a bad join)`);
for (const k of [0, 4, 8, 16, 24]) {
  // Merge values are ignored, as the node's `ignore` option does: a company named
  // twice is data, not writing.
  const results = blanked(k).map((t) => lint(t));
  const bad = results.filter((f) => f.length > 0).length;
  const top = new Map();
  for (const f of results.flat()) top.set(f, (top.get(f) ?? 0) + 1);
  const worst = [...top].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([f, c]) => `${f} x${c}`).join(', ');
  console.log(`  ${String(k).padStart(2)} slots  ${pct(bad / N).padStart(6)} of ${N} renders${worst ? `  (${worst})` : ''}`);
}

// ── E4. The slot count at which two recipients stop getting the same body ────
console.log('\nE4  sends per day -> live slots (3 options) needed for under one expected identical pair');
for (const n of [200, 500, 2000, 5000]) {
  let k = 0;
  while ((n * n) / (2 * 3 ** k) >= 1) k++;
  console.log(`  ${String(n).padStart(5)} sends/day  ${k} slots  (3^${k} = ${3 ** k} combinations)`);
}

// The usual advice is three to five groups. Five groups of three is 243 bodies;
// N sends draw from them, and N*(N-1)/2 pairs each collide with probability 1/243.
console.log('\nE4b five slots (243 bodies): expected pairs of recipients holding an identical body');
for (const n of [200, 500]) console.log(`  ${String(n).padStart(5)} sends/day  ~${Math.round((n * (n - 1)) / 2 / 243)} identical pairs`);

// ── E5. A sample of the same email at 4 and at 24 slots, to read ──────────────
console.log('\nE5  the same email, seed 7, at 4 slots and at 24');
for (const k of [4, 24]) console.log(`--- ${k} slots ---\n${render(email(k), { context: RECIPIENTS[6], seed: 7 })}\n`);
