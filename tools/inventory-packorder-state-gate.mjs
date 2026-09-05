#!/usr/bin/env node

// Read the expected complete order from C's final options page, independently
// of the JS option parser. Paired recordings also check inventory/discoveries.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodeScreen, renderCell } from '../frozen/screen-decode.mjs';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { inv_order } from '../js/invent.js';
import { def_oc_syms } from '../js/drawing_data.js';
import { OCLASSES } from '../js/objects_data.js';
import { parseNethackrc } from '../js/options.js';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
for (const name of ['inventory-packorder', 'inventory-packorder-live']) {
    const recipe = read(`gen-sessions/recipes/${name}.json`);
    const recorded = read(`gen-sessions/generated/${name}.session.json`);
    for (const [i, segment] of recipe.segments.entries()) {
        let expected;
        for (const step of recorded.segments[i].steps)
            for (const row of decodeScreen(step.screen)) {
                const line = row.map(renderCell).join('');
                const match = /packorder\s+\[(.*)\]/.exec(line);
                if (match)
                    expected = match[1];
            }
        assert.ok(expected, segment.name + ': C displayed the stored order');
        await runSegment({ ...segment, storage: new InMemoryStorage() });
        assert.equal(inv_order().map(c => def_oc_syms[c]).join(''), expected,
            segment.name + ': live class order equals the C option value');
        assert.equal(new Set(inv_order()).size, 15, 'exactly one of each allowed class');
        assert.ok(!inv_order().includes(OCLASSES.VENOM_CLASS), 'venom is not packorder');
        assert.ok(game.invent.some(o => o.oclass === OCLASSES.POTION_CLASS));
    }
}

// Source controls for initial parsing. C applies accepted entries even when
// it reports errors. Initial error presentation remains a separate open path.
const parsed = parseNethackrc('OPTIONS=packorder:.x!+!$\n');
assert.deepEqual(parsed.errors, ["Object class '.' not allowed",
    "Not an object class 'x'", "Duplicate object class '!'"]);
assert.equal(parsed.opts.inv_order.map(c => def_oc_syms[c]).join(''),
    '+!$\")[%?=/(*`0_');
const reset = parseNethackrc('OPTIONS=packorder:!+\nOPTIONS=packorder:*\n');
assert.equal(reset.opts.inv_order.map(c => def_oc_syms[c]).join(''),
    '$*!+\")[%?=/(`0_');
console.log('inventory pack order state: PASS (24 C scenarios plus parser controls)');
