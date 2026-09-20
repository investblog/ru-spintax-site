// Loaded with `node --import ./swap.mjs`: every `import … from '@spintax/core'` gets the version
// named in $CORE (an alias installed next to this file), and every rendered text is written to $LOG.
import { register } from 'node:module';
import { isMainThread } from 'node:worker_threads';

if (isMainThread) register(import.meta.url, import.meta.url);

const WRAPPER = new URL('./swap.mjs?core', import.meta.url).href;

export async function resolve(specifier, context, next) {
  if (specifier === '@spintax/core') return { url: WRAPPER, shortCircuit: true };
  return next(specifier, context);
}

export async function load(url, context, next) {
  if (url !== WRAPPER) return next(url, context);
  const source = `
    import { writeFileSync } from 'node:fs';
    const engine = await import('c' + process.env.CORE.replaceAll('.', ''));
    const log = [];
    export const render = (...args) => { const out = engine.render(...args); log.push(out); return out; };
    process.on('exit', () => writeFileSync(process.env.LOG, JSON.stringify(log)));
  `;
  return { format: 'module', source, shortCircuit: true };
}
