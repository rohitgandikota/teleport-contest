#!/usr/bin/env node
// An ordinary command reaches C's retry after scuffing only a space.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { ONAMES } from '../js/objects_data.js';

const path = process.argv[2] || new URL(
    'gen-sessions/generated/object-naming-scuff-retry.session.json', import.meta.url);
const fixture = JSON.parse(readFileSync(path));
assert.equal(fixture.segments.length, 1);
const segment = fixture.segments[0];
const nativePicks = segment.steps.flatMap(step => step.rng || [])
    .filter(call => call.includes('@ wipeout_text(engrave.c:134)'));
assert.deepEqual(nativePicks, [
    'rn2(11)=6 @ wipeout_text(engrave.c:134)',
    'rn2(11)=7 @ wipeout_text(engrave.c:134)',
    'rn2(11)=6 @ wipeout_text(engrave.c:134)',
]); // One wipeout can pick at most two positions. The first is a space.

const hooks = ['__rng_log_disp', '__rng_trace_sites'];
const previous = hooks.map(key => Object.getOwnPropertyDescriptor(globalThis, key));
let run;
try {
    globalThis.__rng_log_disp = true;
    globalThis.__rng_trace_sites = true;
    run = await runSegment({...segment, storage: new InMemoryStorage()});
} finally {
    for (const [i, key] of hooks.entries()) {
        if (previous[i]) Object.defineProperty(globalThis, key, previous[i]);
        else delete globalThis[key];
    }
}
assert.deepEqual(hooks.map(key => Object.getOwnPropertyDescriptor(globalThis, key)), previous);
const draws = run.getRngLog()
    .filter(call => call.startsWith('~drn2(2)=') && call.includes('@js/do_name.js:'))
    .map(call => call.split(' @')[0]);
assert.deepEqual(draws, ['~drn2(2)=0', '~drn2(2)=1'], 'retry draws a fresh scuff count');
assert.equal(game.invent.length, 1);
const obj = game.invent[0];
assert.equal(obj.otyp, ONAMES.CRYSTAL_BALL);
assert.equal(obj.quan, 1);
assert.equal(obj.oartifact || 0, 0);
assert.equal(obj.oname, 'The Orb of |ate');
assert.equal(game.u.uconduct.literate, 1);
assert.equal(run.getScreens().length, segment.steps.length);
console.log('Native space-scuff retry, two display counts and final object state match.');
