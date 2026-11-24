// Constructed C-contract controls through real wizard menus, polymorph,
// terrain wishes, timeout processing and full save/restore. No helper mocks.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {test} from 'node:test';
import {setImmediate} from 'node:timers/promises';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {wiz_intrinsic} from '../js/wizcmds.js';
import {nh_timeout} from '../js/timeout.js';
import {polymon, rehumanize} from '../js/polyself.js';
import {Passes_walls} from '../js/youprop.js';
import {stuck_in_wall} from '../js/pray.js';
import {teleds} from '../js/teleport.js';
import {readobjnam} from '../js/objnam.js';
import {dosave0, dorecover} from '../js/save.js';
import {resetInputState} from '../js/input.js';
import {getRngLog} from '../js/rng.js';
import {PMNAMES} from '../js/monst_data.js';
import {TIMEOUT, FROMFORM, ECMD_OK} from '../js/const.js';
import {decodeScreen} from '../frozen/screen-decode.mjs';

const recipe = JSON.parse(fs.readFileSync(new URL(
    'gen-sessions/recipes/vault-corridor-destination.json', import.meta.url)));
const state = () => game.u.intrinsic?.HPasses_walls || 0;
const warnings = ['You start to feel bloated.', 'You are feeling rather flabby.'];
async function setup() {
    const run = await runSegment({...recipe.segments[0], moves: ' ',
        storage: new InMemoryStorage()});
    game._preNhgetchHook = null;
    resetInputState();
    run._display.clearInputQueue();
    let reads = 0;
    run._display.onEmptyQueue = async () => {
        assert.ok(++reads < 100, 'bounded real prompt acknowledgments');
        await setImmediate();
        return 32;
    };
    return run;
}

// Read the actual menu and send ordinary keyboard events. Pending startup or
// feedback prompts are acknowledged before menu selection, not bypassed.
async function grant(run, amount, name = 'pass thru walls', cancel = false) {
    const prior = run._display.onEmptyQueue;
    let reads = 0, selected = false, menuRow = '', pending = [];
    const rng = [...getRngLog()];
    try {
        run._display.onEmptyQueue = async () => {
            assert.ok(++reads < 100, 'bounded real wizard menu input');
            await setImmediate();
            if (pending.length)
                return pending.shift().charCodeAt(0);
            const lines = decodeScreen(run._display.terminal.serialize())
                .map(row => row.map(c => c.ch).join('').trimEnd());
            if (!selected) {
                menuRow = lines.find(line => /^ *[a-zA-Z] [-+] /.test(line)
                    && line.includes(name)) || '';
                if (menuRow) {
                    selected = true;
                    const letter = menuRow.match(/^ *([a-zA-Z])/)[1];
                    pending = Array.from(cancel ? '\x1b'
                        : `${amount ?? ''}${letter}\r`);
                    return pending.shift().charCodeAt(0);
                }
                if (lines.some(line => /\(\d+ of \d+\)/.test(line)))
                    return '>'.charCodeAt(0);
            }
            return 32;
        };
        assert.equal(await wiz_intrinsic(), ECMD_OK);
        assert.ok(selected, 'the requested property is selected in the real menu');
        assert.equal(pending.length, 0);
        assert.deepEqual(getRngLog(), rng, 'the producer adds no RNG calls');
        return {menuRow, message: game._toplines || ''};
    } finally {
        run._display.onEmptyQueue = prior;
    }
}

function canonical(expected) {
    assert.equal(state(), expected);
    assert.equal(Object.hasOwn(game.u.uprops || {}, 'PASSES_WALLS'), false,
        'intrinsic does not masquerade as an extrinsic');
    assert.equal(Object.hasOwn(game.u.wiz_intrinsic_timeouts || {}, 'PASSES_WALLS'), false);
    assert.equal(Object.hasOwn(game.u.wiz_intrinsic_base_props || {}, 'PASSES_WALLS'), false);
}

async function ticks(count) {
    const rng = [...getRngLog()], rows = [];
    for (let tick = 0; tick < count; tick++) {
        await nh_timeout();
        rows.push({word: state(), message: game._toplines || '', effect: Passes_walls()});
    }
    assert.deepEqual(getRngLog(), rng, 'these status-only expiries add no RNG');
    return rows;
}

await test('default menu grant uses only the canonical intrinsic, before feedback', async () => {
    const run = await setup(), result = await grant(run);
    canonical(30);
    assert.ok(Passes_walls());
    assert.ok(result.message.includes('Timeout for pass thru walls set to 30.'));
});

await test('repeated grants read the canonical menu count and increment it', async () => {
    const run = await setup();
    await grant(run, 11);
    const second = await grant(run, 7);
    canonical(18);
    assert.match(second.menuRow, /pass thru walls +\[11\]/);
    assert.ok(second.message.includes('Timeout for pass thru walls increased by 7.'));
});

await test('timeout addition saturates at the C mask while feedback keeps the requested amount', async () => {
    const run = await setup();
    await grant(run, TIMEOUT - 1);
    const result = await grant(run, 5);
    canonical(TIMEOUT);
    assert.ok(result.menuRow.includes(`[${TIMEOUT - 1}]`));
    assert.ok(result.message.includes('increased by 5.'));
});

