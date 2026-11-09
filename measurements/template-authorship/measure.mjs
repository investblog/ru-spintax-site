// Measurements for the article on text watermarks and spintax templates.
// Run with @spintax/core installed and template.txt next to this file:
//
//   npm install @spintax/core@0.14.0
//   node measure.mjs
//
// template.txt is the English template from https://spintax.net/examples/ (the
// "About Spintax" copy, reverse authored), copied on 5 November 2026.
// Two questions, both about the template, none about any watermark:
//   1. How much of the template is markup, and how much is words someone wrote?
//   2. Does the engine put any word into a render that is not in the template?
import { readFileSync } from 'node:fs';
import { render } from '@spintax/core';

const template = readFileSync(new URL('./template.txt', import.meta.url), 'utf8');
const body = template.replace(/<\/?p>/g, ''); // HTML paragraph tags are neither markup nor prose

// Spintax markup: directives, variable names, option blocks of permutations,
// conditional and plural heads, and the structural characters.
const MARKUP = /#set|#def|%[A-Za-z]+%|<[a-z]+=[^>]*>|\{\?[a-z]+\?|\{plural %[A-Za-z]+%:|[{}|\[\]=]/g;
const nonSpace = (s) => s.replace(/\s/g, '').length;
const markupChars = nonSpace((body.match(MARKUP) || []).join(''));
const prose = body.replace(MARKUP, ' ');
const proseChars = nonSpace(prose);
const WORD = /[A-Za-z][A-Za-z'’.-]*[A-Za-z]|[A-Za-z]/g;
const words = (s) => (s.match(WORD) || []).map((w) => w.toLowerCase());
// Separators like lastsep=", or " are markup, but the author wrote their words too.
const sepWords = [...body.matchAll(/sep="([^"]*)"/g)].flatMap((m) => words(m[1]));
const templateWords = new Set([...words(prose), ...sepWords]);

console.log('template, non-space characters:', nonSpace(body));
console.log('  markup:', markupChars, ' prose:', proseChars,
  ` prose share: ${(proseChars / nonSpace(body)).toFixed(3)}`);
console.log('  words in prose (all options):', words(prose).length, ' distinct:', templateWords.size);

// The variables are spintax constructs, so the words inside #set lines count as
// template words above. Every render is checked word by word against that set.
const SEEDS = 1000;
let wordsSeen = 0;
const foreign = new Map();
const distinct = new Set();
for (let seed = 1; seed <= SEEDS; seed++) {
  const out = render(template, { seed }).replace(/<\/?p>/g, '');
  distinct.add(out);
  for (const w of words(out)) {
    wordsSeen++;
    if (!templateWords.has(w)) foreign.set(w, (foreign.get(w) ?? 0) + 1);
  }
}
console.log(`renders: ${SEEDS}, distinct texts: ${distinct.size}, words rendered: ${wordsSeen}`);
console.log('words in renders that are not in the template:', foreign.size === 0 ? 'none' : Object.fromEntries(foreign));
