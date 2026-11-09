// A synthetic catalogue of 100 water bottles: five product lines, four capacities, five lids.
// Nothing here is a real product. The rules are written out so every fact a description is
// checked against can be traced to one line below.
export const LINES = [
  { line: 'Kestrel', material: 'double-wall vacuum stainless steel', insulated: true, cold: 24, hot: 12, gPerMl: 0.42,
    copy: 'The Kestrel is a double-wall vacuum stainless steel water bottle that keeps drinks cold for 24 hours and hot for 12. Built for the commute and the trail, it comes in a range of sizes and lids.' },
  { line: 'Heron', material: 'double-wall vacuum stainless steel', insulated: true, cold: 18, hot: 8, gPerMl: 0.38,
    copy: 'The Heron is a slim double-wall vacuum stainless steel bottle that keeps drinks cold for 18 hours and hot for 8. A light everyday bottle, available in several sizes and lids.' },
  { line: 'Plover', material: 'borosilicate glass with a silicone sleeve', insulated: false, gPerMl: 0.55,
    copy: 'The Plover is a water bottle in borosilicate glass with a silicone sleeve. Glass keeps the taste clean, and the sleeve protects it from knocks. Available in several sizes and lids.' },
  { line: 'Tern', material: 'BPA-free Tritan plastic', insulated: false, gPerMl: 0.16,
    copy: 'The Tern is a BPA-free Tritan plastic water bottle, light and hard to break. A good first bottle for school and the gym, available in several sizes and lids.' },
  { line: 'Swift', material: 'single-wall aluminium', insulated: false, gPerMl: 0.2,
    copy: 'The Swift is a single-wall aluminium water bottle, light enough for a running belt. Available in several sizes and lids.' },
];
export const CAPACITIES = [350, 500, 750, 1000];
export const LIDS = [
  { lid: 'screw', leakproof: true, dishwasher: true, g: 30 },
  { lid: 'sport', leakproof: true, dishwasher: true, g: 25 },
  { lid: 'straw', leakproof: false, dishwasher: false, g: 35 },
  { lid: 'flip', leakproof: true, dishwasher: false, g: 40 },
  { lid: 'chug', leakproof: true, dishwasher: true, g: 28 },
];

export const CATALOGUE = [];
for (const L of LINES)
  for (const capacity of CAPACITIES)
    for (const D of LIDS) {
      const i = CATALOGUE.length;
      CATALOGUE.push({
        sku: `${L.line.slice(0, 3).toUpperCase()}-${capacity}-${D.lid.toUpperCase()}`,
        name: `${L.line} ${capacity} ${D.lid[0].toUpperCase()}${D.lid.slice(1)}`,
        line: L.line,
        capacity,
        material: L.material,
        insulated: L.insulated,
        cold: L.cold ?? null,
        hot: L.hot ?? null,
        lid: D.lid,
        leakproof: D.leakproof,
        dishwasher: D.dishwasher,
        weight: Math.round(L.gPerMl * capacity + D.g),
        colours: (i % 6) + 1,
        cupholder: capacity <= 750,
        copy: L.copy,
      });
    }
