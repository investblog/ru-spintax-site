// The test card (card.json) through every published @spintax/core from 0.3.0 to 0.10.0.
// Every version is installed side by side under an npm alias (c030 … c0100):
//
//   npm init -y && npm pkg set type=module
//   npm i c030@npm:@spintax/core@0.3.0 c031@npm:@spintax/core@0.3.1 c032@npm:@spintax/core@0.3.2 \
//     c033@npm:@spintax/core@0.3.3 c034@npm:@spintax/core@0.3.4 c040@npm:@spintax/core@0.4.0 \
//     c050@npm:@spintax/core@0.5.0 c051@npm:@spintax/core@0.5.1 c052@npm:@spintax/core@0.5.2 \
//     c053@npm:@spintax/core@0.5.3 c060@npm:@spintax/core@0.6.0 c061@npm:@spintax/core@0.6.1 \
//     c070@npm:@spintax/core@0.7.0 c080@npm:@spintax/core@0.8.0 c090@npm:@spintax/core@0.9.0 \
//     c0100@npm:@spintax/core@0.10.0
//   node measure.mjs
//
// 0.3.0 is the floor: there #set became a macro and #def took roll-once, so older versions
// read the same template differently.
import { readFileSync } from 'node:fs';
import { flags } from './detectors.mjs';
import { VERSIONS } from './versions.mjs';

const SEEDS = 100; // for cases whose pick is random

const card = JSON.parse(readFileSync(new URL('./card.json', import.meta.url), 'utf8')).cases;
const engines = {};
for (const v of VERSIONS) engines[v] = await import('c' + v.replaceAll('.', ''));

// Share of renders that come out right: 1 or 0 for a fixed input, k/100 for a random pick.
// A permutation shuffles distinct elements, and a regex alternation cannot say "each once",
// so a repeated element is checked apart from the shape.
const distinct = (out) => {
  const items = out.replace(/^[^:]*:\s*/, '').replace(/\.$/, '').split(/,\s*|\s+and\s+/);
  return new Set(items).size === items.length;
};

function score(render, c) {
  if (c.expect !== undefined) return render(c.src, { context: c.context ?? {}, seed: 1 }) === c.expect ? 1 : 0;
  const shape = new RegExp(c.shape, 'u');
  let ok = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    const out = render(c.src, { context: c.context ?? {}, seed });
    if (shape.test(out) && distinct(out)) ok++;
  }
  return ok / SEEDS;
}
const show = (render, c) => JSON.stringify(render(c.src, { context: c.context ?? {}, seed: 1 }));

console.log('Where each case changes (seed 1 shown; score = share of renders right)\n');
const scores = {};
for (const c of card) {
  console.log(`${c.id}${c.control ? '  [control]' : ''}${c.cost ? '  [cost]' : ''}   fixedIn ${c.fixedIn ?? '-'}`);
  let prev;
  for (const v of VERSIONS) {
    const s = score(engines[v].render, c);
    (scores[v] ??= {})[c.id] = s;
    const line = `${s.toFixed(2)}  ${show(engines[v].render, c)}`;
    if (line !== prev) console.log(`  ${v.padEnd(7)}${line}`);
    prev = line;
  }
}

const defects = card.filter((c) => !c.control && !c.cost);
console.log(`\nPer version: cases right, of ${defects.length} defect shapes (a random case counts if all ${SEEDS} seeds are right)`);
for (const v of VERSIONS) {
  const right = defects.filter((c) => scores[v][c.id] === 1).length;
  const controls = card.filter((c) => c.control).every((c) => scores[v][c.id] === 1);
  const cost = card.filter((c) => c.cost).map((c) => (scores[v][c.id] === 1 ? 'kept' : 'split')).join(' ');
  console.log(`  ${v.padEnd(7)}${String(right).padStart(2)} / ${defects.length}   controls ${controls ? 'ok' : 'BROKEN'}   Yandex.Money ${cost}`);
}

// The detectors on the same card: what they flag in 0.6.1 (the version this site's other
// measurements pin) and in 0.10.0, over every seed a case is scored on.
console.log('\nDetectors (detectors.mjs): flagged renders, 0.6.1 -> 0.10.0');
for (const c of card) {
  const seeds = c.expect !== undefined ? [1] : Array.from({ length: SEEDS }, (_, i) => i + 1);
  const count = (v) => {
    const hit = {};
    for (const seed of seeds) for (const f of flags(engines[v].render(c.src, { context: c.context ?? {}, seed }))) hit[f] = (hit[f] ?? 0) + 1;
    return Object.entries(hit).map(([f, n]) => `${f} ${n}/${seeds.length}`).join(', ') || '-';
  };
  console.log(`  ${c.id.padEnd(26)}${count('0.6.1').padEnd(40)} -> ${count('0.10.0')}`);
}

// Why a preview misses it: a defect in a share p of renders is seen in n previews with 1-(1-p)^n.
// Two rows are the host's own counts: 30 of 15 132 replayed renders changed by 0.8.0's character
// classes (spintax-js#81), 369 of 8 891 stored cells with the glued-sentence shape (spintax-js#79).
console.log('\nA defect in a share p of texts: chance a preview of n texts shows it at least once, and how many a run of 10 000 carries');
const rows = [['1 in 1 000', 0.001], ['30 of 15 132 (#81)', 30 / 15132], ['1 in 100', 0.01],
  ['369 of 8 891 (#79)', 369 / 8891], ['1 in 10', 0.1]];
for (const [label, p] of rows) {
  const seen = (n) => `${(100 * (1 - (1 - p) ** n)).toFixed(1)}%`.padStart(6);
  console.log(`  ${label.padEnd(20)} n=5 ${seen(5)}  n=10 ${seen(10)}  n=50 ${seen(50)}   in 10 000: ${Math.round(p * 10000)}`);
}
