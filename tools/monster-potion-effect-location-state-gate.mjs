// C muse.c:2383 use_misc(), reached through real inventory and selection.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { setup, clearMessages, messages, seed } from './status-followup-test-setup.mjs';
import { game } from '../js/gstate.js';
import { makemon } from '../js/makemon.js';
import { mksobj } from '../js/mkobj.js';
import { mpickobj } from '../js/steal.js';
import { m_dowear } from '../js/worn.js';
import { goto_level } from '../js/do.js';
import { set_levltyp } from '../js/mkmaze.js';
import { vision_reset, vision_recalc } from '../js/vision.js';
import { find_misc, use_misc, MUSE_POT_GAIN_LEVEL, MUSE_POT_POLYMORPH } from '../js/muse.js';
import { make_hallucinated, make_deaf } from '../js/potion.js';
import { canseemon } from '../js/display.js';
import { Can_rise_up, ceiling } from '../js/dungeon.js';
import { objdescr_is } from '../js/o_init.js';
import { getRngLog } from '../js/rng.js';
import { ONAMES as O } from '../js/objects_data.js';
import { PMNAMES as P } from '../js/monst_data.js';
import * as C from '../js/const.js';

const kinds = ['growth', 'rise', 'blocked', 'polymorph'];
const phrases = {
    growth: 'seems more experienced.', rise: 'rises up, through the ceiling!',
    blocked: 'looks uneasy.', polymorph: 'suddenly mutates!',
};

async function prepare(kind, { accessible = true, visible = true,
    deaf = false, hallucinating = false } = {}) {
    const run = await setup();
    let reads = 0;
    const observed = [];
    const acknowledge = () => {
        observed.push(game._toplines);
        assert.ok(++reads < 50, `unexpected repeated input: ${game._toplines}`);
        return game._toplin === 3 ? 27 : 32;
    };
    run._display.onEmptyQueue = acknowledge;
    if (kind === 'rise') {
        await goto_level({ dnum: game.u.uz.dnum, dlevel: 2 }, false, false, 0);
        assert.equal(game.u.uz.dlevel, 2);
        game.level.monsters = [];
        game.level.monAt.clear();
        game.level.traps = [];
        game.u.ux = 31;
        game.u.uy = 10;
        for (let x = 27; x <= 35; x++) {
            for (let y = 6; y <= 14; y++) {
                assert.equal(set_levltyp(x, y, C.ROOM), true);
                Object.assign(game.level.at(x, y), { lit: 1, waslit: 1, seenv: 255, roomno: 0 });
            }
        }
        vision_reset();
        vision_recalc();
    }
    game.stairs = null;
    const species = kind === 'polymorph' ? P.PM_HOBGOBLIN : P.PM_GOBLIN;
    const name = kind === 'polymorph' ? 'The hobgoblin' : 'The goblin';
    const mon = await makemon(game.mons[species], 33, 10,
        C.NO_MINVENT | C.MM_NOGRP | C.MM_NOWAIT | C.MM_NOMSG
        | (visible ? 0 : C.MM_MINVIS));
    assert.ok(mon);
    mon.mpeaceful = 0;
    mon.mux = game.u.ux;
    mon.muy = game.u.uy;
    if (kind === 'polymorph') {
        const scales = mksobj(O.GRAY_DRAGON_SCALES, false, false);
        await mpickobj(mon, scales);
        assert.equal(m_dowear(mon, true), undefined);
        assert.ok(scales.owornmask & C.W_ARM,
            'real worn dragon scales select the C potion transformation');
    }
    const obj = mksobj(kind === 'polymorph' ? O.POT_POLYMORPH : O.POT_GAIN_LEVEL,
        false, false);
    obj.cursed = kind === 'rise' || kind === 'blocked' ? 1 : 0;
    assert.equal(objdescr_is(obj, 'milky') || objdescr_is(obj, 'smoky'), false,
        'this appearance does not enter the separate potion-occupant precheck');
    await mpickobj(mon, obj);
    if (hallucinating)
        await make_hallucinated(100, false);
    if (deaf)
        await make_deaf(100, false);
    game.flags.accessiblemsg = accessible;
    game.iflags.getpos_coords = 'm';
    clearMessages();
    observed.length = 0;
    seed(7);
    assert.equal(!!canseemon(mon), visible);
    assert.equal(game.objects[obj.otyp].oc_name_known, 0);
    assert.equal(find_misc(mon), true);
    assert.equal(game.m.misc, obj);
    assert.equal(game.m.has_misc,
        kind === 'polymorph' ? MUSE_POT_POLYMORPH : MUSE_POT_GAIN_LEVEL);
    if (kind === 'rise' || kind === 'blocked')
        assert.equal(!!Can_rise_up(mon.mx, mon.my, game.u.uz), kind === 'rise');
    if (kind === 'rise')
        assert.equal(ceiling(mon.mx, mon.my), 'ceiling');
    const output = () => [...observed, messages()].join('\n');
    return { run, mon, obj, acknowledge, observed, output, name, level: mon.m_lev,
        hpmax: mon.mhpmax, type: mon.mnum };
}

