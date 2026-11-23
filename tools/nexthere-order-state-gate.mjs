#!/usr/bin/env node
// Compare both floor chains with whole functions extracted from pinned C.
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { cases } from './nexthere-order-cases.mjs';
import { nexthereOrderOracle } from './nexthere-order-c-oracle.mjs';

register('./nexthere-order-state-loader.mjs', import.meta.url);
const { runSegment } = await import('../js/jsmain.js');
const gstate = await import('../js/gstate.js');
const mk = await import('../js/mkobj.js');
const restore = await import('../js/restore.js');
const { obj_extract_self, look_here, sobj_at, nxtobj, obj_here, weight } = await import('../js/invent.js');
const { vobj_at } = await import('../js/display.js');
const { bhitpile } = await import('../js/zap.js');
const { hides_under } = await import('../js/mondata.js');
const { gamestate_encode, gamestate_decode, dosave0, dorecover } = await import('../js/save.js');
const { ONAMES: N } = await import('../js/objects_data.js');
const { InMemoryStorage } = await import('../js/storage.js');
const { ROOM, OBJ_FLOOR, OBJ_FREE } = await import('../js/const.js');
const { audit_strip_objs } = await import('../js/bones.js');
const { audit_fhito_loc } = await import('../js/muse.js');
const { audit_objects_at } = await import('../js/monmove.js');
const { flip_level } = await import('../js/sp_lev.js');
const { get_level_extends } = await import('../js/mklev.js');
const { OBJ_DELETED, OBJ_LUAFREE } = await import('../js/const.js');
const { mksobj, place_object, replace_object, splitobj, add_to_migration, add_to_container } = mk;
const { find_lev_obj } = restore;

const { states: expected, sources: oracleSources } = nexthereOrderOracle(cases);
await runSegment({
    seed: 31,
    datetime: '20000112093000',
    moves: ' ',
    storage: new InMemoryStorage(),
    nethackrc: 'OPTIONS=name:wizard,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
        + 'OPTIONS=!autopickup,!tutorial,!tips,pettype:none,pauper,nudist,!autoquiver\n'
        + 'OPTIONS=suppress_alert:3.4.3\nOPTIONS=symset:DECgraphics\n'
        + 'OPTIONS=!confirm,menustyle:traditional\n'
});
const { game } = gstate;
assert.ok(game.level.objAt instanceof Map, 'runtime must retain independent local pile heads');
game.u.ux = 10;
game.u.uy = 10;
game.level.at(10, 10).typ = ROOM;
game.level.traps = [];
game.regions = [];
game.flags.pile_limit = 0;
const results = [];
let index = 0;
const ids = objects => objects.map(o => o.audit_id);

function view(level = game.level) {
    const piles = {};
    const found = new Set();
    for (const [key, head] of level.objAt) {
        assert.ok(head, 'no empty head entries');
        piles[key] = [];
        for (let obj = head; obj; obj = obj.nexthere) {
            assert.ok(!found.has(obj), 'acyclic, single local membership');
            found.add(obj);
            assert.equal(obj.where, OBJ_FLOOR);
            assert.equal(key, `${obj.ox},${obj.oy}`);
            assert.ok(level.objects.includes(obj), 'local reference is global object');
            piles[key].push(obj.audit_id);
        }
    }
    assert.equal(found.size, level.objects.length, 'all global objects have local membership');
    assert.equal(new Set(level.objects).size, level.objects.length);
    return { global: ids(level.objects), piles };
}

async function record(label, fn) {
    try {
        await fn();
        results.push({ label, passed: true });
    } catch (error) {
        results.push({ label, passed: false, error: error.message });
    }
}

