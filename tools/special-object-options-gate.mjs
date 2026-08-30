#!/usr/bin/env node

// State-level checks for src/sp_lev.c create_object() options which are not
// all visible on the terminal. The lit-object path also has a recorded C
// session in tools/gen-sessions/generated/special-object-options.session.json.

import assert from 'node:assert/strict';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { lspo_object } from '../js/sp_lev.js';
import { ONAMES } from '../js/objects_data.js';
import { BURN_OBJECT } from '../js/timeout.js';

const values = new Map();
const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear(),
    get length() { return values.size; },
    key: (index) => [...values.keys()][index] ?? null,
};

await runSegment({
    seed: 6920,
    datetime: '20000112090000',
    nethackrc: [
        'OPTIONS=name:wizard,role:Valkyrie,race:human,gender:female,align:lawful,playmode:debug',
        'OPTIONS=!autopickup,!tutorial,!tips,pettype:none',
        'OPTIONS=suppress_alert:3.4.3',
        'OPTIONS=symset:DECgraphics',
        '',
    ].join('\n'),
    moves: ' ',
    storage,
    onFrame: () => {},
});

const x = game.u.ux;
const y = game.u.uy;

const locked = lspo_object({
    id: 'chest', x, y, locked: true, trapped: false, greased: true,
});
assert.equal(locked.olocked, 1, 'explicit locked state');
assert.equal(locked.otrapped, 0, 'explicit untrapped state');
assert.equal(locked.greased, 1, 'explicit greased state');

const broken = lspo_object({
    id: 'large box', x, y, broken: true, trapped: false,
});
assert.equal(broken.obroken, 1, 'explicit broken state');
assert.equal(broken.olocked, 0, 'broken container is unlocked');
assert.equal(broken.otrapped, 0, 'broken container is untrapped');

const knownTrap = lspo_object({
    id: 'chest', x, y, trapped: true, trap_known: true,
});
assert.equal(knownTrap.otrapped, 1, 'explicit trapped state');
assert.equal(knownTrap.tknown, 1, 'explicit trap knowledge');

const marker = lspo_object({
    id: 'magic marker', x, y, recharged: 10, greased: true,
});
assert.equal(marker.recharged, 2, 'recharge count is stored modulo eight');
assert.equal(marker.greased, 1, 'tool grease state');

const egg = lspo_object({
    id: 'egg', x, y, montype: 'killer bee', laid_by_you: true,
});
assert.equal(egg.spe, 1, 'laid-by-hero egg state');

const chestsBefore = game.level.objects.filter(
    (obj) => obj.otyp === ONAMES.CHEST,
).length;
lspo_object({ id: 'chest', x, y, quantity: 3 });
const chestsAfter = game.level.objects.filter(
    (obj) => obj.otyp === ONAMES.CHEST,
).length;
assert.equal(chestsAfter - chestsBefore, 3,
             'quantity creates separate nonmergeable objects');

const lamp = lspo_object({ id: 'oil lamp', x, y, lit: true });
assert.equal(lamp.lamplit, 1, 'level-defined lamp is lit');
assert.ok(game.timer_base.some(
    (timer) => timer.func_index === BURN_OBJECT && timer.arg === lamp,
), 'level-defined lamp has a burn timer');
assert.ok(game.light_sources.some(
    (source) => source.type === 1 && source.id === lamp.o_id,
), 'level-defined lamp has a mobile light source');

console.log('special object options: PASS');
