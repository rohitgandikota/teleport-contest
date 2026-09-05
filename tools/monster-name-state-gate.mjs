#!/usr/bin/env node

// C do_mgivenname/christen_monst state beyond the paired terminal recordings.
// The formatting controls below are valid source states, not new C scenarios.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { InMemoryStorage } from '../js/storage.js';
import { christen_monst, x_monnam, distant_monnam } from '../js/do_name.js';
import { mon_aligntyp } from '../js/priest.js';
import { show_topl_nohistory } from '../js/tty/topl.js';
import { PMNAMES as P } from '../js/monst_data.js';
import { MGIVENNAME, has_mgivenname, NON_PM, ARTICLE_A, ARTICLE_THE,
         ARTICLE_NONE, EXACT_NAME, SUPPRESS_NAME, SUPPRESS_IT,
         M_AP_MONSTER, SUPPRESS_MAPPEARANCE, KILLED_BY, A_NONE } from '../js/const.js';

const recipe = name => JSON.parse(readFileSync(new URL(
    `gen-sessions/recipes/${name}.json`, import.meta.url), 'utf8'));
const editing = recipe('monster-name-editing');
const names = ['Pebble', '', 'Pebble', 'Pebble', 'Q'.repeat(62), '', '', ''];
for (const [i, segment] of editing.segments.entries()) {
    const trace = [];
    globalThis.__step_snapshot = { step: '*', cb: state => {
        if (state.killer?.name)
            trace.push({ ...state.killer });
    } };
    try {
        await runSegment({ ...segment, storage: new InMemoryStorage() });
    } finally {
        delete globalThis.__step_snapshot;
    }
    const mon = game.level.monsters.find(m => m.mnum === P.PM_COCKATRICE);
    assert.ok(mon, segment.name);
    assert.equal(MGIVENNAME(mon) || '', names[i], segment.name);
    assert.equal(has_mgivenname(mon), !!names[i], segment.name);
    if (i < 5)
        assert.equal(mon.mextra.mcorpsenm, NON_PM, 'name allocation initializes mextra');
    if (i === 0)
        assert.ok(trace.some(k => k.format === KILLED_BY
            && k.name === 'being hit by a hurtling cockatrice'),
        'petrification keeps the species in the killer record and preserves Pebble on the monster');
}

const guards = recipe('monster-name-guards');
const species = [P.PM_ORACLE, P.PM_ORACLE, P.PM_ORACLE, P.PM_JUIBLEX, P.PM_JUIBLEX,
    P.PM_DEATH, P.PM_DEATH, P.PM_GHOST, P.PM_GHOST, P.PM_ANGEL,
    P.PM_ALIGNED_CLERIC, P.PM_ALIGNED_CLERIC, P.PM_ALIGNED_CLERIC, P.PM_HIGH_CLERIC,
    P.PM_SHOPKEEPER, P.PM_SHOPKEEPER, P.PM_SHOPKEEPER, P.PM_SHOPKEEPER, P.PM_COCKATRICE];
let cleric, shopkeeper, ordinary;
for (const [i, segment] of guards.segments.entries()) {
    await runSegment({ ...segment, storage: new InMemoryStorage() });
    const mon = game.level.monsters.find(m => m.mnum === species[i]);
    assert.ok(mon, segment.name);
    const expected = i === 7 || i === 8 ? 'Emile' : i === 9 ? 'Pebble' : '';
    assert.equal(MGIVENNAME(mon) || '', expected, segment.name + ': retained name');
    if (i >= 10 && i <= 13) {
        assert.equal(mon.isminion, 1, 'ordinary cleric becomes a roamer');
        assert.equal(mon.emin, mon.mextra.emin, 'one minion extension');
        assert.equal(mon.emin.parentmid, mon.m_id, 'extension points back to its monster');
        assert.equal(mon.emin.min_align, i === 13 ? 1 : 0, 'C-recorded deity alignment');
        assert.equal(mon.emin.renegade, i !== 13, 'C-recorded renegade status');
    }
    if (i === 10) cleric = mon;
    if (i === 14) shopkeeper = mon;
    if (i === 18) ordinary = mon;
}