function checkCompletion(kind, prepared, visible) {
    const { mon, obj, level, hpmax } = prepared;
    assert.equal(mon.minvent.includes(obj), false);
    assert.equal(obj.where, C.OBJ_DELETED);
    assert.ok(game.objs_deleted.includes(obj));
    if (kind === 'rise') {
        assert.equal(game.level.monsters.includes(mon), false);
        assert.ok(game.migrating_mons.includes(mon));
        assert.deepEqual([mon.mx, mon.my], [0, 0]);
        assert.deepEqual([mon.mux, mon.muy], [game.u.uz.dnum, 1]);
    } else {
        assert.ok(game.level.monsters.includes(mon));
        assert.deepEqual([mon.mx, mon.my], [33, 10]);
    }
    if (kind === 'growth') {
        assert.equal(mon.m_lev, level + 1);
        assert.ok(mon.mhpmax > hpmax);
    } else if (kind === 'polymorph') {
        assert.equal(mon.mnum, P.PM_GRAY_DRAGON);
    } else {
        assert.equal(mon.m_lev, level);
        assert.equal(mon.mhpmax, hpmax);
    }
    assert.equal(game.objects[obj.otyp].oc_name_known,
        visible && (kind === 'growth' || kind === 'polymorph') ? 1 : 0);
    assert.deepEqual(game.a11y.msg_loc, { x: 0, y: 0 });
}

for (const kind of kinds) {
    for (const mode of ['located', 'plain', 'unseen']) {
        test(`${kind} effect with ${mode} feedback`, async () => {
            const visible = mode !== 'unseen';
            const prepared = await prepare(kind, { visible, accessible: mode !== 'plain' });
            assert.equal(await use_misc(prepared.mon), 2);
            checkCompletion(kind, prepared, visible);
            const output = prepared.output();
            if (visible) {
                const prefix = mode === 'located' ? '<33,10>: ' : '';
                assert.ok(output.includes(`${prefix}${prepared.name} ${phrases[kind]}`), output);
                if (mode === 'plain')
                    assert.doesNotMatch(output, /<33,10>:/);
            } else {
                assert.ok(!output.includes(phrases[kind]), output);
                assert.match(output, /You hear a chugging sound\./);
            }
            if (kind === 'rise' || kind === 'blocked')
                assert.deepEqual(getRngLog(), []);
            if (kind === 'growth') {
                const calls = getRngLog();
                assert.deepEqual(calls.map(call => call.split('=')[0]),
                    visible ? ['rn2(19)', 'rnd(8)'] : ['rnd(8)']);
            }
        });
    }
}

for (const kind of ['growth', 'polymorph']) {
    test(`${kind} unseen and deaf suppresses both affected messages`, async () => {
        const prepared = await prepare(kind, { visible: false, deaf: true });
        assert.equal(await use_misc(prepared.mon), 2);
        checkCompletion(kind, prepared, false);
        assert.doesNotMatch(prepared.output(), /chugging| drinks |seems more experienced|suddenly mutates/);
    });

    test(`${kind} visible hallucination retains C direct type discovery`, async () => {
        const prepared = await prepare(kind, { hallucinating: true });
        assert.equal(await use_misc(prepared.mon), 2);
        checkCompletion(kind, prepared, true);
        assert.equal(prepared.obj.dknown, 0);
        assert.ok(prepared.output().split('\n').some(line => line.includes('<33,10>:')
            && line.includes(phrases[kind])), prepared.output());
        assert.ok(getRngLog().some(call => call.startsWith('rn2(19)=')),
            'use_misc calls makeknown directly when visible, including hallucination');
    });
}

async function holdEffect(prepared, inspect) {
    let enter, release, timer;
    let done = false;
    const waiting = new Promise(resolve => { enter = resolve; });
    prepared.run._display.onEmptyQueue = () => {
        prepared.observed.push(game._toplines);
        enter();
        return new Promise(resolve => { release = resolve; });
    };
    const pending = use_misc(prepared.mon).then(result => {
        done = true;
        return result;
    });
    try {
        await Promise.race([waiting,
            pending.then(() => { throw Error('expected pending effect feedback'); }),
            new Promise((_, reject) => {
                timer = setTimeout(() => reject(Error('missing More prompt')), 2000);
            })]);
        await setImmediate();
        assert.equal(done, false);
        inspect();
    } finally {
        clearTimeout(timer);
        prepared.run._display.onEmptyQueue = prepared.acknowledge;
        release?.(32);
        await pending;
    }
    return pending;
}

for (const kind of kinds) {
    test(`${kind} effect completion preserves C consumption and mutation order`, async () => {
        const prepared = await prepare(kind);
        const { mon, obj, type, level, hpmax } = prepared;
        assert.equal(await holdEffect(prepared, () => {
            assert.ok(game._toplines.includes(`${prepared.name} drinks `), game._toplines);
            assert.equal(mon.mnum, type);
            assert.equal(mon.m_lev, level);
            assert.equal(mon.mhpmax, hpmax);
            assert.deepEqual([mon.mx, mon.my], [33, 10]);
            assert.ok(game.level.monsters.includes(mon));
            assert.equal(game.objects[obj.otyp].oc_name_known, 0);
            assert.equal(obj.where, kind === 'polymorph' ? C.OBJ_DELETED : C.OBJ_MINVENT);
            assert.equal(mon.minvent.includes(obj), kind !== 'polymorph');
            assert.deepEqual(getRngLog(), [], 'effect continuations have not drawn RNG');
        }), 2);
        checkCompletion(kind, prepared, true);
        assert.ok(prepared.output().includes(`<33,10>: ${prepared.name} ${phrases[kind]}`),
            prepared.output());
    });
}
