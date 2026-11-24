// C vault.c:317-421. Use real deaths, RNG, vault timers and guard creation.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setImmediate} from 'node:timers/promises';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {invault, findgd, vault_summon_gd, vault_occupied} from '../js/vault.js';
import {makemon} from '../js/makemon.js';
import {mondead, mongone, m_at} from '../js/mon.js';
import {teleds} from '../js/teleport.js';
import {resetInputState} from '../js/input.js';
import {initRng, enableRngLog, getRngLog} from '../js/rng.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {MM_NOMSG, NO_MINVENT, ROOM, CORR, VAULT} from '../js/const.js';
import {in_rooms} from '../js/hack.js';

const foundation = JSON.parse(fs.readFileSync(new URL(
    'gen-sessions/recipes/vault-interrogation-feedback.json', import.meta.url))).segments[0];

async function start() {
    const run = await runSegment({...foundation, moves: foundation.moves.slice(0, 43),
        storage: new InMemoryStorage()});
    game._preNhgetchHook = null;
    resetInputState();
    let reads = 0, letter = 0;
    const pending = [];
    run._display.onEmptyQueue = async () => {
        assert.ok(++reads < 120, 'bounded input through the real display');
        const text = game._toplines || '';
        pending.push({text, timer: game.u.uinvault, guard: findgd()?.m_id});
        await setImmediate();
        if (/Hello stranger|supply your name/.test(text))
            return 'intruder\n'.charCodeAt(letter++);
        return 32;
    };
    assert.equal(game.u.uinvault, 1);
    assert.ok(vault_occupied(game.u.urooms));
    assert.equal(findgd(), null);
    assert.equal(game.mvitals[P.PM_GUARD].died || 0, 0);
    return {run, pending};
}

async function guardDeaths(count, remove = false) {
    for (let i = 0; i < count; ++i) {
        const mon = await makemon(game.mons[P.PM_GUARD],
            game.u.ux, game.u.uy + 1, MM_NOMSG | NO_MINVENT);
        assert.ok(mon && mon.mhp > 0);
        assert.equal(mon.mnum, P.PM_GUARD);
        assert.equal(mon.cham, -1);
        assert.equal(!!mon.isgd, false, 'species death, not fake-corridor disposal');
        if (remove) await mongone(mon);
        else await mondead(mon);
        assert.equal(mon.mhp, 0);
        assert.notEqual(m_at(mon.mx, mon.my), mon, 'detached from the map');
        assert.equal(game.mvitals[P.PM_GUARD].died || 0,
            remove ? 0 : Math.min(i + 1, 255));
    }
}

function resetRng(seed) {
    // Source controls select an actual ISAAC seed after the real producers.
    // Ordinary-input gates never reset RNG or assign a death/timer value.
    initRng(seed);
    enableRngLog();
}

for (const deaths of [0, 1]) {
    await test(`${deaths} guard deaths: advance every turn without a random draw`, async () => {
        await start();
        await guardDeaths(deaths);
        resetRng(5);
        assert.equal(await invault(), undefined);
        assert.equal(game.u.uinvault, 2);
        assert.deepEqual(getRngLog(), []);
        assert.equal(findgd(), null);
    });
}
for (const [deaths, seed, roll, increment] of [
    [2, 5, 0, 1], [2, 1, 1, 0], [3, 0, 0, 1], [3, 2, 7, 0],
]) {
    await test(`${deaths} deaths, roll ${roll}: ${increment ? 'advance' : 'hold'} the real timer`, async () => {
        await start();
        await guardDeaths(deaths);
        resetRng(seed);
        assert.equal(await invault(), undefined);
        assert.equal(game.u.uinvault, 1 + increment);
        assert.deepEqual(getRngLog(), [`rn2(${deaths * deaths})=${roll}`]);
        assert.equal(findgd(), null);
    });
}
await test('49 actual deaths still draw from 2401 possibilities', async () => {
    await start();
    await guardDeaths(49);
    resetRng(1);
    await invault();
    assert.equal(getRngLog().length, 1);
    assert.match(getRngLog()[0], /^rn2\(2401\)=\d+$/);
    assert.notEqual(getRngLog()[0], 'rn2(2401)=0');
    assert.equal(game.u.uinvault, 1);
});
for (const deaths of [50, 51, 256]) {
    await test(`${deaths} real deaths: capped history stops draws and timer increments`, async () => {
        await start();
        await guardDeaths(deaths);
        resetRng(5);
        await invault();
        assert.equal(game.mvitals[P.PM_GUARD].died, Math.min(deaths, 255));
        assert.equal(game.u.uinvault, 1);
        assert.deepEqual(getRngLog(), []);
    });
}
await test('mongone removal does not count as a guard death', async () => {
    await start();
    await guardDeaths(2, true);
    resetRng(1);
    await invault();
    assert.equal(game.u.uinvault, 2);
    assert.deepEqual(getRngLog(), []);
});
await test('leaving the vault resets the timer before consulting death history', async () => {
    await start();
    await guardDeaths(2);
    let target;
    for (let x = 1; x < 79 && !target; ++x)
        for (let y = 0; y < 21 && !target; ++y)
            if ([ROOM, CORR].includes(game.level.at(x, y).typ)
                && !in_rooms(x, y, VAULT)) target = {x, y};
    assert.ok(target);
    await teleds(target.x, target.y, 0);
    assert.equal(vault_occupied(game.u.urooms), 0);
    resetRng(5);
    await invault();
    assert.equal(game.u.uinvault, 0);
    assert.deepEqual(getRngLog(), []);
    vault_summon_gd();
    assert.equal(game.u.uinvault, 0, 'summoning outside the vault is inert');
});

