// C mon.c:4698-4801. Real placement/concealment helpers; constructed states.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {GameMap} from '../js/game.js';
import {makemon, hideunder, place_monster, remove_monster} from '../js/makemon.js';
import {maybe_unhide_at, hide_monst, m_at} from '../js/mon.js';
import {set_mon_data} from '../js/mondata.js';
import {m_move} from '../js/monmove.js';
import {find_misc, use_misc, MUSE_POLY_TRAP} from '../js/muse.js';
import {mksobj, place_object} from '../js/mkobj.js';
import {maketrap} from '../js/mklev.js';
import {vision_reset, vision_recalc} from '../js/vision.js';
import {make_blinded} from '../js/potion.js';
import {resetInputState} from '../js/input.js';
import {TOPLINE_EMPTY} from '../js/display.js';
import {initRng, enableRngLog, getRngLog} from '../js/rng.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import {ROOM, STONE, POOL, COLNO, ROWNO, NO_MINVENT, MM_NOGRP, MM_NOMSG,
    BEAR_TRAP, PIT, POLY_TRAP, TT_PIT, MMOVE_MOVED} from '../js/const.js';

const x = 35, y = 10;
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

async function setup(species = P.PM_PIT_VIPER) {
    const run = await runSegment({seed: 7401, datetime: '20000112121000', moves: ' ',
        storage: new InMemoryStorage(),
        nethackrc: 'OPTIONS=name:wizard,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
            + 'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n'});
    game._preNhgetchHook = null;
    resetInputState();
    let acknowledgments = 0;
    run._display.onEmptyQueue = () => { assert.ok(++acknowledgments <= 32); return 32; };
    game.level = new GameMap();
    game.worms = {wheads: {}, wtails: {}, wgrowtime: {}};
    game.regions = []; game.timer_base = []; game.in_mklev = false;
    game.u.ux = 30; game.u.uy = 10;
    for (let xx = 1; xx < COLNO; xx++) for (let yy = 0; yy < ROWNO; yy++)
        Object.assign(game.level.at(xx, yy), {
            typ: xx >= 28 && xx <= 38 && yy >= 8 && yy <= 12 ? ROOM : STONE,
            lit: 1, waslit: 1, seenv: 255, roomno: 0});
    vision_reset(); vision_recalc(0);
    let mon = null;
    if (species !== null) {
        mon = await makemon(game.mons[species], x, y, NO_MINVENT | MM_NOGRP | MM_NOMSG);
        assert.ok(mon);
        mon.mhp = mon.mhpmax = 60;
        mon.mpeaceful = 0; mon.msleeping = 0;
    }
    return {mon, run};
}

async function cover(xx, yy, type = O.DAGGER, quantity = 1, cursed = 0) {
    const obj = mksobj(type, false, false);
    obj.quan = quantity; obj.cursed = cursed;
    await place_object(obj, xx, yy);
    return obj;
}

function move(mon, xx, yy) {
    remove_monster(mon.mx, mon.my);
    place_monster(mon, xx, yy);
}

function resetFeedback() {
    game._toplin = TOPLINE_EMPTY; game._toplines = ''; game._prevmsg = '';
    game._pending_message = ''; game.iflags.last_msg = 0;
    (game.gl ||= {}).last_hider = -1;
    initRng(14); enableRngLog();
}

function clearMonster(mon) {
    return maybe_unhide_at(mon.mx, mon.my);
}

function checkFeedback(label, mon) {
    assert.deepEqual(getRngLog(), []);
    assert.equal(game._prevmsg, '');
    assert.equal(game.iflags.last_msg, 0);
    assert.equal(game.gl.last_hider, -1);
    console.log(JSON.stringify({label, monsterHidden: mon?.mundetected ?? null,
        heroHidden: game.u.uundetected || 0, gridSha256: hash(game.nhDisplay.grid),
        rng: getRngLog()}));
}

const monsterCases = [
    ['cover kept', true], ['moved off cover', false], ['trapped bear', false],
    ['nonpit trap', false], ['pit cover', true], ['trapped pit', false],
    ['nine coins', false], ['ten coins', true], ['coins above dagger', true],
    ['invisible cover loss', false], ['blind cover loss', false],
    ['pet cursed cover', true], ['eel leaves water', false], ['eel keeps water', true],
];
for (const [mode, expected] of monsterCases) test(`monster: ${mode}`, async () => {
    const eel = mode.startsWith('eel');
    const {mon} = await setup(eel ? P.PM_GIANT_EEL : P.PM_PIT_VIPER);
    if (eel) game.level.at(x, y).typ = POOL;
    else await cover(x, y);
    if (mode === 'invisible cover loss') mon.minvis = mon.perminvis = 1;
    assert.equal(await hideunder(mon), true);
    if (mode.includes('cover loss') || mode === 'moved off cover'
        || mode.includes('coins') || mode === 'pet cursed cover' || mode === 'eel leaves water') {
        move(mon, x + 1, y);
        if (mode.includes('coins')) {
            if (mode === 'coins above dagger') await cover(x + 1, y);
            await cover(x + 1, y, O.GOLD_PIECE, mode === 'ten coins' ? 10 : 9);
        }
        if (mode === 'pet cursed cover') {
            mon.mtame = 10;
            await cover(x + 1, y, O.DAGGER, 1, 1);
        }
    }
    if (['trapped bear', 'nonpit trap', 'pit cover', 'trapped pit'].includes(mode)) {
        await maketrap(x, y, mode.includes('pit') && mode !== 'nonpit trap' ? PIT : BEAR_TRAP);
        if (mode.startsWith('trapped')) mon.mtrapped = 1;
    }
    if (mode === 'blind cover loss') await make_blinded(20, false);
    assert.equal(mon.mundetected, 1, 'setup retains concealment until the tested helper');
    assert.equal(mon.data, game.mons[mon.mnum]);
    assert.equal(m_at(mon.mx, mon.my), mon, 'real placement establishes canonical lookup');
    resetFeedback();
    assert.equal(clearMonster(mon), undefined, 'cleanup returns synchronously');
    assert.equal(mon.mundetected, Number(expected));
    checkFeedback(mode, mon);
});

