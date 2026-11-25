// C weapon_descr prerequisite and its public status consumer. Real object producers.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setup, seed } from './status-followup-test-setup.mjs';
import { game } from '../js/gstate.js';
import { mksobj } from '../js/mkobj.js';
import { addinv } from '../js/invent.js';
import { ready_weapon } from '../js/wield.js';
import { weapon_descr } from '../js/weapon.js';
import { enlightenment, BASICENLIGHTENMENT } from '../js/insight.js';
import { getRngLog } from '../js/rng.js';
import { ONAMES } from '../js/objects_data.js';

for (const type of [ONAMES.GLOB_OF_GRAY_OOZE, ONAMES.GLOB_OF_BROWN_PUDDING,
    ONAMES.GLOB_OF_GREEN_SLIME, ONAMES.GLOB_OF_BLACK_PUDDING]) {
    test(`real glob ${type} names the material form and keeps its wielded owner`, async () => {
        await setup();
        const glob = await addinv(mksobj(type, true, false));
        assert.equal(!!glob.globby, true);
        await ready_weapon(glob);
        seed();
        assert.equal(weapon_descr(glob), 'glob');
        const lines = enlightenment(BASICENLIGHTENMENT, 0);
        assert.ok(lines.includes(' You are wielding a glob.'));
        assert.ok(!lines.includes(' You are wielding some food.'));
        assert.equal(game.u.uwep, glob);
        assert.equal(game.invent.includes(glob), true);
        assert.deepEqual(getRngLog(), []);
    });
}

for (const [type, expected] of [
    [ONAMES.FOOD_RATION, 'food'], [ONAMES.CORPSE, 'corpse'],
    [ONAMES.TIN, 'tin'], [ONAMES.EGG, 'egg'], [ONAMES.STATUE, 'statue'],
    [ONAMES.BOULDER, 'boulder'], [ONAMES.TOWEL, 'towel'],
    [ONAMES.TIN_OPENER, 'tin opener'], [ONAMES.SHIELD_OF_REFLECTION, 'armor'],
    [ONAMES.ROCK, 'stone'], [ONAMES.LUCKSTONE, 'stone'],
    [ONAMES.DIAMOND, 'gem'], [ONAMES.ARROW, 'arrow'],
    [ONAMES.CROSSBOW_BOLT, 'bolt'], [ONAMES.GRAPPLING_HOOK, 'hook'],
    [ONAMES.DWARVISH_MATTOCK, 'mattock'], [ONAMES.DAGGER, 'dagger'],
]) {
    test(`retained real item ${type} still describes ${expected}`, async () => {
        await setup();
        const obj = mksobj(type, false, false);
        seed();
        assert.equal(!!obj.globby, false);
        assert.equal(weapon_descr(obj), expected);
        assert.deepEqual(getRngLog(), []);
    });
}
