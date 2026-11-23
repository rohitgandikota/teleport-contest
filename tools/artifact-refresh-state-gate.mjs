#!/usr/bin/env node
// C invent.c:959/1358 delegate refresh to artifact.c:798-805.
// Constructed source contracts, not native-input coverage evidence.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { InMemoryStorage } from '../js/storage.js';
import { addinv, freeinv, obj_extract_self } from '../js/invent.js';
import { mksobj } from '../js/mkobj.js';
import { makemon } from '../js/makemon.js';
import { set_artifact_intrinsic } from '../js/artifact.js';
import { recalc_telepat_range } from '../js/worn.js';
import { Hallucination } from '../js/youprop.js';
import { initRng, enableRngLog, getRngLog, rn2_on_display_rng } from '../js/rng.js';
import { ONAMES } from '../js/objects_data.js';
import { PMNAMES, NUMMONS } from '../js/monst_data.js';
import { artifact_records, artifact_names, artifact_otyps, ART_GRAYSWANDIR, ART_STING, ART_ORB_OF_FATE,
    ART_ORB_OF_DETECTION, ART_MAGIC_MIRROR_OF_MERLIN } from '../js/artilist_data.js';
import { W_ART, W_AMUL, OBJ_FREE, OBJ_INVENT, BOLT_LIM, FROMOUTSIDE,
    ROOM, IN_SIGHT, COULD_SEE, MM_NOGRP, MM_NOMSG, NO_MINVENT } from '../js/const.js';

const base = JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/command-result-flags.json', import.meta.url))).segments[0];
async function setup(halluc = true) {
    const run = await runSegment({ ...base, moves: ' ', storage: new InMemoryStorage() });
    game._preNhgetchHook = null;
    run._display.onEmptyQueue = () => 32;
    game.invent = []; game.level.monsters = []; game.level.monAt.clear();
    for (const obj of [...game.level.objects]) obj_extract_self(obj);
    game.level.traps = []; game.regions = []; game.timer_base = []; game.light_sources = [];
    game.u.intrinsic = {}; game.u.uprops = {}; game.u.blocked = {};
    for (const slot of ['uwep', 'uswapwep', 'uquiver', 'uarm', 'uarmc', 'uarmh',
        'uarmg', 'uarmf', 'uarmu', 'uarms', 'uamul', 'uleft', 'uright', 'ublindf', 'uball', 'uchain'])
        game.u[slot] = null;
    game.u.ux = 31; game.u.uy = 10; game.u.ublind = 0;
    game.u.uswallow = false; game.u.ustuck = null; game.u.usteed = null;
    game.u.unblind_telepat_range = -1; game.u.twoweap = false;
    game.u.usleep = 0; game.multi = 0; game.warn_obj_cnt = 0;
    game.context.warntype = {}; game.u.uhave = {};
    for (let x = 26; x <= 36; x++) for (let y = 5; y <= 15; y++) {
        Object.assign(game.level.at(x, y), { typ: ROOM, lit: 1, waslit: 1, seenv: 255 });
        game.viz_array[y][x] = IN_SIGHT | COULD_SEE;
    }
    const mon = await makemon(game.mons[PMNAMES.PM_GOBLIN], 32, 10,
        MM_NOGRP | MM_NOMSG | NO_MINVENT);
    assert.ok(mon);
    game.u.intrinsic.HHallucination = game.u.uprops.HALLUC = halluc ? 20 : 0;
    game._toplines = ''; game._toplin = 0; game._msg_history = [];
    game._pending_message = ''; game._win_stop = false;
    return mon;
}
function artifact(id) {
    const obj = mksobj(ONAMES[artifact_otyps[id]], false, false);
    obj.oartifact = id; obj.oname = artifact_names[id];
    obj.dknown = 1; obj.known = 1; obj.cursed = 0;
    return obj;
}
async function checkDraws(mon, refresh, action) {
    const oldDisplayLog = globalThis.__rng_log_disp;
    globalThis.__rng_log_disp = true;
    try {
        initRng(7); game.dispCtx = null; enableRngLog();
        if (refresh && Hallucination()) rn2_on_display_rng(NUMMONS);
        const expected = getRngLog().slice();
        initRng(7); game.dispCtx = null; enableRngLog(); mon.meverseen = 0;
        await action();
        assert.deepEqual(getRngLog(), expected, 'complete display and core sequence');
        assert.equal(!!mon.meverseen, refresh, 'monster redraw is owned by the ESP branch');
    } finally {
        if (oldDisplayLog === undefined) delete globalThis.__rng_log_disp;
        else globalThis.__rng_log_disp = oldDisplayLog;
    }
}