// Use the final C-created Healer level for source formatting controls. These
// bypass visibility only where C's caller explicitly requests SUPPRESS_IT.
game.u.uprops.HALLUC = 0;
const forced = SUPPRESS_IT;
const named = { ...ordinary, mextra: null, mgivenname: null };
christen_monst(named, 'James');
assert.equal(x_monnam(named, ARTICLE_THE, null, forced, false), 'James');
assert.equal(x_monnam(named, ARTICLE_THE, null, forced | SUPPRESS_NAME, false), 'the cockatrice');
const ghost = { ...named, mnum: P.PM_GHOST, data: game.mons[P.PM_GHOST] };
assert.equal(x_monnam(ghost, ARTICLE_THE, null, forced, false), "James' ghost");
const player = { ...named, mnum: P.PM_MONK, data: game.mons[P.PM_MONK], mgivenname: 'Alex the Seeker' };
assert.equal(x_monnam(player, ARTICLE_THE, 'angry', forced, false), 'Alex the angry Seeker');
const disguised = { ...ordinary, m_ap_type: M_AP_MONSTER, mappearance: P.PM_NEWT };
assert.equal(x_monnam(disguised, ARTICLE_A, null, forced, false), 'a newt');
assert.equal(x_monnam(disguised, ARTICLE_A, null, forced | SUPPRESS_MAPPEARANCE, false), 'a cockatrice');

const unusualShopkeeper = { ...shopkeeper, data: game.mons[P.PM_BLUE_DRAGON], mnum: P.PM_BLUE_DRAGON };
assert.equal(x_monnam(unusualShopkeeper, ARTICLE_THE, 'angry', forced, false), 'the angry Upernavik');
assert.equal(x_monnam(unusualShopkeeper, ARTICLE_THE, null, forced, false), 'Upernavik the blue dragon');

cleric.minvis = 1;
game.u.uprops.HALLUC = 30;
const beforeMon = structuredClone(cleric), beforeProps = { ...game.u.uprops };
assert.equal(x_monnam(cleric, ARTICLE_THE, null, EXACT_NAME, false), 'the renegade priest of Hermes');
assert.deepEqual(cleric, beforeMon, 'exact priest naming restores every monster field');
assert.deepEqual(game.u.uprops, beforeProps, 'exact priest naming restores hero properties');
game.program_state_gameover = true;
assert.equal(x_monnam(ordinary, ARTICLE_A, null, 0, false), 'a cockatrice');
game.program_state_gameover = false;
game.u.uprops.HALLUC = 0;

const high = { ...cleric, mnum: P.PM_HIGH_CLERIC, data: game.mons[P.PM_HIGH_CLERIC],
    isminion: 0, ispriest: 1, female: 0, minvis: 0, epri: { shralign: 1 },
    mx: game.u.ux + 5, my: game.u.uy };
game.u.uz = { ...game.astral_level };
assert.equal(distant_monnam(high, ARTICLE_THE), 'the high priest');
assert.equal(x_monnam(high, ARTICLE_THE, null, SUPPRESS_IT, false), 'the high priest');
assert.equal(x_monnam(high, ARTICLE_NONE, null, EXACT_NAME, false), 'high priest of Athena');
for (const [value, expected] of [[-5, -1], [7, 1], [0, 0], [A_NONE, A_NONE]])
    assert.equal(mon_aligntyp({ data: { maligntyp: value } }), expected);

// C topl_putsym/addtopl: reserve column 79 and clear to the end of the line,
// including when the final character is a newline or backspace.
game._win_stop = false;
show_topl_nohistory('Q'.repeat(80));
assert.equal(game._topline_physical_prefix, 'Q'.repeat(79) + '\nQ');
show_topl_nohistory('Alpha\n');
assert.equal(game._topline_physical_prefix, 'Alpha\n');
assert.equal(game._topl_cury, 1);
assert.equal(game._topl_curx, 0);
show_topl_nohistory('AB\b');
assert.equal(game._topline_physical_prefix, 'A');

console.log('monster name state: PASS (27 C scenarios plus source formatting controls)');
