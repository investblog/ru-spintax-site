// Measurements for the article "Scaled content abuse: what Google deindexes, and
// what that makes of spintax". Run from the project root:
//
//   node public/measurements/scaled-content-abuse/measure.mjs
//
// Every MEASURED number in the article comes out of this file (the dates, the case
// study figures and the n8n node's own footprint numbers are quoted from their
// sources, see context/research). The engine is the
// published @spintax/core (devDependency, version in package.json); the
// similarity metric is built from the same ingredients as the n8n node's
// uniqueness operation (packages/n8n-node/src/ops/uniqueness.ts in
// investblog/spintax-js): 5-word shingles over text normalised the same way,
// and Jaccard between shingle sets. The node uses Jaccard to flag near-duplicate
// pairs and reports the "footprint" (the share of the pool's distinct shingles
// that appear in more than 20% of its documents); the article's headline number
// is the MEAN of the pairwise Jaccard over all 1225 pairs, which the node does
// not report — it is printed here next to the footprint so both are on record.
import { render } from '@spintax/core';

// ── the metric (same steps as the n8n node) ──────────────────────────────────
function words(text) {
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(/[\p{P}\p{S}]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}
function shingles(ws, width = 5) {
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
  const cutoff = share * docs.length;
  let shared = 0;
  for (const c of df.values()) if (c > cutoff) shared++;
  return shared / df.size;
}
function meanPairwise(docs) {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < docs.length; i++)
    for (let k = i + 1; k < docs.length; k++) {
      sum += jaccard(docs[i], docs[k]);
      n++;
    }
  return sum / n;
}
function measure(texts) {
  const docs = texts.map((t) => shingles(words(t)));
  return { footprint: footprint(docs), pairwise: meanPairwise(docs), unique: new Set(texts).size };
}
const f3 = (x) => x.toFixed(3);

// ── the pool: fifty city pages for one service ────────────────────────────────
const CITIES = [
  'Austin', 'Boise', 'Boston', 'Buffalo', 'Charlotte', 'Chicago', 'Cleveland', 'Columbus',
  'Dallas', 'Denver', 'Detroit', 'El Paso', 'Fresno', 'Houston', 'Indianapolis', 'Jacksonville',
  'Kansas City', 'Las Vegas', 'Louisville', 'Memphis', 'Mesa', 'Miami', 'Milwaukee', 'Minneapolis',
  'Nashville', 'New Orleans', 'Oakland', 'Oklahoma City', 'Omaha', 'Orlando', 'Philadelphia',
  'Phoenix', 'Pittsburgh', 'Portland', 'Raleigh', 'Reno', 'Richmond', 'Sacramento', 'San Antonio',
  'San Diego', 'San Jose', 'Seattle', 'Spokane', 'St. Louis', 'Tampa', 'Tucson', 'Tulsa',
  'Virginia Beach', 'Wichita', 'Worcester',
];

// A skeleton of about 70 words, the shape of a thousand "plumber in CITY" pages. The
// SLOTS below mark where a synonym set can be switched on; each is 3 options.
const SLOTS = [
  '{Need|Looking for|Searching for}', '{a plumber|a plumbing service|a licensed plumber}',
  '{fast|quick|prompt}', '{same-day|next-day|24-hour}', '{fix|repair|solve}',
  '{leaks|drips|water leaks}', '{clogged|blocked|backed-up}', '{drains|pipes|lines}',
  '{water heaters|boilers|hot water systems}', '{transparent|clear|upfront}',
  '{pricing|prices|quotes}', '{no hidden fees|no surprise charges|nothing hidden}',
  '{licensed|certified|qualified}', '{insured|covered|bonded}', '{technicians|plumbers|experts}',
  '{arrive|show up|come}', '{on time|when promised|as scheduled}', '{clean up|tidy up|leave it clean}',
  '{afterwards|when done|after the job}', '{call|phone|ring}', '{today|now|right away}',
  '{free|no-cost|complimentary}', '{estimate|quote|assessment}', '{residential|home|household}',
  '{commercial|business|office}', '{emergency|urgent|after-hours}', '{available|on call|ready}',
  '{every day|seven days a week|daily}', '{trusted|reliable|dependable}', '{local|nearby|neighbourhood}',
  '{team|crew|company}', '{guarantee|warranty|promise}',
];
const first = (slot) => slot.slice(1, -1).split('|')[0];

