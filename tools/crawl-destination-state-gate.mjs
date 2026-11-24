// Source-derived controls for hack.c:4079 and its pool-crawl caller.
// Ordinary-input evidence is separate. No production exports or mocks.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setup, seed, form, clearMessages, messages, x, y}
    from './status-followup-test-setup.mjs';
import {game} from '../js/gstate.js';
import {crawl_destination} from '../js/hack.js';
import {rnd_nextto_goodpos} from '../js/trap.js';
import {Amulet_off, accessory_or_armor_on} from '../js/do_wear.js';
import {addinv} from '../js/invent.js';
import {mksobj} from '../js/mkobj.js';
import {polymon} from '../js/polyself.js';
import {set_levltyp} from '../js/mkmaze.js';
import {near_capacity} from '../js/attrib.js';
import {Flying, Passes_walls, Swimming, Amphibious, Breathless, Wwalking}
    from '../js/youprop.js';
import {getRngLog, rn2} from '../js/rng.js';
import {ONAMES} from '../js/objects_data.js';
import {PMNAMES} from '../js/monst_data.js';
import {xdir, ydir, N_DIRS, ROOM, POOL, STONE, FROMOUTSIDE, OBJ_FLOOR,
    W_AMUL, UNENCUMBERED, SLT_ENCUMBER} from '../js/const.js';

// C trap.c:4954-4961 draws all eight shuffles before testing any square.
function shuffledDirections() {
    const dirs = Array.from({length:N_DIRS}, (_, i) => i);
    for (let i = N_DIRS; i > 0; --i) {
        const j = rn2(i);
        [dirs[j], dirs[i - 1]] = [dirs[i - 1], dirs[j]];
    }
    return dirs;
}
function destination(dir) { return {x:x + xdir[dir], y:y + ydir[dir]}; }
const orthogonal = dir => xdir[dir] === 0 || ydir[dir] === 0;

for (const [name, id] of [['grid bug', PMNAMES.PM_GRID_BUG],
    ['giant ant', PMNAMES.PM_GIANT_ANT]]) {
    test(`${name}: all eight clear destinations, no RNG`, async () => {
        await setup(); form(id); seed();
        for (let dir = 0; dir < N_DIRS; ++dir) {
            const cc = destination(dir);
            assert.equal(await crawl_destination(cc.x, cc.y),
                id !== PMNAMES.PM_GRID_BUG || orthogonal(dir), `direction ${dir}`);
        }
        assert.deepEqual(getRngLog(), []);
    });
}

test('goodpos rejects an orthogonal rock and invalid coordinates first', async () => {
    await setup(); form(PMNAMES.PM_GRID_BUG);
    set_levltyp(x + 1, y, STONE); seed();
    assert.equal(await crawl_destination(x + 1, y), false);
    assert.equal(await crawl_destination(0, y), false);
    assert.equal(await crawl_destination(x, -1), false);
    assert.deepEqual(getRngLog(), []);
});

test('source-only phasing grid bug still cannot crawl diagonally', async () => {
    await setup(); form(PMNAMES.PM_GRID_BUG);
    game.u.intrinsic.HPasses_walls = FROMOUTSIDE;
    assert.equal(Passes_walls(), true); seed();
    assert.equal(await crawl_destination(x + 1, y), true);
    assert.equal(await crawl_destination(x + 1, y + 1), false);
    assert.deepEqual(getRngLog(), []);
});

for (const [name, id] of [['grid bug', PMNAMES.PM_GRID_BUG],
    ['giant ant', PMNAMES.PM_GIANT_ANT]]) {
    test(`${name}: shuffled first legal exit preserves all eight draws`, async () => {
        await setup(); form(id); seed(2);
        const dirs = shuffledDirections(), expectedRng = [...getRngLog()];
        assert.equal(orthogonal(dirs[0]), false, 'seed exercises a rejected diagonal');
        const dir = id === PMNAMES.PM_GRID_BUG ? dirs.find(orthogonal) : dirs[0];
        seed(2);
        const cc = {x, y};
        assert.equal(await rnd_nextto_goodpos(cc, game.youmonst), true);
        assert.deepEqual(cc, destination(dir));
        assert.deepEqual(getRngLog(), expectedRng);
    });
}

