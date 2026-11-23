// C artifact.c:787-797 contracts through the actual artifact setter.
// Constructed source checks, not native-input coverage evidence.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { set_artifact_intrinsic } from '../js/artifact.js';
import { mksobj } from '../js/mkobj.js';
import { addinv, obj_extract_self } from '../js/invent.js';
import { Hallucination } from '../js/youprop.js';
import { ONAMES } from '../js/objects_data.js';
import { ART_GRAYSWANDIR, artifact_records, artifact_names } from '../js/artilist_data.js';
import { W_ART, W_WEP, W_SWAPWEP, W_QUIVER, W_ARM, FROMFORM, M_AP_OBJECT, ROOM,
    IN_SIGHT, COULD_SEE } from '../js/const.js';
import { initRng, enableRngLog, getRngLog } from '../js/rng.js';

const SPFX_HALRES = 0x800; // include/artifact.h
const base = JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/command-result-flags.json', import.meta.url))).segments[0];
let prompts;
let statusWrites;
async function setup(sample) {
    const run = await runSegment({ ...base, moves: ' ', storage: new InMemoryStorage() });
    prompts = [];
    run._display.onEmptyQueue = () => {
        const text = game.nhDisplay.grid[0].map(c => c.ch).join('').trimEnd();
        prompts.push(text);
        if (prompts.length > 30) throw Error('unexpected repeated prompt');
        return text.includes('--More--') ? 32 : 0x1b;
    };
    game._preNhgetchHook = null;
    game.level.monsters = []; game.level.monAt.clear();
    for (const obj of [...game.level.objects]) obj_extract_self(obj);
    game.level.traps = []; game.regions = []; game.timer_base = []; game.invent = [];
    game.u.intrinsic = {}; game.u.uprops = {}; game.u.blocked = {};
    game.u.ublindf = null; game.u.uwep = null; game.u.uball = null; game.u.uchain = null;
    game.u.uswapwep = null; game.u.uquiver = null;
    game.u.uswallow = false; game.u.ustuck = null; game.u.uswldtim = 0;
    game.u.ux = 31; game.u.uy = 10;
    game.u.usleep = 0; game.multi = 0; game.warn_obj_cnt = 0;
    game.eatmbuf = null; game.nomovemsg = null;
    game.youmonst.m_ap_type = 0; game.youmonst.mappearance = 0;
    for (let x = 26; x <= 36; x++) for (let y = 5; y <= 15; y++) {
        Object.assign(game.level.at(x, y), { typ: ROOM, lit: 1, waslit: 1, seenv: 255, roomno: 0 });
        game.viz_array[y][x] = IN_SIGHT | COULD_SEE;
    }
    const obj = mksobj(ONAMES.SILVER_SABER, false, false);
    if (!sample.ordinary) { obj.oartifact = ART_GRAYSWANDIR; obj.oname = 'Grayswandir'; }
    await addinv(obj);
    game.u.intrinsic.HHallucination = game.u.uprops.HALLUC = sample.old;
    game.u.intrinsic.HHalluc_resistance = sample.intrinsic || 0;
    game.u.uprops.HALLUC_RES = sample.before;
    game.u.intrinsic.HBlinded = sample.blind ? 9 : 0;
    game.u.ublind = sample.blind ? 1 : 0;
    if (sample.unaware) { game.u.usleep = 1; game.multi = -3; }
    game.program_state.restoring = !!sample.restoring;
    if (sample.mask !== W_ART) {
        if (!sample.mask || sample.mask === W_WEP) game.u.uwep = obj;
        obj.owornmask = sample.on ? (sample.mask || W_WEP) : 0;
    }
    if (sample.mimic) {
        game.eatmbuf = game.nomovemsg = 'Your rind escaped intact.';
        game.youmonst.m_ap_type = M_AP_OBJECT; game.youmonst.mappearance = ONAMES.ORANGE;
        game.multi = -8;
    }
    game.disp.botl = false;
    statusWrites = [];
    let dirty = false;
    Object.defineProperty(game.disp, 'botl', {
        configurable: true, enumerable: true,
        get() { return dirty; },
        set(value) { dirty = value; statusWrites.push(value); },
    });
    game._toplines = ''; game._msg_history = []; game._toplin = 0;
    game._pending_message = ''; game._win_stop = false;
    initRng(3); enableRngLog();
    return obj;
}
async function invoke(obj, on, mask) {
    const art = artifact_records[obj.oartifact || 0];
    const spfx = mask === W_ART ? art.cspfx : art.spfx;
    if (spfx & SPFX_HALRES)
        assert.equal(obj.oartifact, ART_GRAYSWANDIR);
    await set_artifact_intrinsic(obj, on, mask);
}
function messages() { return [...prompts, ...game._msg_history, game._toplines].join('\n').replace(/\s+/g, ' ').trim(); }

