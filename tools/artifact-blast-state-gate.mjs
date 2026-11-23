// Run: node --test tools/artifact-blast-state-gate.mjs
// Source-derived controls for invent.c:1218-1238. Real touch, damage, and drop helpers.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { hold_another_object } from '../js/invent.js';
import { mksobj } from '../js/mkobj.js';
import { artifact_exists } from '../js/artifact.js';
import { artifact_names, artifact_otyps } from '../js/artilist_data.js';
import { ONAMES } from '../js/objects_data.js';
import { polymon } from '../js/polyself.js';
import { PMNAMES } from '../js/monst_data.js';
import { Upolyd, OBJ_FREE, OBJ_FLOOR, OBJ_INVENT, ROOM } from '../js/const.js';
import { Antimagic } from '../js/youprop.js';
import { initRng, enableRngLog, getRngLog, d, rn2 } from '../js/rng.js';

const text = () => [...game._msg_history, game._toplines].join('\n');
let expectedRng;
async function setup({ form = PMNAMES.PM_GRID_BUG, mh = 1,
    name = 'The Eyes of the Overworld', blast = true } = {}) {
    const run = await runSegment({
        seed: 99812, datetime: '20000110090000',
        nethackrc: 'OPTIONS=name:Desired,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
            + 'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,!safe_wait,!debug_mongen,pauper,nudist\n'
            + 'OPTIONS=suppress_alert:3.4.3\n'
            + 'OPTIONS=symset:DECgraphics\n',
        moves: ' ', storage: new InMemoryStorage(),
    });
    let prompts = 0;
    run._display.onEmptyQueue = () => {
        assert.ok(++prompts < 40, 'bounded message dismissal');
        return 27;
    };
    game._preNhgetchHook = null;
    game.level.monsters = []; game.level.monAt.clear();
    game.level.objects = []; game.level.traps = []; game.regions = [];
    game.level.objAt.clear();
    game.invent = [];
    Object.assign(game.level.at(game.u.ux, game.u.uy), { typ: ROOM, roomno: 0 });
    game.u.uhp = game.u.uhpmax = 200;
    if (form !== null) {
        assert.equal(await polymon(form), 1);
        assert.equal(Upolyd(game.u), true);
        game.u.mh = game.u.mhmax = mh;
    } else assert.equal(Upolyd(game.u), false);
    assert.equal(!!Antimagic(), false);
    const arti = artifact_names.indexOf(name);
    assert.ok(arti > 0);
    const obj = mksobj(ONAMES[artifact_otyps[arti]], false, false);
    obj.oname = name;
    artifact_exists(obj, name, true, 0);
    assert.equal(obj.oartifact, arti);
    assert.equal(obj.where, OBJ_FREE);
    game._toplines = ''; game._msg_history = []; game._toplin = 0; game._win_stop = false;
    // artifact.c:953 damage, then attrib.c:509 wisdom exercise. No other draw
    // occurs in these empty-room touch/drop paths, including rehumanization.
    initRng(3); enableRngLog();
    if (blast) { d(4, 10); rn2(2); }
    expectedRng = [...getRngLog()];
    initRng(3); enableRngLog();
    return obj;
}

function touchRng() {
    assert.deepEqual(getRngLog(), expectedRng, 'complete source-derived touch RNG sequence');
}

function placement(obj, floor) {
    assert.equal(obj.where, floor ? OBJ_FLOOR : OBJ_INVENT);
    assert.equal(game.invent.includes(obj), !floor);
    assert.equal(game.level.objects.filter(o => o === obj).length, floor ? 1 : 0);
    if (floor) assert.deepEqual([obj.ox, obj.oy], [game.u.ux, game.u.uy]);
}

for (const drop_fmt of ['Lost grip on %s.', null])
test(`accepted blast ends polymorph, feedback=${!!drop_fmt}`, async () => {
    const obj = await setup();
    const humanHP = game.u.uhp;
    const returned = await hold_another_object(obj, drop_fmt, 'the artifact', null);
    touchRng();
    assert.equal(returned, obj, 'C returns the original object, not null');
    assert.equal(Upolyd(game.u), false);
    assert.equal(game.u.uhp, humanHP, 'blast damages the monster form');
    assert.match(text(), /are blasted by/);
    assert.doesNotMatch(text(), /evades your grasp/);
    assert.equal(text().includes('Lost grip on the artifact.'), !!drop_fmt);
    placement(obj, true);
});

test('accepted blast leaves a surviving form holding the artifact', async () => {
    const obj = await setup({ form: PMNAMES.PM_MINOTAUR, mh: 200 });
    assert.equal(await hold_another_object(obj, 'Lost grip on %s.', 'the artifact', null), obj);
    touchRng();
    assert.equal(Upolyd(game.u), true);
    assert.ok(game.u.mh < 200 && game.u.mh > 0);
    assert.match(text(), /are blasted by/);
    assert.doesNotMatch(text(), /Lost grip/);
    placement(obj, false);
});

test('human accepted blast keeps the object', async () => {
    const obj = await setup({ form: null });
    assert.equal(await hold_another_object(obj, 'Lost grip on %s.', 'the artifact', null), obj);
    touchRng();
    assert.equal(Upolyd(game.u), false);
    assert.ok(game.u.uhp < 200 && game.u.uhp > 0);
    assert.match(text(), /are blasted by/);
    assert.doesNotMatch(text(), /Lost grip/);
    placement(obj, false);
});

test('refusal takes precedence when its blast ends polymorph', async () => {
    const obj = await setup({ name: 'The Orb of Detection' });
    assert.equal(await hold_another_object(obj, 'Lost grip on %s.', 'the artifact', null), obj);
    touchRng();
    assert.equal(Upolyd(game.u), false);
    assert.match(text(), /are blasted by/);
    assert.match(text(), /evades your grasp/);
    assert.doesNotMatch(text(), /Lost grip/);
    placement(obj, true);
});

test('accepted artifact without a blast preserves the form and inventory', async () => {
    const obj = await setup({ name: 'Frost Brand', form: PMNAMES.PM_MINOTAUR, mh: 200, blast: false });
    assert.equal(await hold_another_object(obj, 'Lost grip on %s.', 'the artifact', null), obj);
    touchRng();
    assert.equal(Upolyd(game.u), true);
    assert.equal(game.u.mh, 200);
    assert.doesNotMatch(text(), /are blasted by|Lost grip|evades your grasp/);
    placement(obj, false);
});
