// C makemon initial newcham; sp_lev callback scopes; nhlsel y-major iteration.
// These controls suspend real getlin input. No module helper is replaced.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { GameMap } from '../js/game.js';
import { init_rect } from '../js/rect.js';
import { lspo_monster, lspo_object, lspo_room, lspo_map_full, lspo_map_coord, lspo_trap,
    lspo_region_full, lspo_region, create_des_coder, reset_xystart_size } from '../js/sp_lev.js';
import { selection_new, selection_setpoint, l_selection_iterate } from '../js/selvar.js';
import { fill_zoo, do_mkroom } from '../js/mkroom.js';
import { make_a_trap, postprocess_add, post_level_generate } from '../js/themerms.js';
import { mksobj, add_to_migration } from '../js/mkobj.js';
import { TOPLINE_EMPTY } from '../js/display.js';
import { PMNAMES as P, MFLAGS } from '../js/monst_data.js';
import { ONAMES as O } from '../js/objects_data.js';
import { OBJ_MINVENT, OBJ_FLOOR, OBJ_CONTAINED } from '../js/obj.js';
import { ROOM, STONE, POOL, OROOM, ZOO, SWAMP, ROOMOFFSET, TELEP_TRAP, STATUE_TRAP,
    FILL_NONE, G_GENOD, M_AP_MONSTER, M_AP_NOTHING, MIGR_TO_SPECIES } from '../js/const.js';
import { initRng, enableRngLog, getRngLog } from '../js/rng.js';

async function setup(terrain = ROOM) {
    const run = await runSegment({ seed: 99812, datetime: '20000110090000', moves: ' ',
        nethackrc: 'OPTIONS=name:wizard,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
            + 'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n',
        storage: new InMemoryStorage() });
    game._preNhgetchHook = null;
    game._toplin = TOPLINE_EMPTY; game._toplines = game._pending_message = '';
    run._display.onEmptyQueue = () => { throw new Error('Unexpected input: ' + game._toplines); };
    game.level = new GameMap();
    game.level.flags.rndmongen = true;
    for (let x = 1; x < 80; x++) for (let y = 0; y < 21; y++) game.level.at(x, y).typ = terrain;
    game.in_mklev = true; game.in_mk_themerooms = false;
    game.coder = null; create_des_coder(); reset_xystart_size(); init_rect();
    game.smeq = new Array(41).fill(0); game.stairs = null; game.exclusion_zones = [];
    game.flags.monpolycontrol = true;
    initRng(21); enableRngLog();
    return run._display;
}
async function answer(display, action, keys, pendingCheck) {
    let signal;
    const waiting = new Promise(resolve => { signal = resolve; });
    display.onEmptyQueue = () => { signal(); };
    const result = action();
    assert.ok(result instanceof Promise, 'caller must return pending creation');
    await Promise.race([waiting, result.then(() => {
        throw new Error('Caller completed before the creation prompt');
    })]);
    let pendingError;
    try { await pendingCheck(); } catch (error) { pendingError = error; }
    display.onEmptyQueue = () => { throw new Error('Unexpected extra input: ' + game._toplines); };
    for (const key of keys) display.pushKey(key.charCodeAt(0));
    const completed = await result;
    if (pendingError) throw pendingError;
    return completed;
}

test('monster inventory callback starts after initial shape selection', async () => {
    const display = await setup(); let entered = false, dagger;
    const created = await answer(display, () => lspo_monster({ id: 'chameleon', x: 30, y: 10,
        inventory() { entered = true; dagger = lspo_object('dagger'); } }), 'kitten\r', () => {
        assert.equal(entered, false);
        assert.equal(game.level.monsters[0].mnum, P.PM_CHAMELEON);
        assert.equal(game.level.monsters[0].minvent, null);
    });
    assert.equal(entered, true); assert.equal(created.mnum, P.PM_KITTEN);
    assert.equal(dagger.where, OBJ_MINVENT); assert.equal(dagger.ocarry, created);
    const outside = lspo_object('rock', 40, 10);
    assert.equal(outside.where, OBJ_FLOOR);
});

