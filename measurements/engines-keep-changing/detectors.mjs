// Patterns to grep your own rendered output for. Each one is tried in measure.mjs
// on the old and the new engine and in articles.mjs on 14 252 texts, with every flagged text printed.
export const DETECTORS = [
  ['glued sentence', /\p{Ll}\.\p{Lu}\p{Ll}/u],
  ['split abbreviation', /(?<!\p{L})[тТ]\. [ДПЕК]\./u],
  ['split domain', /\p{L}\. (?:рф|рус|com|net|org|中国)(?!\p{L})/iu],
  ['space before a closer', /[.,;:!?…] ["'»”’)\]](?=$|[\s.,;:!?…)\]])/u],
  ['raw pipe', /\|/u],
  ['list left by an empty item', /[:(]\s*,|,\s*,|\s(?:and|и)\s*[.!?]/u],
  ['double space', /[  ]{2,}/u],
];

export const flags = (text) => DETECTORS.filter(([, re]) => re.test(text)).map(([name]) => name);
