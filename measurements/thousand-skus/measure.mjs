// Measurements for the article on product descriptions across a catalogue.
// Run with @spintax/core installed and catalogue.mjs and template.txt next to this file:
//
//   npm install @spintax/core@0.14.0
//   node measure.mjs
//
// The catalogue is synthetic (catalogue.mjs). Four pools of 100 descriptions, one per SKU:
//   copied     the product line's description, the same text on all 20 SKUs of a line
//   merge      one sentence frame with the row's values pasted in, no choices, no conditions
//   one seed   the template, every SKU rendered with the same seed
//   per SKU    the template, each SKU rendered with its own SKU as the seed
// The similarity metric is the one the scaled content abuse and product descriptions articles
// use: five word shingles over normalised text, Jaccard between every pair, averaged, and the
// footprint (the share of a pool's distinct shingles found in more than 20% of its texts).
import { readFileSync } from 'node:fs';
import { render } from '@spintax/core';
import { CATALOGUE } from './catalogue.mjs';

const TEMPLATE = readFileSync(new URL('./template.txt', import.meta.url), 'utf8');

// Conditionals test for a non-empty value, so booleans go in as '1' or ''.
const flag = (b) => (b ? '1' : '');
const context = (p) => ({
  name: p.name, material: p.material, lid: p.lid,
  capacity: String(p.capacity), weight: String(p.weight), colours: String(p.colours),
  cold: String(p.cold ?? ''), hot: String(p.hot ?? ''),
  insulated: flag(p.insulated), leakproof: flag(p.leakproof),
  dishwasher: flag(p.dishwasher), cupholder: flag(p.cupholder),
});

const merge = (p) =>
  `The ${p.name} is a ${p.capacity} ml water bottle made of ${p.material}. ` +
  `It has a ${p.lid} lid and weighs ${p.weight} g. It comes in ${p.colours} colours.`;

const pools = {
  copied: CATALOGUE.map((p) => p.copy),
  merge: CATALOGUE.map(merge),
  'one seed': CATALOGUE.map((p) => render(TEMPLATE, { context: context(p), seed: 1 })),
  'per SKU': CATALOGUE.map((p) => render(TEMPLATE, { context: context(p), seed: p.sku })),
};

