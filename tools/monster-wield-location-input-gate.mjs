// Actual ordinary producers. The historical physical-control label is kept in
// the immutable C tuples; that case is a positive for located wield feedback.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {decodeScreen, renderCell} from '../frozen/screen-decode.mjs';
import {PMNAMES as P, ATTKS as A} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import {boolean_option} from '../js/options.js';
import {NEED_WEAPON, W_WEP, MSLOW} from '../js/const.js';
const recipe = JSON.parse(readFileSync(new URL('gen-sessions/recipes/monster-slow-touch-completion.json', import.meta.url)));

for (const [i, part] of recipe.segments.entries()) test(`ordinary wield reach: ${part.name}`, async () => {
    const rows = [], prior = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    let run;
    try {
        globalThis.__step_snapshot = {step: '*', cb(g, step) {
            rows.push({step, accessible: g.flags.accessiblemsg, hp: g.u.uhp, mortality: g.u.umortality || 0,
                monsters: g.level.monsters.map(m => ({id: m.m_id, species: m.mnum,
                    canonical: m.data === g.mons[m.mnum], hp: m.mhp, speed: m.mspeed,
                    weapon: m.mw?.otyp, mask: m.mw?.owornmask || 0, check: m.weapon_check,
                    inventoryContainsWeapon: !!m.mw && m.minvent.includes(m.mw)}))});
        }};
        run = await runSegment({...part, storage: new InMemoryStorage()});
    } finally {
        if (prior) Object.defineProperty(globalThis, '__step_snapshot', prior);
        else delete globalThis.__step_snapshot;
    }
    const species = i === 2 ? P.PM_OGRE : P.PM_OGRE_TYRANT;
    const state = step => rows.find(r => r.step === step).monsters.find(m => m.species === species);
    const completed = state(i === 2 ? 42 : i === 1 ? 49 : 48);
    assert.ok(completed.canonical && completed.inventoryContainsWeapon);
    assert.equal(completed.weapon, O.CLUB); assert.equal(completed.mask, W_WEP);
    assert.equal(completed.check, NEED_WEAPON); assert.equal(completed.speed, i === 2 ? 0 : MSLOW);
    assert.ok(rows.every(r => r.hp > 0 && r.mortality === 0));
    assert.ok(rows.every(r => r.accessible === (i !== 0)));
    const top = step => decodeScreen(run.getScreens()[step])[0].map(renderCell).join('');
    if (i === 0) {
        assert.match(top(48), /^The ogre king wields a club!/);
        assert.doesNotMatch(top(48), /southwest/);
    } else if (i === 1) {
        const pending = state(48);
        assert.equal(pending.weapon, O.CLUB); assert.equal(pending.mask, 0);
        assert.equal(pending.check, NEED_WEAPON); assert.equal(pending.hp, 24);
        assert.match(top(48), /^\(southwest\): The ogre king slows down\.--More--/);
        assert.match(top(49), /^\(southwest\): The ogre king wields a club!/);
    } else {
        assert.match(top(42), /The large cat bites the ogre\.  \(southeast\): The ogre wields a club!/);
        assert.doesNotMatch(top(42), /slows down|moving slower/);
    }
});

test('immutable combined negative has no accessibility prefixes or slow-attack producer', async () => {
    const raw = readFileSync(new URL('gen-sessions/generated/monster-damage-type-dispatch.session.json', import.meta.url));
    assert.equal(createHash('sha256').update(raw).digest('hex'),
        '77a02731f8ad89302ac5cb2d484cda4714ee2b25f7d913f4497985af99931330');
    const native = JSON.parse(raw); assert.equal(native.source, 'c'); assert.equal(native.version, 5);
    let observations = 0;
    for (const part of native.segments) {
        const prior = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
        try {
            globalThis.__step_snapshot = {step: '*', cb(g) {
                observations++; assert.equal(boolean_option('accessiblemsg'), false);
                assert.ok(g.level.monsters.every(m => m.data === g.mons[m.mnum]
                    && !m.data.mattk.some(a => a[1] === A.AD_SLOW)));
            }};
            await runSegment({...part, storage: new InMemoryStorage()});
        } finally {
            if (prior) Object.defineProperty(globalThis, '__step_snapshot', prior);
            else delete globalThis.__step_snapshot;
        }
    }
    assert.equal(observations, 190);
});