test('container scope stays open across a child monster prompt', async () => {
    const display = await setup(); let dagger, entered = false;
    const box = await answer(display, () => lspo_object({ id: 'chest', x: 30, y: 10,
        async contents() {
            await lspo_monster({ id: 'chameleon', x: 31, y: 10 });
            entered = true; dagger = lspo_object('dagger');
        } }), 'kitten\r', () => { assert.equal(entered, false); });
    assert.equal(dagger.where, OBJ_CONTAINED); assert.equal(dagger.ocontainer, box);
    assert.deepEqual(box.cobj, [dagger]);
    assert.equal(lspo_object('rock', 40, 10).where, OBJ_FLOOR);
});

for (const mode of ['full', 'coordinate'])
    test(`map ${mode} preserves its coordinate frame until contents finish`, async () => {
        const display = await setup(); let frame, dagger;
        const opts = { map: '.....\n.....\n.....', x: 20, y: 5,
            async contents() {
                frame = [game.xstart, game.ystart, game.xsize, game.ysize];
                await lspo_monster({ id: 'chameleon', x: 1, y: 1 });
                assert.deepEqual([game.xstart, game.ystart, game.xsize, game.ysize], frame);
                dagger = lspo_object('dagger', 2, 1);
            } };
        await answer(display, () => mode === 'full' ? lspo_map_full(opts) : lspo_map_coord(opts),
            'kitten\r', () => {
                assert.deepEqual([game.xstart, game.ystart, game.xsize, game.ysize], frame);
                assert.equal(dagger, undefined);
            });
        assert.deepEqual([dagger.ox, dagger.oy], [frame[0] + 2, frame[1] + 1]);
        assert.deepEqual([game.xstart, game.ystart, game.xsize, game.ysize], [1, 0, 79, 21]);
    });

for (const mode of ['room', 'region', 'irregular'])
    test(`${mode} keeps croom until its child finishes`, async () => {
        const display = await setup(mode === 'room' ? STONE : ROOM);
        let room, dagger;
        const contents = async rm => {
            room = game.coder.croom;
            assert.ok(room);
            await lspo_monster({ id: 'chameleon', x: 1, y: 1 });
            assert.equal(game.coder.croom, room);
            dagger = lspo_object('dagger', 2, 1);
        };
        const make = () => mode === 'room'
            ? lspo_room({ x: 2, y: 2, w: 8, h: 6, filled: 0, contents })
            : mode === 'region' ? lspo_region_full({ region: [20, 5, 30, 15], type: 'themed', contents })
            : lspo_region(20, 5, OROOM, true, FILL_NONE, contents);
        await answer(display, make, 'kitten\r', () => {
            assert.equal(game.coder.croom, room);
            assert.equal(game.coder.n_subroom, 2);
            assert.equal(dagger, undefined);
        });
        assert.deepEqual([dagger.ox, dagger.oy], [room.lx + 2, room.ly + 1]);
        assert.equal(game.coder.croom, null); assert.equal(game.coder.n_subroom, 1);
    });

test('Lua selection resumes in y-major order after each real prompt', async () => {
    const display = await setup();
    const selection = selection_new(), visited = [], completed = [];
    for (const [x, y] of [[30, 5], [20, 6], [35, 5]]) selection_setpoint(x, y, selection, 1);
    await answer(display, () => l_selection_iterate(selection, async (x, y) => {
        visited.push([x, y]);
        await lspo_monster({ id: 'chameleon', x, y });
        completed.push([x, y]);
    }), 'kitten\r'.repeat(3), () => {
        assert.deepEqual(visited, [[29, 5]]); assert.deepEqual(completed, []);
    });
    assert.deepEqual(visited, [[29, 5], [34, 5], [19, 6]]);
    assert.deepEqual(completed, visited);
});