for (const id of [ART_GRAYSWANDIR, ART_STING, ART_ORB_OF_FATE]) {
    test(`pickup ${artifact_names[id]} has no carried ESP redraw`, async () => {
        const mon = await setup(), obj = artifact(id);
        await checkDraws(mon, false, async () => assert.equal(await addinv(obj), obj));
        assert.equal(obj.where, OBJ_INVENT); assert.ok(game.invent.includes(obj));
        assert.equal(game.u.unblind_telepat_range, -1);
    });
    test(`remove ${artifact_names[id]} has no carried ESP redraw`, async () => {
        const mon = await setup(), obj = artifact(id); await addinv(obj);
        await checkDraws(mon, false, () => assert.equal(freeinv(obj), undefined));
        assert.equal(obj.where, OBJ_FREE); assert.ok(!game.invent.includes(obj));
        assert.equal(game.u.unblind_telepat_range, -1);
    });
}

for (const halluc of [false, true]) test(`direct ESP setter refreshes synchronously, hallucination=${halluc}`, async () => {
    const mon = await setup(halluc), obj = artifact(ART_MAGIC_MIRROR_OF_MERLIN);
    await checkDraws(mon, true, () => assert.equal(set_artifact_intrinsic(obj, true, W_ART), undefined));
    assert.equal(game.u.uprops.TELEPAT, W_ART);
    assert.equal(game.u.unblind_telepat_range, BOLT_LIM * BOLT_LIM);
});

test('pickup ESP refreshes exactly once', async () => {
    const mon = await setup(), obj = artifact(ART_ORB_OF_DETECTION);
    await checkDraws(mon, true, async () => assert.equal(await addinv(obj), obj));
    assert.equal(game.u.uprops.TELEPAT, W_ART);
    assert.equal(game.u.unblind_telepat_range, BOLT_LIM * BOLT_LIM);
});
test('removing the final carried ESP source refreshes after clearing its bit', async () => {
    const mon = await setup(), obj = artifact(ART_ORB_OF_DETECTION); await addinv(obj);
    await checkDraws(mon, true, () => assert.equal(freeinv(obj), undefined));
    assert.equal(game.u.uprops.TELEPAT || 0, 0);
    assert.equal(game.u.unblind_telepat_range, -1);
});
test('removing one of two carried ESP sources does not redraw', async () => {
    const mon = await setup(), first = artifact(ART_ORB_OF_DETECTION);
    const retained = artifact(ART_MAGIC_MIRROR_OF_MERLIN);
    await addinv(first); await addinv(retained);
    await checkDraws(mon, false, () => assert.equal(freeinv(first), undefined));
    assert.equal(game.u.uprops.TELEPAT, W_ART);
    assert.equal(game.u.unblind_telepat_range, BOLT_LIM * BOLT_LIM);
    assert.ok(game.invent.includes(retained));
});
test('adding a second carried ESP source still refreshes exactly once', async () => {
    const mon = await setup(), first = artifact(ART_ORB_OF_DETECTION);
    const second = artifact(ART_MAGIC_MIRROR_OF_MERLIN); await addinv(first);
    await checkDraws(mon, true, async () => assert.equal(await addinv(second), second));
    assert.equal(game.u.uprops.TELEPAT, W_ART);
    assert.equal(game.u.unblind_telepat_range, BOLT_LIM * BOLT_LIM);
});
test('removing carried ESP preserves the worn amulet bit and intrinsic source', async () => {
    const mon = await setup(), obj = artifact(ART_ORB_OF_DETECTION);
    const amulet = mksobj(ONAMES.AMULET_OF_ESP, false, false);
    game.u.uamul = amulet; amulet.owornmask = W_AMUL;
    game.u.uprops.TELEPAT = W_AMUL; game.u.intrinsic.HTelepat = FROMOUTSIDE;
    recalc_telepat_range(); await addinv(obj);
    assert.equal(game.u.unblind_telepat_range, 2 * BOLT_LIM * BOLT_LIM);
    await checkDraws(mon, true, () => assert.equal(freeinv(obj), undefined));
    assert.equal(game.u.uprops.TELEPAT, W_AMUL);
    assert.equal(game.u.intrinsic.HTelepat, FROMOUTSIDE);
    assert.equal(game.u.unblind_telepat_range, BOLT_LIM * BOLT_LIM);
});
test('pinned carried warning artifacts cannot require the species-warning refresh', () => {
    const warnings = artifact_records.filter(a => (a.cspfx | 0) & 0x20); // artifact.h:20 SPFX_WARN
    assert.ok(warnings.length);
    for (const art of warnings) assert.equal(art.mtype, '0');
});
