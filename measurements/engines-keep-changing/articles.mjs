// This site's four published measurements, re-run on every version measure.mjs installs, with
// every rendered text compared byte for byte against 0.6.1 (the version they were published on).
// Needs the four folders next to this one, as they are served under /measurements/:
//   scaled-content-abuse/measure.mjs, spintax-in-cold-email/measure.mjs,
//   manual-outreach/measure.mjs, llm-outputs-converge/measure.mjs + generations.json
// and the aliases from measure.mjs installed in this folder. Then: node articles.mjs
import { spawnSync } from 'node:child_process';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VERSIONS } from './versions.mjs';
import { flags } from './detectors.mjs';

const ARTICLES = ['scaled-content-abuse', 'spintax-in-cold-email', 'manual-outreach', 'llm-outputs-converge'];
const here = fileURLToPath(new URL('.', import.meta.url));
const swap = new URL('./swap.mjs', import.meta.url).href;
const tmp = mkdtempSync(join(tmpdir(), 'engines-'));

const texts = {}; // texts[article][version] = every rendered text, in order
for (const a of ARTICLES) {
  for (const v of VERSIONS) {
    const log = join(tmp, `${a}.${v}.json`);
    const run = spawnSync(process.execPath, ['--import', swap, 'measure.mjs'], {
      cwd: join(here, '..', a), env: { ...process.env, CORE: v, LOG: log }, stdio: ['ignore', 'ignore', 'pipe'],
    });
    if (run.status !== 0) throw new Error(`${a} on ${v}: exit ${run.status}\n${run.stderr}`);
    (texts[a] ??= {})[v] = JSON.parse(readFileSync(log, 'utf8'));
  }
}

console.log('Rendered texts that differ from 0.6.1, per version');
let total = 0;
for (const a of ARTICLES) {
  const base = texts[a]['0.6.1'];
  total += base.length;
  const row = VERSIONS.map((v) => {
    const t = texts[a][v];
    return t.length !== base.length ? `${v}:length ${t.length}` : `${v}:${t.filter((x, i) => x !== base[i]).length}`;
  });
  console.log(`  ${a} (${base.length} texts, ${new Set(base).size} distinct)\n    ${row.join(' ')}`);
}
console.log(`  total: ${total} texts per version`);

// The detectors on the same texts, as rendered by 0.10.0: every flagged text is printed,
// so a count is never quoted without the texts behind it.
console.log('\nDetectors on the distinct texts, 0.10.0');
for (const a of ARTICLES) {
  const distinct = [...new Set(texts[a]['0.10.0'])];
  const hits = distinct.map((t) => [t, flags(t)]).filter(([, f]) => f.length);
  console.log(`  ${a}: ${hits.length} of ${distinct.length} flagged`);
  for (const [t, f] of hits) console.log(`    [${f.join(', ')}] ${JSON.stringify(t.length > 160 ? t.slice(0, 160) + '…' : t)}`);
}
