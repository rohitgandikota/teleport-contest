#!/usr/bin/env node

// C option rows supply the expected stored selection. Floor recordings check
// that the selection also governs real object ownership after movement.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodeScreen, renderCell } from '../frozen/screen-decode.mjs';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { parseNethackrc } from '../js/options.js';
import { ONAMES } from '../js/objects_data.js';
import { OBJ_INVENT, OBJ_FLOOR } from '../js/const.js';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
let count = 0;
for (const name of ['autopickup-options', 'autopickup-type-filter']) {
    const input = read(`gen-sessions/recipes/${name}.json`);
    const recorded = read(`gen-sessions/generated/${name}.session.json`);
    for (const [i, segment] of input.segments.entries()) {
        await runSegment({ ...segment, storage: new InMemoryStorage() });
        count++;
        if (name === 'autopickup-options') {
            const lines = recorded.segments[i].steps.flatMap(st =>
                decodeScreen(st.screen).map(row => row.map(renderCell).join('')));
            const value = lines.map(line => / - pickup_types\s+\[(.*)\]/.exec(line))
                .filter(Boolean).at(-1)?.[1];
            assert.ok(value, segment.name + ': C displayed the resulting option');
            assert.equal(game.flags.pickup_types, value === 'all' ? '' : value,
                segment.name + ': stored class filter');
            const pickup = lines.map(line => / - autopickup\s+\[(true|false)\]/.exec(line))
                .filter(Boolean).at(-1)?.[1];
            assert.ok(pickup, segment.name + ': C displayed the pickup toggle');
            assert.equal(!!game.flags.autopickup, pickup === 'true',
                'choosing classes must not toggle automatic pickup');
            assert.deepEqual(game.rc.errors, [], 'valid startup config reaches gameplay');
        } else {
            const final = decodeScreen(recorded.segments[i].steps.at(-2).screen)
                .map(row => row.map(renderCell).join(''));
            const expected = [];
            if (final.some(row => / a - a fizzy potion/.test(row)))
                expected.push(ONAMES.POT_SPEED);
            if (final.some(row => / b - a banana/.test(row)))
                expected.push(ONAMES.BANANA);
            assert.ok(expected.length, 'C finished on an inventory display');
            assert.deepEqual(game.invent.map(o => o.otyp).sort((a, b) => a - b),
                expected.sort((a, b) => a - b), segment.name + ': collected object types');
            const excluded = [ONAMES.POT_SPEED, ONAMES.BANANA]
                .filter(t => !expected.includes(t));
            const floor = game.level.objects.filter(o => o.ox === game.u.ux
                && o.oy === game.u.uy && [ONAMES.POT_SPEED, ONAMES.BANANA].includes(o.otyp));
            assert.deepEqual(floor.map(o => o.otyp).sort((a, b) => a - b), excluded,
                segment.name + ': rejected classes stay on the square');
            for (const o of game.invent) assert.equal(o.where, OBJ_INVENT);
            for (const o of floor) assert.equal(o.where, OBJ_FLOOR);
            assert.ok(game.flags.autopickup);
            assert.equal(game.flags.dropped_nopick, false,
                'class controls disable the independent dropped-object override');
        }
    }
}

// The initial parser shares C's class validation with the live prompt.
// Error presentation during startup is a separate, still open lifecycle.
const invalid = parseNethackrc('OPTIONS=pickup_types:!x!?\n');
assert.equal(invalid.opts.pickup_types, '!?');
assert.deepEqual(invalid.errors, ["Unknown pickup_types parameter ''"]);
const leading = parseNethackrc('OPTIONS=pickup_types:  !?$\n');
assert.equal(leading.opts.pickup_types, '!?$');
assert.deepEqual(leading.errors, []);
const tab = parseNethackrc('OPTIONS=pickup_types:\t!?\n');
assert.equal(tab.opts.pickup_types, '!?');
assert.deepEqual(tab.errors, ["Unknown pickup_types parameter ''"]);
const missing = parseNethackrc('OPTIONS=pickup_types\n');
assert.equal(missing.opts.pickup_types, '');
assert.equal(missing.opts.autopickup, true);
assert.deepEqual(missing.errors, ["Missing parameter for 'pickup_types'"]);
console.log(`autopickup options state: PASS (${count} C scenarios plus parser controls)`);
