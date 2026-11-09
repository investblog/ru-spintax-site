// Measurements for the article on contact-form outreach with the Spintax
// Manual Outreach Helper. Run anywhere with the engine installed:
//
//   npm install @spintax/core@0.6.1
//   node measure.mjs
//
// The template is the extension's own bundled demo campaign ("guest posts",
// src/shared/demo.ts in investblog/spintax-extension), verbatim; the seed rule is
// the extension's (ADR 0006 there): seed = row key + ":" + step, where the key of
// a URL row is its hostname. Rows are synthetic — 200 blogs that do not exist.
import { render } from '@spintax/core';

const BODY = `{Hi|Hello} %name%,
{I run|I write for} %my_site% and {really enjoyed|liked} your {piece|post} on %topic% — {the practical angle|the examples} {stood out|stayed with me}.
{Would you|Do you} accept a guest post for %blog% {on a related angle|that builds on it}? {I can|Happy to} send {an outline|two ideas} first, {no strings attached|and you pick}.
{Thanks|Best},
%my_name%`;
const SUBJECT = '{Guest post|Article idea} for %blog%: %topic%';

// 200 rows: 20 topics x 10 name/blog pairs, each with its own hostname.
const TOPICS = ['budgeting while travelling', 'self-hosted note apps', 'sleep', 'balcony composting',
  'slow travel by train', 'home espresso', 'learning to sail', 'static site generators', 'urban beekeeping',
  'minimalist wardrobes', 'trail running for beginners', 'fermenting at home', 'sourdough', 'e-bike commuting',
  'indie game marketing', 'houseplant care', 'bird photography', 'remote team rituals', 'analog film', 'tiny kitchens'];
const PEOPLE = [['Maya', 'Nomad Finance'], ['Daniel', 'TechNotes'], ['Priya', 'Wellness Weekly'], ['Tom', 'Garden Diaries'],
  ['Ines', 'Slow Rails'], ['Kenji', 'Crema Log'], ['Sofia', 'Leeward'], ['Omar', 'Buildlog'], ['Lena', 'Rooftop Hives'], ['Ravi', 'Ten Items']];
const ROWS = TOPICS.flatMap((topic, t) =>
  PEOPLE.map(([name, blog], p) => {
    const host = `${blog.toLowerCase().replace(/\s+/g, '-')}-${t + 1}.example`;
    return { site: `https://${host}/contact`, key: host, name, blog, topic, my_site: 'spintax.site', my_name: 'Dana' };
  }),
);
const N = ROWS.length; // 200

const message = (row, step = 1, ctx = row) => render(`${SUBJECT}\n\n${BODY}`, { context: ctx, seed: `${row.key}:${step}` });

// ── E1. Distinct messages across 200 rows, and the same row twice ────────────
const first = ROWS.map((r) => message(r));
const again = ROWS.map((r) => message(r));
const blanked = ROWS.map((r) => message(r, 1, { ...r, name: 'NAME', blog: 'BLOG', topic: 'TOPIC' }));
const distinct = new Set(blanked).size;
const same = first.every((m, i) => m === again[i]);
const groups = 2 ** 14; // 12 groups of two in the body, 2 in the subject
console.log(`E1  ${N} rows, the bundled template: ${distinct} distinct wordings once the row's values are blanked` +
  ` (${groups} on paper, ${(groups * (1 - Math.exp(-N / groups))).toFixed(0)} predicted); same row rendered twice identical: ${same}`);

// ── E2. The follow-up: step 2 on the same row is a different wording ─────────
const step2 = ROWS.map((r) => message(r, 2));
const changed = first.filter((m, i) => m !== step2[i]).length;
console.log(`E2  step 2 (seed key:2) differs from step 1 on ${changed} of ${N} rows`);

// ── E3. What the review screen catches: rows with an empty variable ─────────
// 12% of a real import arrives without a topic. The engine leaves an unresolved
// %var% in the text, which is what the review screen flags before the first send.
const missing = ROWS.map((r, i) => (i % 8 === 0 ? { ...r, topic: '' } : r));
const leaked = missing.filter((r) => /%topic%|:\s*$|on\s+—/m.test(message(r))).length;
console.log(`E3  with the topic missing on ${missing.filter((r) => r.topic === '').length} rows, ${leaked} rendered messages carry the gap (an unresolved variable or a hole in the sentence)`);

// ── E4. What stays constant: the sender line, and the ask ────────────────────
function words(t) { return t.toLowerCase().replace(/[\p{P}\p{S}]/gu, ' ').replace(/\s+/gu, ' ').trim().split(' '); }
function shingles(ws, w = 5) { const s = new Set(); for (let i = 0; i + w <= ws.length; i++) s.add(ws.slice(i, i + w).join(' ')); return s; }
const docs = blanked.map((t) => shingles(words(t)));
const df = new Map();
for (const d of docs) for (const s of d) df.set(s, (df.get(s) ?? 0) + 1);
const constant = new Set([...df].filter(([, c]) => c >= 0.95 * N).map(([s]) => s));
const share = docs.reduce((a, d) => a + [...d].filter((s) => constant.has(s)).length / d.size, 0) / docs.length;
console.log(`E4  ${(100 * share).toFixed(1)}% of each message is text identical across 95% of the rows; those shingles:`);
for (const s of [...constant].sort()) console.log(`    ${s}`);

// ── E5. Two rows, to read ─────────────────────────────────────────────────────
for (const i of [0, 1]) console.log(`\n--- row ${i + 1}: ${ROWS[i].key} ---\n${first[i]}`);