// ── the nine fields each description is checked against, straight from the row ──
// A value the row has must be stated in a sentence with no negation in it, and no other value
// of the same kind from the catalogue may appear anywhere in the text (a value the catalogue
// does not contain, an unknown material say, is not caught). A feature the row has must be
// stated in such a sentence; a feature it lacks must not be mentioned at all. Compound facts
// need every part: an insulated bottle needs both hour figures. Claims outside these nine
// fields ("hard to break") are not scored by anything here.
const NEG = /\b(not|never|no|cannot|can[’']t|doesn[’']t|don[’']t|isn[’']t|won[’']t|without)\b/i;
const ALLOWED = /seals without leaks/gi; // the template's own positive phrasing
const assertive = (t) => t.split(/(?<=[.!?])\s+/).filter((s) => !NEG.test(s.replace(ALLOWED, ''))).join(' ');
const has = (t, s) => t.toLowerCase().includes(s.toLowerCase());
const values = (t, re) => [...t.matchAll(re)].map((m) => m[1]);
// every value of this kind in the text is the row's, and one of them sits in an assertive sentence
const only = (t, re, want) => values(t, re).every((x) => x === String(want)) && values(assertive(t), re).includes(String(want));
const MATERIALS = [...new Set(CATALOGUE.map((p) => p.material))];
const LIDS = [...new Set(CATALOGUE.map((p) => p.lid))];
const FACTS = [
  ['capacity', (p, t) => only(t, /(\d+) ml\b/g, p.capacity)],
  ['material', (p, t) => has(assertive(t), p.material) && MATERIALS.every((m) => m === p.material || !has(t, m))],
  ['insulation', (p, t) => p.insulated
    ? only(t, /cold for (\d+) hours/g, p.cold) && only(t, /hot for (\d+)/g, p.hot)
    : !/cold for|hot for|insulat/i.test(t)],
  ['lid', (p, t) => has(assertive(t), `${p.lid} lid`) && LIDS.every((l) => l === p.lid || !new RegExp(`\\b${l} lid`, 'i').test(t))],
  ['leak proof', (p, t) => p.leakproof
    ? /leak-proof|seals without leaks/i.test(assertive(t)) && !/\bleak(s|y)?\b(?!-proof)/i.test(t.replace(ALLOWED, ''))
    : !/leak/i.test(t)],
  ['dishwasher', (p, t) => p.dishwasher
    ? /dishwasher/i.test(assertive(t)) && !/by hand|hand ?wash/i.test(t)
    : !/dishwasher/i.test(t)],
  ['weight', (p, t) => only(t, /(\d+) g\b/g, p.weight)],
  ['colours', (p, t) => only(t, /(\d+) colours?\b/g, p.colours)
    && new RegExp(`\\b${p.colours} ${p.colours === 1 ? 'colour\\b(?!s)' : 'colours\\b'}`, 'i').test(assertive(t))],
  ['cup holder', (p, t) => p.cupholder ? /fits most car cup holders/i.test(assertive(t)) : !/cup holder/i.test(t)],
];

// A guard that has never failed is not a guard: a correct text for a row with all four
// features and one for a row with none must pass, and each wrong text below must be rejected.
const check = (p, t) => FACTS.filter(([, ok]) => !ok(p, t)).map(([f]) => f);
const KES = CATALOGUE.find((p) => p.sku === 'KES-350-SCREW'); // insulated, leak proof, dishwasher, cup holder, 1 colour
const OK = 'The Kestrel 350 Screw is a 350 ml bottle made of double-wall vacuum stainless steel. It keeps drinks cold for 24 hours and hot for 12. The screw lid is leak-proof and goes in the dishwasher. It weighs 177 g and it fits most car cup holders. It comes in 1 colour.';
const PLO = CATALOGUE.find((p) => p.sku === 'PLO-1000-STRAW'); // none of the four features
const OK2 = `The Plover 1000 Straw is a 1000 ml bottle made of borosilicate glass with a silicone sleeve. Its straw lid is washed by hand. It weighs ${PLO.weight} g. It comes in ${PLO.colours} colours.`;
const BROKEN = [
  [KES, 'capacity', OK.replace('350 ml', '350 ml or 500 ml')],
  [KES, 'capacity', OK.replace('is a 350 ml bottle', 'is not a 350 ml bottle')],
  [KES, 'material', OK.replace('stainless steel', 'stainless steel or single-wall aluminium')],
  [KES, 'insulation', OK.replace('hot for 12', 'hot for 8')],
  [KES, 'insulation', OK.replace('It keeps drinks', 'It does not keep drinks')],
  [KES, 'lid', OK.replace('The screw lid', 'The screw lid or the straw lid')],
  [KES, 'leak proof', OK.replace('is leak-proof and', 'leaks and')],
  [KES, 'dishwasher', OK.replace('goes in the dishwasher', 'does not go in the dishwasher')],
  [KES, 'dishwasher', OK.replace('goes in the dishwasher', 'can’t go in the dishwasher')],
  [KES, 'weight', OK.replace('177 g', '177 g, 200 g with the sleeve,')],
  [KES, 'colours', OK.replace('1 colour.', '1 colours.')],
  [KES, 'cup holder', OK.replace('it fits most car cup holders', 'it doesn’t fit most car cup holders')],
  [PLO, 'insulation', OK2.replace('Its straw lid', 'It keeps drinks cold for 24 hours and hot for 12. Its straw lid')],
  [PLO, 'leak proof', OK2.replace('is washed by hand', 'is leak-proof')],
  [PLO, 'dishwasher', OK2.replace('is washed by hand', 'goes in the dishwasher')],
  [PLO, 'cup holder', OK2.replace(`${PLO.weight} g.`, `${PLO.weight} g and it fits most car cup holders.`)],
];
for (const [p, t] of [[KES, OK], [PLO, OK2]]) if (check(p, t).length) throw new Error(`the checks reject a correct text: ${check(p, t)}`);
for (const [p, f, t] of BROKEN) if (!check(p, t).includes(f)) throw new Error(`the ${f} check passes a wrong text: ${t}`);

function words(text) {
  return text.normalize('NFC').toLowerCase().replace(/[’']/g, '').replace(/[\p{P}\p{S}]/gu, ' ').replace(/\s+/gu, ' ').trim().split(' ').filter(Boolean);
}
function grams(ws, width = 5) {
  if (ws.length < width) return new Set([ws.join(' ')]);
  const out = new Set();
  for (let i = 0; i + width <= ws.length; i++) out.add(ws.slice(i, i + width).join(' '));
  return out;
}
function jaccard(a, b) {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}
function footprint(sets, share = 0.2) {
  const df = new Map();
  for (const s of sets) for (const g of s) df.set(g, (df.get(g) ?? 0) + 1);
  let shared = 0;
  for (const c of df.values()) if (c > share * sets.length) shared++;
  return shared / df.size;
}
function meanPairs(sets, keep = () => true) {
  let sum = 0, n = 0;
  for (let i = 0; i < sets.length; i++)
    for (let k = i + 1; k < sets.length; k++)
      if (keep(i, k)) { sum += jaccard(sets[i], sets[k]); n++; }
  return sum / n;
}
const f3 = (x) => x.toFixed(3);
const sameLine = (i, k) => CATALOGUE[i].line === CATALOGUE[k].line;

console.log('pool        similarity  same line  footprint  distinct  rows right  fields wrong');
const failures = {};
for (const [name, texts] of Object.entries(pools)) {
  const sets = texts.map((t) => grams(words(t)));
  let allRight = 0, bad = 0;
  failures[name] = {};
  CATALOGUE.forEach((p, i) => {
    const miss = check(p, texts[i]);
    if (miss.length === 0) allRight++;
    bad += miss.length;
    for (const f of miss) (failures[name][f] ??= []).push(i);
  });
  console.log(
    name.padEnd(12), f3(meanPairs(sets)).padStart(10), f3(meanPairs(sets, sameLine)).padStart(10),
    f3(footprint(sets)).padStart(10), String(new Set(texts).size).padStart(9),
    String(allRight).padStart(11), String(bad).padStart(13),
  );
}

// Every flagged SKU, by pool and field, with one flagged text per field, so the counts can be
// checked by eye. Then a few texts the checks pass.
console.log(`\nthe checks pass two correct texts and reject all ${BROKEN.length} deliberately wrong ones`);
console.log('\nflagged, by pool and field:');
for (const [name, byFact] of Object.entries(failures)) {
  if (!Object.keys(byFact).length) { console.log(`  ${name}: none`); continue; }
  for (const [f, xs] of Object.entries(byFact)) {
    console.log(`  ${name} / ${f} / ${xs.length}: ${xs.map((i) => CATALOGUE[i].sku).join(' ')}`);
    console.log(`    e.g. ${CATALOGUE[xs[0]].sku}: ${pools[name][xs[0]]}`);
  }
}
console.log('\npassed, per SKU:');
for (const i of [0, 2, 47, 99]) console.log(`  ${CATALOGUE[i].sku}: ${pools['per SKU'][i]}`);

// The same SKU on two storefronts: seed sku:site-a against sku:site-b.
const a = CATALOGUE.map((p) => grams(words(render(TEMPLATE, { context: context(p), seed: `${p.sku}:site-a` }))));
const b = CATALOGUE.map((p) => grams(words(render(TEMPLATE, { context: context(p), seed: `${p.sku}:site-b` }))));
const pairs = a.map((s, i) => jaccard(s, b[i]));
console.log(`\nsame SKU, two storefronts: mean ${f3(pairs.reduce((x, y) => x + y, 0) / pairs.length)}, identical ${pairs.filter((x) => x === 1).length} of 100`);

// A seed is a stable address: render every SKU again and compare byte for byte.
const again = CATALOGUE.filter((p, i) => render(TEMPLATE, { context: context(p), seed: p.sku }) === pools['per SKU'][i]).length;
console.log(`per SKU rendered twice: ${again} of 100 identical`);
