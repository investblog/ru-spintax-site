// Generations for the article on why LLM product descriptions come out the same.
// This file ASKED the models; measure.mjs only reads what it saved, so the
// numbers can be re-checked without a key:
//
//   node generate.mjs            # needs the claude and codex CLIs, signed in
//   node measure.mjs             # needs only @spintax/core and generations.json
//
// Every call is a fresh session: no memory, no tools, no project instructions.
// The Claude calls replace the system prompt with one neutral sentence. Codex
// keeps its own system prompt, which its CLI does not let a caller replace;
// project docs and memories are switched off; the run of 13 September 2026 used
// codex-cli 0.147.0 with reasoning effort xhigh from the local config. Neither CLI
// exposes temperature, so every arm runs at the model's default sampling. The
// `model` field records what the CLI reported; Claude Code 2.1.270 also bills a
// small Haiku call per session, which is why the Sonnet rows list both models.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const OUT = new URL('./generations.json', import.meta.url);
const RUNS = 50;
const CONCURRENCY = 4;

const FACTS =
  'Product: Kestrel 750, an insulated water bottle. Facts: 750 ml; double-wall vacuum stainless steel; ' +
  'keeps drinks cold for 24 hours and hot for 12; leak-proof screw cap with a carry loop; fits most car ' +
  'cup holders; weighs 380 g; the lid is dishwasher-safe; five colours.';
const FORMAT = 'About 80 words, one paragraph, plain text, no heading.';

const PROMPTS = {
  plain: `Write a product description for an online store. ${FACTS} ${FORMAT} Reply with the description only.`,
  original:
    `Write a product description for an online store. ${FACTS} ${FORMAT} Make it original: avoid the ` +
    'openings, phrases and structure a typical product description would use. Reply with the description only.',
  batch:
    `Write 10 product descriptions for an online store, each clearly different from all the others in ` +
    `opening, structure and wording. ${FACTS} Each: ${FORMAT} Separate the descriptions with a line ` +
    'containing only ---. Reply with the descriptions only, no numbering.',
};

// arm -> how to call it. `batch` returns 10 texts per call, so it needs 5 calls.
const ARMS = {
  'claude-haiku-4-5': { cli: 'claude', model: 'haiku', prompt: 'plain', calls: RUNS },
  'claude-sonnet-5': { cli: 'claude', model: 'sonnet', prompt: 'plain', calls: RUNS },
  'gpt-5.6-sol': { cli: 'codex', model: 'gpt-5.6-sol', prompt: 'plain', calls: RUNS },
  'claude-sonnet-5-original': { cli: 'claude', model: 'sonnet', prompt: 'original', calls: RUNS },
  'claude-sonnet-5-batch': { cli: 'claude', model: 'sonnet', prompt: 'batch', calls: RUNS / 10 },
};

const q = (s) => JSON.stringify(s); // double quotes: good for both cmd and sh

function run(cmd, cwd) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, { shell: true, cwd });
    let out = '';
    let err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.stdin.end();
    p.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(`${code}: ${err.slice(-400)}`))));
  });
}

async function call(arm) {
  const { cli, model, prompt } = ARMS[arm];
  const text = PROMPTS[prompt];
  const cwd = mkdtempSync(join(tmpdir(), 'kestrel-'));
  try {
    if (cli === 'claude') {
      const raw = await run(
        `claude -p --model ${model} --system-prompt ${q('You are a helpful assistant.')} --tools "" ` +
          `--strict-mcp-config --setting-sources "" --no-session-persistence --disable-slash-commands ` +
          `--output-format json ${q(text)}`,
        cwd,
      );
      const j = JSON.parse(raw);
      if (j.is_error) throw new Error(j.result);
      return { model: Object.keys(j.modelUsage).join(','), text: j.result.trim() };
    }
    await run(
      `codex exec --skip-git-repo-check --ephemeral --ignore-rules -s read-only -m ${model} ` +
        `-c project_doc_max_bytes=0 -c features.memories=false -o out.txt ${q(text)}`,
      cwd,
    );
    return { model, text: readFileSync(join(cwd, 'out.txt'), 'utf8').trim() };
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

const data = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : { prompts: PROMPTS, calls: {} };
const save = () => writeFileSync(OUT, `${JSON.stringify(data, null, 2)}\n`);

const queue = [];
for (const [arm, { calls }] of Object.entries(ARMS)) {
  for (let i = 1; i <= calls; i++) if (!data.calls[`${arm}#${i}`]) queue.push(`${arm}#${i}`);
}
console.log(`${queue.length} calls to make`);

async function worker() {
  while (queue.length) {
    const key = queue.shift();
    const arm = key.split('#')[0];
    try {
      const r = await call(arm);
      data.calls[key] = { arm, prompt: ARMS[arm].prompt, ...r, at: new Date().toISOString() };
      save();
      console.log(`ok ${key} (${r.text.split(/\s+/).length} words)`);
    } catch (e) {
      console.log(`FAIL ${key}: ${e.message}`);
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