for (const sample of cases) {
    game.level.objects = [];
    game.level.objAt.clear();
    const objects = new Map();
    const visits = [];

    function create(id, type) {
        const obj = mk.mksobj(N[type], false, false);
        obj.quan = 8;
        obj.owt = weight(obj);
        obj.audit_id = id;
        objects.set(id, obj);
        return obj;
    }

    async function compare(step) {
        const c = expected[index++];
        assert.equal(c.name, sample.name);
        assert.equal(c.step, step);
        await record(`${sample.name}/${step}`, () => assert.deepEqual(
            { ...view(), visits },
            { global: c.global, piles: c.piles, visits: c.visits }
        ));
    }

    await compare(0);
    for (const [step, a] of sample.actions.entries()) {
        try {
            if (a.op === 'put') {
                const obj = objects.get(a.id) || create(a.id, a.type);
                obj.quan = a.quan ?? 8;
                mk.place_object(obj, a.x, a.y);
            } else if (a.op === 'remove') {
                obj_extract_self(objects.get(a.id));
            } else if (a.op === 'replace') {
                mk.replace_object(objects.get(a.old), create(a.id, a.type));
            } else if (a.op === 'split') {
                const child = mk.splitobj(objects.get(a.old), a.num);
                child.audit_id = a.id;
                objects.set(a.id, child);
            } else if (a.op === 'extract') {
                mk.extract_nexthere(objects.get(a.id));
                mk.extract_nobj(objects.get(a.id), game.level.objects);
            } else if (a.op === 'recreate') {
                await mk.recreate_pile_at(a.x, a.y);
            } else if (a.op === 'restore') {
                await restore.find_lev_obj();
            } else if (a.op === 'hit') {
                const data = game.youmonst.data;
                if (a.hide) {
                    game.youmonst.data = game.mons.find(hides_under);
                }
                game.u.uundetected = !!a.hide;
                await bhitpile({ otyp: N.WAN_NOTHING }, async obj => {
                    visits.push(obj.audit_id);
                    if (a.mode === 1) {
                        obj_extract_self(obj);
                    }
                    if (a.mode === 2 && obj.audit_id === 3) {
                        const child = mk.splitobj(objects.get(1), 2);
                        child.audit_id = 4;
                        objects.set(4, child);
                    }
                    if ((a.mode === 3 && obj.audit_id === 2) || (a.mode === 4 && obj.audit_id === 3)) {
                        mk.replace_object(obj, create(4, 'ROCK'));
                    }
                    return 1;
                }, 10, 10, a.zz ?? 0);
                game.youmonst.data = data;
                game.u.uundetected = false;
            }
        } catch (error) {
            error.message = `${sample.name}/${step + 1}: ${error.message}`;
            throw error;
        }
        await compare(step + 1);
    }

    const last = expected[index - 1];
    const before = [...game.level.objects];
    const rng = structuredClone([game.coreCtx, game.dispCtx, game.luaCtx]);
    const stop = new Error('stop after actual look_here pile selection');
    let observed;
    globalThis.__nexthereOrderObserve = pile => {
        observed = ids(pile);
        throw stop;
    };
    try {
        await assert.rejects(look_here(0, 0), error => error === stop);
    } finally {
        delete globalThis.__nexthereOrderObserve;
    }
    await record(sample.name + '/look_here', () => {
        assert.deepEqual(observed, last.piles['10,10'] || []);
        assert.deepEqual(game.level.objects, before);
        assert.deepEqual([game.coreCtx, game.dispCtx, game.luaCtx], rng);
    });
    await record(sample.name + '/heads-and-search', () => {
        for (const key of Object.keys(last.piles)) {
            const [x, y] = key.split(',').map(Number);
            const local = last.piles[key];
            assert.equal(vobj_at(x, y)?.audit_id, local[0]);
            for (const type of [N.BOULDER, N.DAGGER, N.ROCK, N.APPLE]) {
                const expectedObjects = local.map(id => objects.get(id)).filter(o => o.otyp === type);
                assert.equal(sobj_at(type, x, y), expectedObjects[0] || null);
                for (const [i, o] of expectedObjects.entries()) {
                    assert.ok(obj_here(o, x, y));
                    assert.equal(nxtobj(o, type, true), expectedObjects[i + 1] || null);
                }
            }
        }
    });
    await record(sample.name + '/codec-aliases', () => {
        const decoded = gamestate_decode(JSON.parse(JSON.stringify(gamestate_encode({ level: game.level }))));
        assert.deepEqual(view(decoded.level), view());
    });
    await record(sample.name + '/removed-links', () => {
        for (const obj of objects.values()) {
            if (obj.where === OBJ_FREE) {
                assert.equal(obj.nexthere ?? null, null);
            }
        }
    });
}
assert.equal(index, expected.length);

// Actual save entry points must rebuild the ambiguous history as C getlev does.
game.level.objects = [];
game.level.objAt.clear();
const b = mk.mksobj(N.BOULDER, false, false);
const d = mk.mksobj(N.DAGGER, false, false);
const r = mk.mksobj(N.ROCK, false, false);
b.audit_id = 1;
d.audit_id = 2;
r.audit_id = 3;
mk.place_object(b, 10, 10);
mk.place_object(d, 10, 10);
mk.replace_object(b, r);
await record('actual-save/dosave0-dorecover', async () => {
    assert.ok(await dosave0());
    assert.ok(await dorecover());
    assert.deepEqual(view(), { global: [2, 3], piles: { '10,10': [2, 3] } });
});

function fresh() {
    game.level.objects = [];
    game.level.objAt.clear();
}

function create(id, type) {
    const o = mksobj(N[type], false, false);
    o.audit_id = id;
    o.quan = 8;
    return o;
}

function put(id, type) {
    const o = create(id, type);
    place_object(o, 10, 10);
    return o;
}

function ambiguous() {
    fresh();
    const b = put(1, 'BOULDER');
    const d = put(2, 'DAGGER');
    const r = create(3, 'ROCK');
    replace_object(b, r);
    return { b, d, r };
}

async function test(name, fn) {
    try {
        await fn();
        results.push({ name, passed: true });
    } catch (error) {
        results.push({ name, passed: false, error: error.stack });
    }
}