test('waiting vampire reverts by explicit form without another selector prompt', async () => {
    const display = await setup(); let prompts = 0;
    game._preNhgetchHook = () => { if (game._toplines.endsWith('into what? ')) prompts++; };
    const vampire = await answer(display, () => lspo_monster({ id: 'vampire', x: 30, y: 10,
        waiting: true }), 'vampire bat\r', () => {});
    assert.equal(prompts, 1); assert.equal(vampire.mnum, P.PM_VAMPIRE);
    assert.equal(vampire.cham, P.PM_VAMPIRE);
    game._preNhgetchHook = null;
});

test('named monster appearance changes type without newcham HP rolls', async () => {
    await setup(); game.flags.monpolycontrol = false;
    const plain = lspo_monster({ id: 'chameleon', x: 30, y: 10 });
    assert.ok(!(plain instanceof Promise));
    const hp = [plain.mhp, plain.mhpmax, plain.m_lev];
    await setup(); game.flags.monpolycontrol = false;
    const appeared = lspo_monster({ id: 'chameleon', x: 30, y: 10, appear_as: 'mon:fire vortex' });
    assert.ok(!(appeared instanceof Promise));
    assert.equal(appeared.mnum, P.PM_FIRE_VORTEX);
    assert.deepEqual([appeared.mhp, appeared.mhpmax, appeared.m_lev], hp);
});

test('random mimic appearance calls the selector and retains its real body', async () => {
    const display = await setup();
    const mimic = await answer(display, () => lspo_monster({ id: 'small mimic', x: 30, y: 10,
        appear_as: 'mon:random' }), 'newt\r', () => {
        assert.equal(game.level.monsters[0].mnum, P.PM_SMALL_MIMIC);
    });
    assert.equal(mimic.mnum, P.PM_SMALL_MIMIC);
    assert.equal(mimic.m_ap_type, M_AP_MONSTER); assert.equal(mimic.mappearance, P.PM_NEWT);
});

test('explicit mimic self-appearance clears its disguise without input', async () => {
    await setup();
    const mimic = lspo_monster({ id: 'small mimic', x: 30, y: 10, appear_as: 'mon:small mimic' });
    assert.ok(!(mimic instanceof Promise));
    assert.equal(mimic.m_ap_type, M_AP_NOTHING); assert.equal(mimic.mappearance, 0);
});

test('genocided fixed species falls back to random creation and can prompt', async () => {
    const display = await setup();
    for (const [index, vital] of game.mvitals.entries())
        if (index !== P.PM_CHAMELEON) vital.mvflags |= G_GENOD;
    game.u.ulevel = 10; game.u.uz.dlevel = 10;
    assert.equal(game.level.flags.rndmongen, true);
    const created = await answer(display, () => lspo_monster({ id: 'newt', x: 30, y: 10 }),
        'chameleon\r', () => {
            assert.equal(game.level.monsters[0].cham, P.PM_CHAMELEON);
        });
    assert.equal(created.mnum, P.PM_CHAMELEON);
});

test('ordinary bindings with synchronous callbacks retain inline completion', async () => {
    await setup(); game.flags.monpolycontrol = false;
    let entered = false;
    const map = lspo_map_full({ map: '.....\n.....\n.....', contents() { entered = true; } });
    assert.ok(map && !(map instanceof Promise)); assert.equal(entered, true);
    const creature = lspo_monster({ id: 'newt', x: 30, y: 10 });
    assert.ok(creature && !(creature instanceof Promise));
    const box = lspo_object({ id: 'chest', x: 40, y: 10, contents() { lspo_object('dagger'); } });
    assert.ok(box && !(box instanceof Promise)); assert.equal(box.cobj[0].otyp, O.DAGGER);
});

function onlyChameleon() {
    // Source-state control: the random-monster reservoir has one eligible
    // species. No RNG or creation helper is replaced.
    for (const [index, vital] of game.mvitals.entries())
        if (index !== P.PM_CHAMELEON) vital.mvflags |= G_GENOD;
    game.u.ulevel = 10; game.u.uz.dlevel = 10;
}

