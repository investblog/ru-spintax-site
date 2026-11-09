// Measurements for the article on why LLM product descriptions come out the same.
// Run from the project root, or anywhere with @spintax/core installed and
// generations.json next to this file:
//
//   npm install @spintax/core@0.6.1
//   node measure.mjs
//
// generate.mjs asked the models once and saved every answer; this file only
// reads them, so every MEASURED number in the article can be re-checked without
// an API key. The similarity metric is the one the scaled content abuse article
// uses, built from the same ingredients as the n8n node's uniqueness operation:
// 5-word shingles over normalised text, Jaccard between shingle sets, the mean
// over all pairs, and the footprint (the share of a pool's distinct shingles that
// appear in more than 20% of its texts). Everything here is lexical: it counts
// words and their order, not meaning, which is what the papers quoted in the
// article measure instead.
import { readFileSync } from 'node:fs';
import { render } from '@spintax/core';

const data = JSON.parse(readFileSync(new URL('./generations.json', import.meta.url), 'utf8'));

// ── the pools ─────────────────────────────────────────────────────────────────
const pools = {};
for (const c of Object.values(data.calls)) {
  const texts = c.prompt === 'batch' ? c.text.split(/^\s*---\s*$/m).map((t) => t.trim()).filter(Boolean) : [c.text];
  (pools[c.arm] ??= []).push(...texts);
}

// The same description as a template. Every fact from the prompt sits in exactly
// one place; the variation is in the opening, the order of the four middle
// sentences, and whole-clause alternatives rather than single-word synonyms.
// Nothing in it is a fact the prompt did not give.
const TEMPLATE = [
  '{The Kestrel 750 is {an insulated|a vacuum-insulated} water bottle {that holds 750 ml|with a 750 ml capacity}',
  '|Meet the Kestrel 750, a 750 ml {insulated water bottle|vacuum-insulated bottle}',
  '|Kestrel 750: a 750 ml {insulated|vacuum-insulated} {water bottle|bottle}}',
  '{, built from| made of|, with a body of} double-wall {vacuum stainless steel|stainless steel with a vacuum between the walls}. ',
  '[',
  '{It keeps drinks cold for 24 hours and hot for 12|Drinks stay cold for 24 hours and hot for 12|Cold drinks stay cold for 24 hours, hot ones for 12}.',
  '|{The screw cap is leak-proof and has a carry loop|A carry loop sits on the leak-proof screw cap|The leak-proof screw cap comes with a carry loop}.',
  '|{It fits most car cup holders and weighs 380 g|At 380 g, it fits most car cup holders|It weighs 380 g and fits most car cup holders}.',
  '|{The lid is dishwasher-safe|The lid can go in the dishwasher|The lid goes in the dishwasher}.',
  '] ',
  '{Choose from five colours|It comes in five colours|Five colours are available}.',
].join('');
pools.template = Array.from({ length: 50 }, (_, i) => render(TEMPLATE, { seed: i + 1 }));
// Texts on paper: openings 2x2 + 2 + 2x2 = 10, joins 3 x steel 2, four sentences of
// three forms each (81) in any of 24 orders, three closings.
const COMBINATIONS = 10 * 3 * 2 * 3 ** 4 * 24 * 3;

const ORDER = ['claude-haiku-4-5', 'claude-sonnet-5', 'gpt-5.6-sol', 'claude-sonnet-5-original', 'claude-sonnet-5-batch', 'template'];