await test('monster-beam-live-successors', async () => {
    fresh();
    const r = put(1, 'ROCK');
    put(2, 'DAGGER');
    put(3, 'APPLE');
    const visits = [];
    await audit_fhito_loc({ otyp: N.WAN_NOTHING }, 10, 10, async o => {
        visits.push(o.audit_id);
        if (o.audit_id === 3) {
            const child = splitobj(r, 2);
            child.audit_id = 4;
        }
        obj_extract_self(o);
        return 1;
    });
    assert.deepEqual(visits, [3, 2, 1, 4]);
    assert.deepEqual(game.level.objects, []);
    assert.equal(game.level.objAt.size, 0);
});

await test('monster-local-reader', async () => {
    ambiguous();
    const rng = structuredClone([game.coreCtx, game.dispCtx]);
    assert.deepEqual(ids(audit_objects_at(10, 10)), [3, 2]);
    assert.deepEqual(ids(game.level.objects), [2, 3]);
    assert.deepEqual([game.coreCtx, game.dispCtx], rng);
});

await test('bones-stripping-and-C-rebuild', async () => {
    ambiguous();
    const raw = JSON.stringify(audit_strip_objs(game.level.objects));
    assert.ok(!raw.includes('nexthere'));
    assert.deepEqual(ids(JSON.parse(raw)), [2, 3]);
    game.level.objects = JSON.parse(raw);
    delete game.level.objAt;
    await find_lev_obj();
    assert.deepEqual(ids(game.level.objects), [2, 3]);
    assert.deepEqual(ids(game.level.objectsAt(10, 10)), [2, 3]);
    assert.equal(game.level.objectAt(10, 10), game.level.objects[0]);
});

await test('level-flip-preserves-links-and-global-order', async () => {
    const { r, d } = ambiguous();
    const global = [...game.level.objects];
    const ext = get_level_extends();
    const minx = Math.max(ext.xmin, 1);
    const maxx = Math.min(ext.xmax, 79);
    const miny = Math.max(ext.ymin, 0);
    const maxy = Math.min(ext.ymax, 20);
    const x = maxx - 10 + minx;
    const y = maxy - 10 + miny;
    assert.ok(10 >= minx && 10 <= maxx && 10 >= miny && 10 <= maxy);
    await flip_level(3, false);
    assert.deepEqual([r.ox, r.oy], [x, y]);
    assert.equal(r.nexthere, d);
    assert.equal(game.level.objectAt(x, y), r);
    assert.deepEqual(game.level.objects, global);
    const again = get_level_extends();
    const x2 = Math.min(again.xmax, 79) - x + Math.max(again.xmin, 1);
    const y2 = Math.min(again.ymax, 20) - y + Math.max(again.ymin, 0);
    await flip_level(3, false);
    assert.deepEqual([r.ox, r.oy], [x2, y2]);
    assert.equal(game.level.objectAt(x2, y2), r);
    assert.deepEqual(ids(game.level.objectsAt(x2, y2)), [3, 2]);
});

await test('saved-level-alias-and-return-rebuild', async () => {
    ambiguous();
    game.saved_levels = new Map([['test', game.level]]);
    const copy = gamestate_decode(JSON.parse(JSON.stringify(gamestate_encode({
        level: game.level,
        saved_levels: game.saved_levels
    }))));
    assert.equal(copy.level, copy.saved_levels.get('test'));
    assert.deepEqual(ids(copy.level.objectsAt(10, 10)), [3, 2]);
    game.level = copy.saved_levels.get('test');
    await find_lev_obj();
    assert.deepEqual(ids(game.level.objectsAt(10, 10)), [2, 3]);
    assert.deepEqual(ids(game.level.objects), [2, 3]);
});

await test('floor-container-floor-transition', async () => {
    const { r, d } = ambiguous();
    const box = create(4, 'CHEST');
    obj_extract_self(r);
    assert.equal(r.nexthere, null);
    add_to_container(box, r);
    assert.equal(game.level.objectAt(10, 10), d);
    obj_extract_self(r);
    place_object(r, 11, 10);
    assert.equal(game.level.objectAt(11, 10), r);
    assert.equal(r.where, OBJ_FLOOR);
    assert.deepEqual(ids(game.level.objects), [3, 2]);
    assert.deepEqual(box.cobj, []);
});

await test('floor-migration-floor-transition', async () => {
    const { r } = ambiguous();
    obj_extract_self(r);
    add_to_migration(r);
    assert.equal(r.nexthere, null);
    obj_extract_self(r);
    assert.equal(r.where, OBJ_FREE);
    assert.ok(!game.migrating_objs.includes(r));
    place_object(r, 11, 10);
    assert.equal(game.level.objectAt(11, 10), r);
});

await test('deleted-and-lua-extraction-is-inert', async () => {
    for (const where of [OBJ_DELETED, OBJ_LUAFREE]) {
        const o = { where };
        obj_extract_self(o);
        assert.equal(o.where, where);
    }
});

console.log(JSON.stringify({
    passed: results.filter(r => r.passed).length,
    total: results.length,
    chainSnapshots: expected.length,
    histories: cases.length,
    oracleSources,
    failures: results.filter(r => !r.passed)
}, null, 2));
if (results.some(r => !r.passed)) {
    process.exitCode = 1;
}
