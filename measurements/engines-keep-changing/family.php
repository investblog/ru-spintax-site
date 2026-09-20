<?php
// The test card through the PHP engine: composer require spintax/core:0.10.0 (the version this
// article's table reports; drop the pin to score whatever is current), then php family.php
// Prints one line per case: its id and the share of renders that come out right (as measure.mjs scores it).
// The PHP engine takes no seed — the random picks are seeded here with mt_srand, which is why a
// shape (not an exact string) is what a random case is scored against, as in measure.mjs.
require __DIR__ . '/vendor/autoload.php';

use Spintax\Core\Render\Pipeline;

const SEEDS = 100;

// A permutation shuffles distinct elements, which no regex alternation can say.
function distinct(string $out): bool
{
    $items = preg_split('/,\s*|\s+and\s+/u', rtrim(preg_replace('/^[^:]*:\s*/u', '', $out), '.'));
    return count(array_unique($items)) === count($items);
}
$card = json_decode(file_get_contents(__DIR__ . '/card.json'), true)['cases'];
foreach (json_decode(file_get_contents(__DIR__ . '/vendor/composer/installed.json'), true)['packages'] as $p) {
    if ($p['name'] === 'spintax/core') echo "spintax/core {$p['version']}\n";
}
$pipeline = new Pipeline();
foreach ($card as $c) {
    $ctx = $c['context'] ?? [];
    $render = function (int $seed) use ($pipeline, $c, $ctx): string {
        mt_srand($seed);
        return $pipeline->render($c['src'], $ctx);
    };
    if (array_key_exists('expect', $c)) {
        $score = $render(1) === $c['expect'] ? 1.0 : 0.0;
    } else {
        $shape = '/' . str_replace('/', '\/', $c['shape']) . '/u';
        $ok = 0;
        for ($seed = 1; $seed <= SEEDS; $seed++) {
            $out = $render($seed);
            $ok += (preg_match($shape, $out) && distinct($out)) ? 1 : 0;
        }
        $score = $ok / SEEDS;
    }
    printf("%-26s%.2f  %s\n", $c['id'], $score, json_encode($render(1), JSON_UNESCAPED_UNICODE));
}