test('statue trap finishes its temporary monster before linking the trap and seen flag', async () => {
    const display = await setup(); onlyChameleon();
    let temporary;
    await answer(display, () => lspo_trap('statue', 30, 10, { seen: true, victim: false }),
        'chameleon\r', () => {
            temporary = game.level.monsters[0];
            assert.equal(temporary.cham, P.PM_CHAMELEON);
            assert.equal(game.level.traps.length, 0);
            assert.equal(game.level.objects[0].otyp, O.STATUE);
            assert.equal(game.level.objects[0].corpsenm, P.PM_CHAMELEON);
        });
    assert.equal(temporary.mhp, 0);
    assert.ok(![...game.level.monAt.values()].includes(temporary));
    const trap = game.level.traps[0];
    assert.deepEqual([trap.tx, trap.ty, trap.ttyp, trap.tseen], [31, 10, STATUE_TRAP, true]);
});

test('zoo pauses before square loot and the next monster, then finishes in C scan order', async () => {
    const display = await setup(); onlyChameleon();
    const room = { lx: 30, hx: 31, ly: 10, hy: 10, rtype: ZOO, doorct: 0, fdoor: 0 };
    game.level.rooms = [room]; game.level.nroom = 1;
    await answer(display, () => fill_zoo(room), 'chameleon\r'.repeat(2), () => {
        assert.equal(game.level.monsters.length, 1);
        assert.deepEqual([game.level.monsters[0].mx, game.level.monsters[0].my], [30, 10]);
        assert.equal(game.level.objects.length, 0);
        assert.ok(!game.level.flags.has_zoo);
    });
    assert.deepEqual(game.level.monsters.map(mon => [mon.mx, mon.my, mon.mnum, mon.msleeping]),
        [[31, 10, P.PM_CHAMELEON, 1], [30, 10, P.PM_CHAMELEON, 1]]);
    assert.deepEqual(game.level.objects.map(obj => [obj.ox, obj.oy, obj.otyp]),
        [[31, 10, O.GOLD_PIECE], [30, 10, O.GOLD_PIECE]]);
    assert.equal(game.level.flags.has_zoo, 1);
});

test('swamp exhausted fungus class waits before the next square and room flag', async () => {
    const display = await setup(); onlyChameleon();
    const room = { lx: 30, hx: 31, ly: 10, hy: 10, rtype: OROOM, doorct: 0, fdoor: 0 };
    game.level.rooms = [room]; game.level.nroom = 1;
    for (let x = 30; x <= 31; x++) game.level.at(x, 10).roomno = ROOMOFFSET;
    // The first room draw is rn2(1); seed 7 then takes rn2(4)==0.
    initRng(7); enableRngLog();
    await answer(display, () => do_mkroom(SWAMP), 'chameleon\r', () => {
        assert.equal(room.rtype, SWAMP);
        assert.equal(game.level.monsters[0].cham, P.PM_CHAMELEON);
        assert.equal(game.level.at(31, 10).typ, ROOM);
        assert.ok(!game.level.flags.has_swamp);
    });
    assert.equal(game.level.at(31, 10).typ, POOL);
    assert.equal(game.level.flags.has_swamp, 1);
    assert.equal(game.level.monsters[0].mnum, P.PM_CHAMELEON);
});

test('Medusa statue finishes its temporary monster before the contents callback', async () => {
    const display = await setup(); onlyChameleon();
    game.special_levels.medusa_level = { ...game.u.uz };
    let entered = false, temporary;
    const statue = await answer(display, () => lspo_object({ id: 'statue', x: 30, y: 10,
        contents() { entered = true; } }), 'chameleon\r', () => {
            temporary = game.level.monsters[0];
            assert.equal(temporary.cham, P.PM_CHAMELEON);
            assert.equal(entered, false);
        });
    assert.equal(entered, true);
    assert.equal(statue.corpsenm, P.PM_CHAMELEON);
    assert.equal(statue.where, OBJ_FLOOR);
    assert.equal(temporary.mhp, 0);
    assert.ok(![...game.level.monAt.values()].includes(temporary));
});