// ── the metric (same steps as the n8n node) ──────────────────────────────────
function words(text) {
  return text.normalize('NFC').toLowerCase().replace(/[’']/g, '').replace(/[\p{P}\p{S}]/gu, ' ').replace(/\s+/gu, ' ').trim().split(' ').filter(Boolean);
}
function grams(ws, width) {
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
function footprint(docs, share = 0.2) {
  const df = new Map();
  for (const set of docs) for (const s of set) df.set(s, (df.get(s) ?? 0) + 1);
  let shared = 0;
  for (const c of df.values()) if (c > share * docs.length) shared++;
  return shared / df.size;
}
function meanPairwise(a, b = a) {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < a.length; i++)
    for (let k = a === b ? i + 1 : 0; k < b.length; k++) {
      sum += jaccard(a[i], b[k]);
      n++;
    }
  return sum / n;
}
const f3 = (x) => x.toFixed(3);
const pct = (x) => `${Math.round(100 * x)}%`;
const top = (map, n) => [...map].sort((a, b) => b[1] - a[1]).slice(0, n);
const tally = (xs) => xs.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map());

// ── E1. How alike the texts in each pool are ─────────────────────────────────
console.log('E1  pool: texts / mean words / distinct texts / mean pairwise Jaccard (5-word shingles) / footprint');
const shingled = {};
for (const arm of ORDER) {
  const texts = pools[arm] ?? [];
  if (texts.length < 2) continue;
  shingled[arm] = texts.map((t) => grams(words(t), 5));
  const meanWords = texts.reduce((a, t) => a + words(t).length, 0) / texts.length;
  console.log(`  ${arm.padEnd(26)} ${String(texts.length).padStart(3)}  ${meanWords.toFixed(0).padStart(3)} words  ${String(new Set(texts).size).padStart(3)} distinct  J ${f3(meanPairwise(shingled[arm]))}  footprint ${f3(footprint(shingled[arm]))}`);
}

// Uniform draws of 5,000 from C texts give about C * (1 - e^(-5000/C)) distinct.
const expected = COMBINATIONS * (1 - Math.exp(-5000 / COMBINATIONS));
console.log(`  template on paper: ${COMBINATIONS.toLocaleString('en')} texts; distinct among 5,000 seeds: ${new Set(Array.from({ length: 5000 }, (_, i) => render(TEMPLATE, { seed: i + 1 }))).size} (expected ${expected.toFixed(0)})`);

// ── E2. How they open ────────────────────────────────────────────────────────
console.log('\nE2  pool: distinct first three words / the most common opening and its share');
for (const arm of ORDER) {
  const texts = pools[arm];
  if (!texts) continue;
  const openings = tally(texts.map((t) => words(t).slice(0, 3).join(' ')));
  const [first, count] = top(openings, 1)[0];
  const second = top(openings, 2)[1];
  console.log(`  ${arm.padEnd(26)} ${String(openings.size).padStart(2)} openings  "${first}" ${pct(count / texts.length)}${second ? `  then "${second[0]}" ${pct(second[1] / texts.length)}` : ''}`);
}

// ── E3. In what order the facts come ─────────────────────────────────────────
// The prompt gives eight facts, listed here in its order. A fact counts as stated
// only when every part of it is there, in the prompt's words or a plain paraphrase
// of them: steel AND vacuum AND a wall; 24 hours (or a full day) AND 12 (or half
// a day); leak proof (or drip, or a seal) AND a loop; five AND colours. A text
// that fails a part has left it out or blurred it ("past noon" for 12 hours).
// The order signature is the sequence of first mentions of any part of each
// fact, over the facts a text mentions at all.
const FACTS = {
  capacity: [/750\s?ml|750-ml|750 millilit/],
  steel: [/steel/, /vacuum/, /wall/],
  temperature: [/\b24\b|twenty[- ]four|full day/, /\b12\b|twelve|half (?:a day|of one|the day)/],
  // "seal" but not "vacuum-sealed", which describes the steel, not the cap.
  cap: [/leak|drip|(?<!vacuum[- ])seal/, /loop/],
  cupholder: [/cup ?holder/],
  weight: [/380/],
  lid: [/dishwasher/],
  colours: [/\b(?:five|5)\b[^.;]{0,20}colou?rs?|colou?rs?[^.;]{0,20}\b(?:five|5)\b/],
};
console.log('\nE3  pool: distinct fact orders / in the prompt\'s order / most common order / texts missing or changing a fact');
for (const arm of ORDER) {
  const texts = pools[arm];
  if (!texts) continue;
  const sigs = [];
  let missing = 0;
  const missed = new Map();
  for (const t of texts) {
    const low = t.toLowerCase();
    let whole = true;
    const found = [];
    for (const [name, parts] of Object.entries(FACTS)) {
      const at = parts.map((re) => low.search(re));
      if (at.some((i) => i < 0)) {
        whole = false;
        missed.set(name, (missed.get(name) ?? 0) + 1);
      }
      const seen = at.filter((i) => i >= 0);
      if (seen.length) found.push([name, Math.min(...seen)]);
    }
    if (!whole) missing++;
    sigs.push(found.sort((a, b) => a[1] - b[1]).map(([name]) => name).join(' > '));
  }
  const orders = tally(sigs);
  const [first, count] = top(orders, 1)[0];
  const missedText = top(missed, 8).map(([f, c]) => `${f} ${c}`).join(', ');
  const promptOrder = pct((orders.get(Object.keys(FACTS).join(' > ')) ?? 0) / texts.length);
  // A softer measure of the same thing: of all pairs of facts a text mentions,
  // the share that come in the prompt's order. Shuffled facts give about half.
  const rank = Object.fromEntries(Object.keys(FACTS).map((f, i) => [f, i]));
  let kept = 0;
  let pairs = 0;
  for (const sig of sigs) {
    const seq = sig.split(' > ').map((f) => rank[f]);
    for (let i = 0; i < seq.length; i++)
      for (let k = i + 1; k < seq.length; k++) {
        pairs++;
        if (seq[i] < seq[k]) kept++;
      }
  }
  console.log(`  ${arm.padEnd(26)} pairs of facts in the prompt's order: ${pct(kept / pairs)}`);
  console.log(`  ${arm.padEnd(26)} ${String(orders.size).padStart(2)} orders  in the prompt's order ${promptOrder}  most common ${pct(count / texts.length)} "${first}"  missing a fact: ${missing}${missedText ? ` (${missedText})` : ''}`);
}

// ── E4. The model's own habits: phrases the prompt never said ────────────────
// Three-word phrases carrying at least one content word the prompt does not
// contain ("five stylish colours", "on the go"), in at least a fifth of a pool's
// texts. Rewordings of the facts ("dishwasher safe lid") are left out, since
// every description has to say them somehow. The template is held to the same
// rule: its own fixed wording counts.
const promptWords = new Set(words(`${data.prompts.plain} ${data.prompts.original} ${data.prompts.batch}`));
const FUNCTION = new Set(['a', 'an', 'the', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with', 'is', 'are', 'it', 'its', 'its', 'this', 'that', 'your', 'you', 'at', 'by', 'from', 'as', 'be', 'can', 'so', 'into', 'while', 'up', 'has', 'have', 'which', 'whether', 'youre', 'our', 'will']);
const novel = (g) => g.split(' ').some((w) => !promptWords.has(w) && !FUNCTION.has(w) && !/^\d/.test(w));
const habits = {};
console.log('\nE4  pool: three-word phrases with a word the prompt never used, in 20% or more of the texts (share)');
for (const arm of ORDER) {
  const texts = pools[arm];
  if (!texts) continue;
  const df = new Map();
  for (const t of texts) for (const g of grams(words(t), 3)) if (novel(g)) df.set(g, (df.get(g) ?? 0) + 1);
  habits[arm] = new Map([...df].filter(([, c]) => c >= 0.2 * texts.length));
  const list = top(habits[arm], 8).map(([g, c]) => `"${g}" ${pct(c / texts.length)}`).join(', ');
  console.log(`  ${arm.padEnd(26)} ${String(habits[arm].size).padStart(3)}  ${list}`);
}

// ── E5. Across models ────────────────────────────────────────────────────────
console.log('\nE5  pairs of pools: mean Jaccard between their texts / habit phrases they share');
const cross = [['claude-haiku-4-5', 'claude-sonnet-5'], ['claude-sonnet-5', 'gpt-5.6-sol'], ['claude-haiku-4-5', 'gpt-5.6-sol']];
for (const [a, b] of cross) {
  if (!shingled[a] || !shingled[b]) continue;
  const shared = [...habits[a].keys()].filter((g) => habits[b].has(g));
  console.log(`  ${a} x ${b}  J ${f3(meanPairwise(shingled[a], shingled[b]))}  shared ${shared.length}: ${shared.slice(0, 8).join(' / ')}`);
}
const inAll = [...habits['claude-haiku-4-5'].keys()].filter((g) => habits['claude-sonnet-5'].has(g) && habits['gpt-5.6-sol'].has(g));
console.log(`  in all three models' habits: ${inAll.map((g) => `"${g}" ${['claude-haiku-4-5', 'claude-sonnet-5', 'gpt-5.6-sol'].map((m) => pct(habits[m].get(g) / pools[m].length)).join('/')}`).join(', ')}`);

// ── E6. A fact stated more strongly than the prompt ──────────────────────────
// Written after reading all the texts: the one drift that turned up often enough
// to count, and that a rule can find without judgement. The prompt says "fits most
// car cup holders". A text that says "nearly any" or "almost any" has widened it
// with a hedge; one that says any, every, all, standard (not "most standard") or
// "everywhere" has widened it without one. This is not a full fact check.
const HOLDER = /(\b\w+\s+)?\b(any|every|all|standard)\b[^.;]{0,20}cup ?holders?|cup ?holders? everywhere/i;
function widening(t) {
  const m = t.match(HOLDER);
  if (!m) return null;
  const before = (m[1] ?? '').trim().toLowerCase();
  // "most standard car cup holders" keeps the hedge; "a standard cup holder" is one
  // typical holder, not a claim about all of them.
  if (before === 'most' || before === 'a') return null;
  return before === 'nearly' || before === 'almost' ? 'hedged' : 'flat';
}
console.log('\nE6  pool: texts widening "fits most car cup holders": hedged (nearly/almost any) / flat (any, standard, everywhere)');
for (const arm of ORDER) {
  const texts = pools[arm];
  if (!texts) continue;
  const kinds = tally(texts.map(widening).filter(Boolean));
  console.log(`  ${arm.padEnd(26)} ${String((kinds.get('hedged') ?? 0) + (kinds.get('flat') ?? 0)).padStart(2)} of ${texts.length}  hedged ${kinds.get('hedged') ?? 0}  flat ${kinds.get('flat') ?? 0}`);
}

// ── E7. Samples to read ──────────────────────────────────────────────────────
console.log('\nE7  first two texts of each pool');
for (const arm of ORDER) if (pools[arm]) console.log(`--- ${arm} ---\n${pools[arm].slice(0, 2).join('\n\n')}\n`);