test('a visible ordinary monster is unchanged', async () => {
    const {mon} = await setup(P.PM_GOBLIN);
    resetFeedback();
    assert.equal(clearMonster(mon), undefined);
    assert.equal(!!mon.mundetected, false);
    checkFeedback('ordinary monster', mon);
});

test('a ceiling hider is not an object hider', async () => {
    const {mon} = await setup(P.PM_ROCK_PIERCER);
    initRng(1); // C restrap's first rn2(3) succeeds.
    await hide_monst(mon);
    assert.equal(mon.mundetected, 1);
    resetFeedback();
    assert.equal(clearMonster(mon), undefined);
    assert.equal(mon.mundetected, 1);
    checkFeedback('ceiling hider', mon);
});

for (const mode of ['cover kept', 'cover lost', 'trapped', 'eel water', 'eel land'])
    test(`hero: ${mode}`, async () => {
        await setup(null);
        const eel = mode.startsWith('eel');
        set_mon_data(game.youmonst, game.mons[eel ? P.PM_GIANT_EEL : P.PM_PIT_VIPER]);
        game.u.umonnum = game.youmonst.mnum;
        game.u.mh = game.u.mhmax = 60;
        if (eel) game.level.at(game.u.ux, game.u.uy).typ = POOL;
        else await cover(game.u.ux, game.u.uy);
        assert.equal(hideunder(game.youmonst), true);
        assert.equal(game.u.uundetected, 1);
        if (mode === 'cover lost' || mode === 'eel land') game.u.ux++;
        if (mode === 'trapped') {
            game.u.utrap = 4; game.u.utraptype = TT_PIT;
        }
        assert.equal(m_at(game.u.ux, game.u.uy), null);
        resetFeedback();
        assert.equal(maybe_unhide_at(game.u.ux, game.u.uy), undefined);
        assert.equal(game.u.uundetected, Number(mode === 'cover kept' || mode === 'eel water'));
        checkFeedback(`hero ${mode}`, null);
    });

test('an empty square leaves a hidden hero elsewhere unchanged', async () => {
    await setup(null);
    set_mon_data(game.youmonst, game.mons[P.PM_PIT_VIPER]);
    game.u.umonnum = P.PM_PIT_VIPER;
    await cover(game.u.ux, game.u.uy);
    assert.equal(hideunder(game.youmonst), true);
    resetFeedback();
    assert.equal(maybe_unhide_at(x, y), undefined);
    assert.equal(game.u.uundetected, 1);
    checkFeedback('empty square', null);
});

test('coordinate lookup gives the monster priority over the hero', async () => {
    const {mon} = await setup();
    await cover(x, y);
    assert.equal(await hideunder(mon), true);
    set_mon_data(game.youmonst, game.mons[P.PM_PIT_VIPER]);
    game.u.umonnum = P.PM_PIT_VIPER;
    await cover(game.u.ux, game.u.uy);
    assert.equal(hideunder(game.youmonst), true);
    move(mon, x + 1, y);
    game.u.ux = x + 1; game.u.uy = y;
    assert.equal(m_at(game.u.ux, game.u.uy), mon);
    resetFeedback();
    assert.equal(maybe_unhide_at(game.u.ux, game.u.uy), undefined);
    assert.equal(mon.mundetected, 0);
    assert.equal(game.u.uundetected, 1, 'C m_at arm takes precedence over u_at');
    checkFeedback('monster priority', mon);
});

test('m_move clears concealment before the postmov hiding roll', async () => {
    const {mon} = await setup();
    await cover(x, y);
    assert.equal(await hideunder(mon), true);
    resetFeedback(); initRng(11); enableRngLog();
    const result = await m_move(mon, 0);
    assert.equal(result, MMOVE_MOVED);
    assert.notDeepEqual([mon.mx, mon.my], [x, y]);
    assert.equal(m_at(mon.mx, mon.my), mon);
    assert.equal(mon.mundetected, 0);
    assert.equal(getRngLog().filter(s => /^rn2\(5\)=/.test(s)).length, 1,
        'C postmov spends its hiding roll after movement cleanup');
});

test('find_misc supplies the real deliberate polymorph-trap route', async () => {
    const {mon} = await setup(P.PM_GOBLIN);
    await maketrap(x - 1, y, POLY_TRAP);
    mon.mux = game.u.ux; mon.muy = game.u.uy;
    assert.equal(find_misc(mon), true);
    assert.equal(game.m.has_misc, MUSE_POLY_TRAP);
    assert.deepEqual([game.trapx, game.trapy], [x - 1, y]);
    assert.equal(game.m.misc, null);
    resetFeedback();
    assert.equal(await use_misc(mon), 2);
    assert.deepEqual([mon.mx, mon.my], [x - 1, y]);
    assert.equal(m_at(mon.mx, mon.my), mon);
    assert.equal(mon.data, game.mons[mon.mnum]);
    assert.equal(!!mon.mundetected, false);
});
