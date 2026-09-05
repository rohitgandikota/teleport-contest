#!/usr/bin/env node

// C recordings supply the inventory, billing and breakage outcomes. These
// checks also pin object ownership and origin fields which screens omit.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodeScreen, renderCell } from '../frozen/screen-decode.mjs';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { ONAMES } from '../js/objects_data.js';
import { OBJ_INVENT, OBJ_FLOOR, LOST_THROWN, LOST_DROPPED,
         LOST_STOLEN, LOST_EXPLODING } from '../js/const.js';
import { autopick_testobj } from '../js/pickup.js';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const rows = step => decodeScreen(step.screen).map(row => row.map(renderCell).join(''));
const floorHere = () => game.level.objects.filter(o =>
    o.ox === game.u.ux && o.oy === game.u.uy);
let count = 0;
for (const name of ['autopickup-origin', 'autopickup-shop-stock', 'floor-throw-impact']) {
    const input = read(`gen-sessions/recipes/${name}.json`);
    const oracle = read(`gen-sessions/generated/${name}.session.json`);
    for (const [i, segment] of input.segments.entries()) {
        await runSegment({ ...segment, storage: new InMemoryStorage() });
        count++;
        const final = rows(oracle.segments[i].steps.at(-2));
        const floor = floorHere();
        const inventory = game.invent || [];
        for (const o of inventory) assert.equal(o.where, OBJ_INVENT);
        for (const o of floor) assert.equal(o.where, OBJ_FLOOR);
        if (name === 'autopickup-origin') {
            const carried = final.some(r => r.includes('a - a dagger'));
            const ready = final.some(r => r.includes('(at the ready)'));
            assert.equal(inventory.length, Number(carried), segment.name);
            assert.equal(floor.length, Number(!carried), segment.name);
            const dagger = [...inventory, ...floor][0];
            assert.equal(dagger.otyp, ONAMES.DAGGER);
            assert.equal(dagger.how_lost, carried ? 0
                : segment.name.startsWith('dropped') ? LOST_DROPPED : LOST_THROWN);
            assert.equal(game.u.uquiver || null, ready ? dagger : null);
            assert.equal(!!dagger.no_charge, false);
        } else if (name === 'autopickup-shop-stock') {
            const shkp = game.level.monsters.find(m => m.isshk);
            assert.ok(shkp);
            const bill = shkp.eshk.bill_p;
            const billed = final.map(r => /o - .*\(unpaid, (\d+) zorkmids\)/.exec(r))
                .find(Boolean);
            const own = final.some(r => r.includes('o - a dagger'));
            assert.equal(inventory.length, 14 + Number(!!billed || own));
            assert.equal(bill.length, Number(!!billed));
            assert.equal(shkp.eshk.billct, bill.length);
            if (billed) {
                const obj = inventory.find(o => o.invlet === 'o');
                assert.ok(obj.unpaid);
                assert.deepEqual(bill.map(b => [b.bo_id, b.bquan, b.price, !!b.useup]),
                    [[obj.o_id, 1, Number(billed[1]), false]]);
                assert.equal(floor.length, 0);
            } else if (segment.name.startsWith('own-')) {
                const dagger = [...inventory, ...floor].find(o => o.otyp === ONAMES.DAGGER);
                assert.ok(dagger);
                assert.equal(dagger.where, own ? OBJ_INVENT : OBJ_FLOOR);
                assert.equal(!!dagger.unpaid, false);
                assert.equal(!!dagger.no_charge, !own);
                assert.equal(dagger.how_lost, own ? 0 : LOST_DROPPED);
                assert.ok(floor.some(o => o.otyp === ONAMES.PICK_AXE));
            } else {
                assert.equal(floor.length, 1, 'unbought amulet stays in the shop');
                assert.equal(!!floor[0].no_charge, false);
                // Source controls: shop cost is checked before origin overrides.
                const flags = { ...game.flags };
                game.flags.pickup_types = '!';
                game.flags.pickup_thrown = game.flags.pickup_stolen = true;
                for (const origin of [LOST_THROWN, LOST_STOLEN]) {
                    const obj = { ...floor[0], how_lost: origin };
                    assert.equal(autopick_testobj(obj, true), false);
                    obj.no_charge = 1;
                    assert.equal(autopick_testobj(obj, true), true);
                }
                game.flags.pickup_stolen = false;
                assert.equal(autopick_testobj({ ...floor[0], no_charge: 1,
                    how_lost: LOST_STOLEN }, true), false);
                game.flags.pickup_types = '';
                assert.equal(autopick_testobj({ ...floor[0], no_charge: 1,
                    how_lost: LOST_EXPLODING }, true), false);
                Object.assign(game.flags, flags);
            }
        } else {
            assert.equal(inventory.length, 0);
            const cText = oracle.segments[i].steps.flatMap(rows).join('\n');
            const broken = /shatters into a thousand pieces|Splat!/.test(cText);
            assert.equal(floor.length, Number(!broken), segment.name);
            if (!broken) {
                assert.equal(floor[0].how_lost, LOST_THROWN);
                if (segment.name.startsWith('altar-')) {
                    assert.equal(!!floor[0].bknown, true);
                    assert.equal(!!floor[0].blessed, segment.name === 'altar-blessed');
                    assert.equal(!!floor[0].cursed, segment.name === 'altar-cursed');
                }
            }
            // src/dothrow.c:2494, a hero-broken mirror costs two luck points.
            assert.equal(game.u.uluck, segment.name === 'mirror-floor' ? -2 : 0);
        }
    }
}
console.log(`pickup and floor impact state: PASS (${count} C scenarios plus origin controls)`);