for (const seed of [1, 5]) {
    await test(`summoning after two deaths still obeys the roll, seed ${seed}`, async () => {
        const {pending} = await start();
        await guardDeaths(2);
        vault_summon_gd();
        assert.equal(game.u.uinvault, 29);
        resetRng(seed);
        await invault();
        assert.equal(getRngLog()[0], `rn2(4)=${seed === 5 ? 0 : 1}`);
        if (seed === 1) {
            assert.equal(game.u.uinvault, 29);
            assert.equal(findgd(), null);
            assert.equal(pending.length, 0);
        } else {
            assert.equal(game.u.uinvault, 31, 'arrival adds its second increment');
            assert.ok(findgd());
            assert.ok(pending.some(s => /Hello stranger/.test(s.text) && s.timer === 31));
        }
    });
}

// The real arrival square is (25,5) in this generated vault. Occupy it with
// makemon so the first arrival fails, leaving the timer at the due value 30.
async function dueWithoutGuard() {
    await start();
    const blocker = await makemon(game.mons[P.PM_HUMAN], 25, 5, MM_NOMSG | NO_MINVENT);
    assert.ok(blocker);
    vault_summon_gd();
    await invault();
    assert.equal(game.u.uinvault, 30);
    assert.equal(findgd(), null);
    return blocker;
}
for (const deaths of [2, 50]) {
    await test(`${deaths} deaths: an already-due timer still attempts arrival without an increment`, async () => {
        const blocker = await dueWithoutGuard();
        await mongone(blocker);
        await guardDeaths(deaths);
        resetRng(1);
        await invault();
        assert.equal(game.u.uinvault, 31);
        assert.ok(findgd());
        if (deaths === 2) assert.equal(getRngLog()[0], 'rn2(4)=1');
        else assert.ok(!getRngLog().some(s => s.startsWith('rn2(2500)')));
    });
}
await test('blocked arrival holds the due timer after a failed throttle roll', async () => {
    await dueWithoutGuard();
    await guardDeaths(2);
    resetRng(1);
    await invault();
    assert.equal(game.u.uinvault, 30);
    assert.equal(findgd(), null);
    assert.deepEqual(getRngLog(), ['rn2(4)=1']);
});
for (const seed of [1, 5]) {
    await test(`an existing escort preserves identity after the timer roll, seed ${seed}`, async () => {
        await start();
        vault_summon_gd();
        await invault();
        const guard = findgd();
        assert.ok(guard);
        while (game.u.uinvault < 45) await invault();
        vault_summon_gd();
        assert.equal(game.u.uinvault, 45, 'existing guard prevents summon reset');
        await guardDeaths(2);
        resetRng(seed);
        await invault();
        assert.equal(game.u.uinvault, seed === 5 ? 46 : 45);
        assert.equal(findgd(), guard);
        assert.deepEqual(getRngLog(), [`rn2(4)=${seed === 5 ? 0 : 1}`]);
        assert.equal(game.level.monsters.filter(m => m.isgd && m.mhp > 0).length, 1);
    });
}