await test('real xorn form flags survive a grant and timeout saturation', async () => {
    const run = await setup();
    assert.equal(await polymon(PMNAMES.PM_XORN), 1);
    assert.equal(state(), FROMFORM);
    await grant(run, TIMEOUT - 1);
    const result = await grant(run, 7);
    canonical(FROMFORM | TIMEOUT);
    assert.ok(result.menuRow.includes(`[${TIMEOUT - 1}]`), 'menu masks the form bit');
    assert.ok(Passes_walls());
});

await test('warnings precede the decrement, followed by normal-self expiry', async () => {
    const run = await setup();
    await grant(run, 5);
    const rows = await ticks(5);
    assert.deepEqual(rows.map(r => r.word), [4, 3, 2, 1, 0]);
    assert.ok(rows[0].message.includes(warnings[0]));
    assert.ok(!rows[1].message.includes(warnings[1]));
    assert.ok(rows[2].message.includes(warnings[1]));
    assert.ok(rows[4].message.includes("You're back to your normal self again."));
    assert.deepEqual(rows.map(r => r.effect), [true, true, true, true, false]);
    canonical(0);
});

await test('a lasting xorn form suppresses both warnings and timer-expiry feedback', async () => {
    const run = await setup();
    await polymon(PMNAMES.PM_XORN);
    await grant(run, 5);
    const rows = await ticks(5);
    assert.deepEqual(rows.map(r => r.word & TIMEOUT), [4, 3, 2, 1, 0]);
    assert.ok(rows.every(r => r.effect && (r.word & FROMFORM)));
    assert.ok(rows.every(r => !warnings.some(m => r.message.includes(m))
        && !r.message.includes('self again.') && !r.message.includes('hemmed in')));
    canonical(FROMFORM);
    await rehumanize();
    canonical(0);
    assert.equal(Passes_walls(), false);
});

await test('losing a wall-passing form preserves the independent wizard duration', async () => {
    const run = await setup();
    await polymon(PMNAMES.PM_XORN);
    await grant(run, 5);
    await polymon(PMNAMES.PM_GNOME);
    canonical(5);
    assert.equal(game.u.umonnum, PMNAMES.PM_GNOME);
    const rows = await ticks(5);
    assert.ok(rows[0].message.includes(warnings[0]));
    assert.ok(rows[2].message.includes(warnings[1]));
    assert.ok(rows[4].message.includes("You're back to your unusual self again."));
    canonical(0);
});

await test('real enclosing terrain chooses hemmed-in expiry, not normal-self feedback', async () => {
    const run = await setup();
    const [x, y] = [game.u.ux, game.u.uy];
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        if (!dx && !dy) continue;
        await teleds(x + dx, y + dy, 0);
        await readobjnam('wall', null);
    }
    await teleds(x, y, 0);
    assert.ok(stuck_in_wall());
    await grant(run, 1);
    assert.equal(stuck_in_wall(), false, 'active phasing makes the enclosure escapable');
    const [expired] = await ticks(1);
    canonical(0);
    assert.ok(stuck_in_wall());
    assert.ok(expired.message.includes('You feel hemmed in again.'));
    assert.ok(!expired.message.includes('self again.'));
});

for (const form of [false, true]) {
    await test(`full save/restore preserves ${form ? 'form plus timer' : 'timer alone'} and its real expiry`, async () => {
        const run = await setup();
        if (form) await polymon(PMNAMES.PM_XORN);
        await grant(run, 5);
        await ticks(1);
        const word = (form ? FROMFORM : 0) | 4;
        canonical(word);
        assert.equal(await dosave0(), true);
        assert.equal(await dorecover(), true);
        canonical(word);
        const rows = await ticks(4);
        canonical(form ? FROMFORM : 0);
        assert.equal(Passes_walls(), form);
        if (form) assert.ok(!rows.at(-1).message.includes('self again.'));
        else assert.ok(rows.at(-1).message.includes("You're back to your normal self again."));
    });
}

await test('a grant after restoration reads the restored canonical count', async () => {
    const run = await setup();
    await grant(run, 9);
    assert.equal(await dosave0(), true);
    assert.equal(await dorecover(), true);
    const result = await grant(run, 4);
    canonical(13);
    assert.match(result.menuRow, /pass thru walls +\[9\]/);
    assert.ok(result.message.includes('increased by 4.'));
});

await test('an expired timer is not resurrected by full restore', async () => {
    const run = await setup();
    await grant(run, 1);
    await ticks(1);
    assert.equal(await dosave0(), true);
    assert.equal(await dorecover(), true);
    canonical(0);
    assert.equal(Passes_walls(), false);
});

await test('cancelled ordinary menu makes no property or RNG change', async () => {
    const run = await setup();
    const before = structuredClone(game.u.intrinsic);
    await grant(run, undefined, 'pass thru walls', true);
    assert.deepEqual(game.u.intrinsic, before);
    canonical(0);
});

await test('the shared magical-breathing branch keeps its own canonical timer', async () => {
    const run = await setup();
    const result = await grant(run, 5, 'magical breathing');
    assert.equal(game.u.intrinsic.HMagical_breathing & TIMEOUT, 5);
    canonical(0);
    assert.ok(result.message.includes('Timeout for magical breathing set to 5.'));
    await ticks(5);
    assert.equal(game.u.intrinsic.HMagical_breathing & TIMEOUT, 0);
    assert.equal(Passes_walls(), false);
});