/** The skeleton with the first `n` slots live and the rest frozen to their first option. */
function skeleton(n) {
  const s = SLOTS.map((slot, i) => (i < n ? slot : first(slot)));
  return (
    `${s[0]} ${s[1]} in %city%? We ${s[4]} ${s[5]}, ${s[6]} ${s[7]} and ${s[8]} with ${s[2]} ` +
    `${s[3]} service across %city%. ${s[9]} ${s[10]}, ${s[11]}. Our ${s[12]}, ${s[13]} ${s[14]} ` +
    `${s[15]} ${s[16]} and ${s[17]} ${s[18]}. ${s[19]} us ${s[20]} for a ${s[21]} ${s[22]}. ` +
    `We serve ${s[23]} and ${s[24]} customers in %city%, with ${s[25]} help ${s[26]} ${s[27]}. ` +
    `A ${s[28]}, ${s[29]} ${s[30]} with a written ${s[31]} on every job in %city%.`
  );
}

function pool(template, ctxFor) {
  return CITIES.map((city, i) => render(template, { context: ctxFor(city, i), seed: i + 1 }));
}

console.log('pool: 50 city pages, one service, 5-word shingles, footprint share 0.2\n');

// E1. Synonymising: switch on more and more slots.
console.log('E1  synonym slots switched on -> footprint / mean pairwise Jaccard / distinct texts');
for (const n of [0, 4, 8, 16, 24, 32]) {
  const m = measure(pool(skeleton(n), (city) => ({ city })));
  console.log(`  ${String(n).padStart(2)} slots  ${f3(m.footprint)}  ${f3(m.pairwise)}  ${m.unique}/50`);
}

// E2. The same skeleton (every slot frozen to its first option, exactly skeleton(0))
// with five per-city facts bound to variables — inserted by string replacement so
// nothing else about the text changes.
const FACTS = (city, i) => ({
  city,
  zip: String(10000 + i * 731),
  since: String(1998 + (i % 20)),
  jobs: String(1200 + i * 37),
  minutes: String(20 + (i % 25)),
  rating: `${4 + (i % 10) / 10}`,
});
const factual = skeleton(0)
  .replace('in %city%?', 'in %city% (%zip%)?')
  .replace('technicians arrive on time', 'technicians have completed %jobs% jobs since %since% and arrive in about %minutes% minutes')
  .replace('A trusted, local team', 'Rated %rating% by local clients, a trusted, local team');
if (!/%zip%/.test(factual) || !/%jobs%/.test(factual) || !/%rating%/.test(factual)) throw new Error('E2 replacements missed');
const e2 = measure(pool(factual, FACTS));
console.log(`\nE2  five facts per city, no synonyms       ${f3(e2.footprint)}  ${f3(e2.pairwise)}  ${e2.unique}/50`);

// E3. Facts plus structure: three sentence templates per slot and a permuted order.
const structural =
  `#def %intro% = {Need a plumber in %city%?|%city% plumbing, done properly.|Plumber in %city%, %zip%: here is how we work.}
#def %work% = {We fix leaks, clogged drains and water heaters.|Leaks, blocked drains, water heaters: the three calls we get most.|From a dripping tap to a failed water heater.}
#def %proof% = {%jobs% jobs in %city% since %since%.|Working in %city% since %since%, %jobs% jobs and counting.|Since %since%: %jobs% completed jobs across %city%.}
#def %speed% = {We arrive in about %minutes% minutes.|Typical arrival time is %minutes% minutes.|Expect us within %minutes% minutes.}
#def %price% = {Transparent pricing, no hidden fees.|You see the price before we start.|Written quote first, then the work.}
#def %score% = {Rated %rating% by local clients.|%rating% from customers in %city%.|Local rating: %rating%.}
%intro% [<minsize=5;maxsize=5;sep=" ">%work%|%proof%|%speed%|%price%|%score%] Call for a free estimate.`;
const e3 = measure(pool(structural, FACTS));
console.log(`E3  facts + 3 sentence forms + permuted order ${f3(e3.footprint)}  ${f3(e3.pairwise)}  ${e3.unique}/50`);

// E4. The deletion test: replace every bound value with a placeholder and measure
// what is left. If the pool collapses, the pages were one page wearing fifty names.
const blank = (t) => ({ city: 'X', zip: 'X', since: 'X', jobs: 'X', minutes: 'X', rating: 'X' });
const del = (template) => measure(pool(template, blank));
console.log('\nE4  deletion test (every variable -> X): footprint / pairwise');
console.log(`  E1 at 32 slots   ${f3(del(skeleton(32)).footprint)}  ${f3(del(skeleton(32)).pairwise)}`);
console.log(`  E2 facts         ${f3(del(factual).footprint)}  ${f3(del(factual).pairwise)}`);
console.log(`  E3 structural    ${f3(del(structural).footprint)}  ${f3(del(structural).pairwise)}`);

// E5. Combinations: how many distinct texts a 32-slot skeleton can produce, on paper.
console.log(`\nE5  32 slots x 3 options = 3^32 = ${(3 ** 32).toExponential(2)} distinct renders on paper`);