test('pinned artifact table has one worn HALRES source and no carried source', () => {
    assert.deepEqual(artifact_records.flatMap((a, i) => a.spfx & SPFX_HALRES ? [artifact_names[i]] : []), ['Grayswandir']);
    assert.deepEqual(artifact_records.flatMap((a, i) => a.cspfx & SPFX_HALRES ? [artifact_names[i]] : []), []);
});

for (const sample of [
    { name: 'wield with active timer', on: true, old: 7, before: 0, after: W_WEP, text: /Everything looks SO boring/, dirty: true },
    { name: 'unwield with active timer', on: false, old: 7, before: W_WEP, after: 0, text: /Everything looks so cosmic/, dirty: true },
    { name: 'blind wield', on: true, old: 7, before: 0, after: W_WEP, blind: true, text: /Everything feels SO boring/, dirty: true },
    { name: 'blind unwield', on: false, old: 7, before: W_WEP, after: 0, blind: true, text: /Everything feels so cosmic/, dirty: true },
    { name: 'restoring wield is quiet but redraws', on: true, old: 7, before: 0, after: W_WEP, restoring: true, dirty: true },
    { name: 'restoring unwield is quiet but redraws', on: false, old: 7, before: W_WEP, after: 0, restoring: true, dirty: true },
    { name: 'unaware wield is quiet but redraws', on: true, old: 7, before: 0, after: W_WEP, unaware: true, dirty: true },
    { name: 'intrinsic resistance survives wield', on: true, old: 7, before: 0, after: W_WEP, intrinsic: FROMFORM, text: /Everything looks SO boring/, dirty: true },
    { name: 'gold armor survives unwield', on: false, old: 7, before: W_WEP | W_ARM, after: W_ARM, text: /Everything looks so cosmic/, dirty: true },
    { name: 'wield without timer', on: true, old: 0, before: 0, after: W_WEP },
    { name: 'unwield without timer', on: false, old: 0, before: W_WEP, after: 0 },
    { name: 'carried addition has no HALRES', on: true, old: 7, before: 0, after: 0, mask: W_ART },
    { name: 'carried removal preserves wielded mask', on: false, old: 7, before: W_WEP, after: W_WEP, mask: W_ART },
    { name: 'setnotworn secondary mask still announces the change', on: false, old: 7, before: 0, after: 0, mask: W_SWAPWEP, text: /Everything looks so cosmic/, dirty: true },
    { name: 'setnotworn quiver mask still announces the change', on: false, old: 7, before: 0, after: 0, mask: W_QUIVER, text: /Everything looks so cosmic/, dirty: true },
    { name: 'ordinary saber has no HALRES', on: true, old: 7, before: 0, after: 0, ordinary: true },
    { name: 'resistance repairs deferred orange mimicry', on: true, old: 7, before: 0, after: W_WEP, restoring: true, mimic: true, dirty: true },
]) test(sample.name, async () => {
    const obj = await setup(sample);
    await invoke(obj, sample.on, sample.mask || W_WEP);
    assert.equal(game.u.uprops.HALLUC_RES || 0, sample.after);
    assert.equal(game.u.intrinsic.HHallucination, sample.old);
    assert.equal(game.u.uprops.HALLUC, sample.old);
    assert.equal(game.u.intrinsic.HHalluc_resistance, sample.intrinsic || 0);
    assert.equal(Hallucination(), !!sample.old && !sample.after && !sample.intrinsic);
    if (sample.text) assert.match(messages(), sample.text); else assert.equal(messages(), '');
    assert.equal(statusWrites.includes(true), !!sample.dirty);
    if (sample.mimic) {
        assert.equal(game.youmonst.mappearance, ONAMES.GOLD_PIECE);
        assert.equal(game.nomovemsg, 'You now prefer mimicking yourself.');
        assert.equal(game.eatmbuf, game.nomovemsg);
        assert.equal(game.multi, -8);
    }
    assert.deepEqual(getRngLog(), []);
});
