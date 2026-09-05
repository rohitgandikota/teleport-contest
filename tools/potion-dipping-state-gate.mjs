#!/usr/bin/env node

// C potion.c:potion_dip and its shared effects. Inventory quantities and
// original prices come from C; field expectations follow its source branches.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodeScreen, renderCell } from '../frozen/screen-decode.mjs';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { ONAMES, OCLASSES } from '../js/objects_data.js';
import { OBJ_INVENT, OBJ_ONBILL, OBJ_FLOOR, BURN_OBJECT } from '../js/const.js';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const rows = step => decodeScreen(step.screen).map(row => row.map(renderCell).join(''));
let count = 0;
for (const suffix of ['water', 'effects', 'shop', 'details', 'fire']) {
    const name = 'potion-dipping-' + suffix;
    const input = read(`gen-sessions/recipes/${name}.json`);
    const oracle = read(`gen-sessions/generated/${name}.session.json`);
    for (const [i, segment] of input.segments.entries()) {
        const frames = oracle.segments[i].steps;
        let chest, contents;
        if (segment.name === 'fire-chest') {
            globalThis.__step_snapshot = {
                step: frames.findLastIndex(frame => frame.key === '#'),
                cb: state => {
                    chest = state.invent.find(o => o.invlet === 'a');
                    assert.equal(chest.otyp, ONAMES.CHEST);
                    contents = [...chest.cobj];
                    assert.ok(contents.length);
                },
            };
        }
        try {
            await runSegment({ ...segment, storage: new InMemoryStorage() });
        } finally {
            delete globalThis.__step_snapshot;
        }
        count++;
        const inventory = game.invent || [];
        const menu = frames.slice(frames.findLastIndex(frame => frame.key === 'i'), -1);
        const expected = [...new Map(menu.flatMap(rows).flatMap(row => {
            const match = /^\s*([a-zA-Z$]) - (.*)/.exec(row);
            return match ? [[match[1], Number(/^(\d+) /.exec(match[2])?.[1] || 1)]] : [];
        })).entries()].sort(([a], [b]) => a.localeCompare(b));
        assert.deepEqual(inventory.map(o => [o.invlet, o.quan])
            .sort(([a], [b]) => a.localeCompare(b)), expected,
        segment.name + ': C inventory quantities');
        assert.equal(new Set(inventory.map(o => o.o_id)).size, inventory.length,
            'split and reinsert must not duplicate an object');
        for (const obj of inventory) {
            assert.equal(obj.where, OBJ_INVENT);
            assert.equal(!!obj.in_use, false, segment.name + ': completed consumption');
        }
        const byLetter = letter => inventory.find(o => o.invlet === letter);
        const target = byLetter('a');
        if (suffix === 'water') {
            const buc = /^(blessed|cursed|uncursed)-water-(blessed|cursed|uncursed)-dagger$/.exec(segment.name);
            if (buc) {
                const [, water, original] = buc;
                const blessed = water === 'blessed' ? original !== 'cursed'
                    : water === 'uncursed' && original === 'blessed';
                const cursed = water === 'cursed' ? original !== 'blessed'
                    : water === 'uncursed' && original === 'cursed';
                assert.deepEqual([!!target.blessed, !!target.cursed], [blessed, cursed]);
                assert.equal(target.oeroded | 0, water === 'uncursed' ? 1 : 0);
                assert.equal(!!target.bknown, water !== 'uncursed' && water !== original);
            }
            if (segment.name === 'plain-scroll') assert.equal(target.otyp, ONAMES.SCR_BLANK_PAPER);
            if (segment.name === 'plain-book') assert.equal(target.otyp, ONAMES.SPE_BLANK_PAPER);
            if (segment.name === 'plain-potion') assert.equal(target.odiluted, 1);
            if (segment.name === 'plain-diluted-potion') {
                assert.equal(target.otyp, ONAMES.POT_WATER);
                assert.equal(target.odiluted, 0);
            }
            if (segment.name === 'plain-towel') assert.ok(target.spe > 0);
            if (segment.name.startsWith('blindfold-')) {
                assert.equal(game.u.ublindf, target);
                assert.ok(target.blessed);
                assert.equal(!!target.bknown, segment.name === 'blindfold-only');
            }
        } else if (suffix === 'effects') {
            if (segment.name === 'poly-weapon') {
                assert.equal(target.otyp, ONAMES.SLING);
                assert.equal(game.u.uconduct.polypiles, 1);
            }
            if (segment.name.startsWith('poison-')) assert.ok(target.opoisoned);
            if (segment.name.startsWith('remove-poison')) assert.equal(!!target.opoisoned, false);
            if (segment.name === 'corrode-dagger') assert.equal(target.oeroded2, 1);
            if (['oil-rust', 'oil-corrode', 'oil-both'].includes(segment.name))
                assert.deepEqual([target.oeroded | 0, target.oeroded2 | 0], [0, 0]);
            if (segment.name === 'oil-ammo') assert.equal(target.oeroded, 1);
            if (segment.name === 'oil-cursed') assert.ok(game.u.intrinsic.HGlib > 0);
            if (/^(horn-(sickness|blindness|hallucination|confusion|stack)|amethyst-booze|cursed-horn)$/.test(segment.name)) {
                const cured = byLetter(segment.name === 'horn-stack' ? 'c' : 'b');
                const juice = ['horn-sickness', 'amethyst-booze', 'cursed-horn'].includes(segment.name);
                assert.equal(cured.otyp, juice ? ONAMES.POT_FRUIT_JUICE : ONAMES.POT_WATER);
                assert.equal(!!cured.cursed, segment.name === 'cursed-horn');
                assert.equal(!!cured.bknown, false);
                assert.equal(!!cured.dknown, true);
            }
        } else if (suffix === 'shop') {
            const shkp = game.level.monsters.find(m => m.isshk), bill = shkp.eshk.bill_p;
            const quote = frames.flatMap(rows).map(row =>
                /o - .*\(unpaid, (\d+) zorkmids\)/.exec(row)).find(Boolean);
            assert.ok(quote, 'C quoted the original purchase price');
            assert.equal(bill.length, 1);
            assert.equal(bill[0].price, Number(quote[1]));
            assert.equal(bill[0].bquan, 1);
            const obj = byLetter('o'), altered = ['unbless-water', 'uncurse-water'].includes(segment.name);
            assert.equal(!!obj.unpaid, !altered);
            assert.equal(!!bill[0].useup, altered);
            assert.equal((game.billobjs || []).length, Number(altered));
            if (altered) {
                const copy = game.billobjs[0];
                assert.equal(copy.where, OBJ_ONBILL);
                assert.equal(copy.o_id, bill[0].bo_id);
                assert.notEqual(copy.o_id, obj.o_id);
                assert.ok(copy.bknown);
                assert.equal(!!copy.blessed, segment.name === 'unbless-water');
                assert.equal(!!copy.cursed, segment.name === 'uncurse-water');
                assert.deepEqual([!!obj.blessed, !!obj.cursed, !!obj.bknown], [false, false, true]);
            } else {
                assert.equal(bill[0].bo_id, obj.o_id);
            }
        } else if (suffix === 'details') {
            if (segment.name === 'hallucinated-blessing') {
                assert.ok(byLetter('b').blessed);
                assert.equal(!!byLetter('b').bknown, false);
            }
            if (segment.name === 'blind-purification') {
                assert.equal(byLetter('b').otyp, ONAMES.POT_WATER);
                assert.equal(!!byLetter('b').dknown, false);
            }
            const countBefore = { 'alchemy-magic-stack': 8,
                'alchemy-diluted-stack': 4, 'alchemy-plain-stack': 10 }[segment.name];
            if (countBefore) assert.equal(inventory.filter(o => o.oclass === OCLASSES.POTION_CLASS)
                .reduce((n, o) => n + o.quan, 0), countBefore);
        } else if (suffix === 'fire') {
            if (segment.name.startsWith('spent-magic')) {
                assert.equal(target.otyp, ONAMES.OIL_LAMP);
                assert.equal(target.spe, 1);
                assert.equal(target.age, segment.name.endsWith('diluted') ? 600 : 800);
            }
            if (segment.name === 'fire-worn-cloak') {
                assert.equal(game.u.uarmc, target);
                assert.equal(target.oeroded, 1);
            }
            if (segment.name === 'fire-chest') {
                assert.ok(!game.level.objects.includes(chest));
                for (const obj of contents) {
                    assert.ok(game.level.objects.includes(obj));
                    assert.equal(obj.where, OBJ_FLOOR);
                    assert.equal(obj.ocontainer, null);
                    assert.deepEqual([obj.ox, obj.oy], [game.u.ux, game.u.uy]);
                }
            }
            if (segment.name === 'permanent-poison') assert.ok(target.opoisoned);
        }
        for (const obj of inventory.filter(o => o.lamplit)) {
            assert.ok(game.light_sources.some(source => source.id === obj.o_id));
            assert.ok(game.timer_base.some(timer => timer.func_index === BURN_OBJECT && timer.arg === obj));
        }
    }
}
console.log(`potion dipping state: PASS (${count} C scenarios)`);