test('fixed teleport postprocess remains inline and drains before the next handler', async () => {
    await setup();
    postprocess_add(make_a_trap, { type: 'teleport', coord: { x: 30, y: 10 },
        seen: true, teledest: { x: 40, y: 10 } });
    let observed = false;
    postprocess_add(() => {
        const trap = game.level.traps[0];
        assert.deepEqual([trap.tx, trap.ty, trap.ttyp, trap.tseen], [31, 10, TELEP_TRAP, true]);
        assert.deepEqual(trap.teledest, { x: 41, y: 10 });
        observed = true;
    });
    assert.equal(post_level_generate(), undefined);
    assert.equal(observed, true);
    assert.equal(post_level_generate(), undefined);
    assert.equal(game.level.traps.length, 1);
});

test('Vlad custom inventory waits for the maker-produced Candelabrum to reach the floor', async () => {
    await setup();
    let entered = false, dagger;
    const creation = lspo_monster({ id: 'Vlad the Impaler', x: 30, y: 10,
        inventory() {
            entered = true;
            const rescued = game.level.objects.find(o => o.otyp === O.CANDELABRUM_OF_INVOCATION);
            assert.ok(rescued, 'protected item is placed before custom inventory');
            assert.equal(rescued.where, OBJ_FLOOR);
            assert.deepEqual([rescued.ox, rescued.oy], [31, 10]);
            dagger = lspo_object('dagger');
        } });
    assert.ok(creation instanceof Promise, 'rescue completion matters even without a selector prompt');
    assert.equal(entered, false);
    assert.ok(!game.level.objects.some(o => o.otyp === O.CANDELABRUM_OF_INVOCATION));
    const vlad = await creation;
    assert.equal(entered, true);
    assert.deepEqual(vlad.minvent, [dagger]);
    assert.equal(dagger.ocarry, vlad);
    assert.equal(lspo_object('rock', 40, 10).where, OBJ_FLOOR);
});

// These are the 13 actual fixed unique custom-inventory producers in the
// quest-start scripts. The only MIGR_TO_SPECIES producer targets M2_ORC.
for (const name of ['Grand Master', 'Lord Carnarvon', 'Hippocrates', 'Pelias',
    'Master of Thieves', 'Norn', 'Lord Sato', 'Orion', 'King Arthur', 'Shaman Karnov',
    'Neferet the Green', 'Twoflower', 'Arch Priest'])
    test(`${name} cannot receive orc-targeted loot before custom inventory`, async () => {
        await setup();
        const loot = mksobj(O.RIN_PROTECTION, true, false);
        add_to_migration(loot);
        loot.owornmask = MIGR_TO_SPECIES; loot.migr_species = MFLAGS.M2_ORC;
        let entered = false, dagger;
        const leader = lspo_monster({ id: name, x: 30, y: 10,
            inventory() { entered = true; dagger = lspo_object('dagger'); } });
        assert.ok(leader && !(leader instanceof Promise), 'actual producer contract remains inline');
        assert.equal(entered, true);
        const mask = MFLAGS.M2_UNDEAD | MFLAGS.M2_WERE | MFLAGS.M2_HUMAN | MFLAGS.M2_ELF
            | MFLAGS.M2_DWARF | MFLAGS.M2_GNOME | MFLAGS.M2_ORC | MFLAGS.M2_DEMON | MFLAGS.M2_GIANT;
        assert.equal(leader.data.mflags2 & mask, MFLAGS.M2_HUMAN);
        assert.deepEqual(game.migrating_objs, [loot]);
        assert.deepEqual(leader.minvent, [dagger]);
        assert.equal(dagger.ocarry, leader);
    });