test('grid bug with only diagonal exits finds none and leaves coordinates intact', async () => {
    await setup(); form(PMNAMES.PM_GRID_BUG);
    for (let dir = 0; dir < N_DIRS; ++dir) if (orthogonal(dir)) {
        const cc = destination(dir); set_levltyp(cc.x, cc.y, STONE);
    }
    seed(2); shuffledDirections(); const expectedRng = [...getRngLog()]; seed(2);
    const cc = {x, y};
    assert.equal(await rnd_nextto_goodpos(cc, game.youmonst), false);
    assert.deepEqual(cc, {x, y});
    assert.deepEqual(getRngLog(), expectedRng);
});

test('nonhero goodpos branch keeps its first diagonal, including a grid bug', async () => {
    await setup(); form(PMNAMES.PM_GRID_BUG);
    const monster = {data:game.mons[PMNAMES.PM_GRID_BUG], mx:x, my:y};
    seed(2); const dirs = shuffledDirections(), expectedRng = [...getRngLog()]; seed(2);
    const cc = {x, y};
    assert.equal(await rnd_nextto_goodpos(cc, monster), true);
    assert.deepEqual(cc, destination(dirs[0]));
    assert.deepEqual(getRngLog(), expectedRng);
});

for (const [name, id] of [['grid bug', PMNAMES.PM_GRID_BUG],
    ['giant ant', PMNAMES.PM_GIANT_ANT]]) {
    test(`${name}: actual worn flight removal completes drowning crawl and gear drop`, async () => {
        await setup();
        const old = await addinv(mksobj(ONAMES.AMULET_OF_FLYING, false, false));
        await accessory_or_armor_on(old);
        assert.equal(old.owornmask, W_AMUL);
        assert.equal(await polymon(id), 1);
        assert.equal(game.u.uamul, old);
        assert.equal(Flying(), true);
        assert.ok(near_capacity() > SLT_ENCUMBER);
        assert.ok(!Swimming() && !Amphibious() && !Breathless() && !Wwalking());
        assert.equal(set_levltyp(x, y, POOL), true);
        const hp = game.u.mh, mortality = game.u.umortality || 0;
        const weight = old.owt;
        game.objects[old.otyp].oc_name_known = 1;
        clearMessages();
        seed(2);
        rn2(20); // trap.c water_damage_chain -> water_damage, the carried amulet.
        const dirs = shuffledDirections();
        rn2(1); // emergency_disrobe chooses the sole inventory object.
        rn2(20); // do.c dropx -> flooreffects -> water_damage, same amulet.
        const expectedRng = [...getRngLog()];
        assert.equal(orthogonal(dirs[0]), false, 'seed witnesses diagonal rejection');
        const dir = id === PMNAMES.PM_GRID_BUG ? dirs.find(orthogonal) : dirs[0];
        seed(2);
        await Amulet_off();
        assert.deepEqual(getRngLog(), expectedRng);
        assert.deepEqual({x:game.u.ux, y:game.u.uy}, destination(dir));
        assert.deepEqual({x:game.u.ux0, y:game.u.uy0}, {x, y});
        assert.equal(game.level.at(game.u.ux, game.u.uy).typ, ROOM);
        assert.equal(game.u.uamul, null);
        assert.equal(Flying(), false);
        assert.equal(old.owornmask | 0, 0);
        assert.equal(!!old.in_use, false, 'normal removal permits emergency disrobing');
        assert.equal(old.where, OBJ_FLOOR);
        assert.deepEqual({x:old.ox, y:old.oy}, {x, y});
        assert.equal(old.owt, weight);
        assert.ok(game.level.objects.includes(old));
        assert.equal(game.invent.length, 0);
        assert.equal(near_capacity(), UNENCUMBERED);
        assert.equal(game.u.mh, hp);
        assert.equal(game.u.umortality || 0, mortality);
        assert.equal(!!game.u.uinwater, false);
        const text = messages();
        let previous = -1;
        for (const phrase of ['You stop flying.', 'You fall into the pool of water!',
            'You sink like a rock.', 'You try to crawl out of the water.',
            'You dump some of your gear to lose weight...', 'Pheew!  That was close.']) {
            const at = text.indexOf(phrase);
            assert.ok(at > previous, phrase); previous = at;
        }
        assert.ok(!text.includes('You drown.') && !text.includes('Die?'));
    });
}
