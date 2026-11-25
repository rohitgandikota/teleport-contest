// Real line, message and command producers. Input snapshots only read state.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setImmediate} from 'node:timers/promises';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {getlin, hooked_tty_getlin} from '../js/cmd.js';
import {resetInputState} from '../js/input.js';
import {getRngLog} from '../js/rng.js';
import {pline, display_nhwindow_message, TOPLINE_EMPTY} from '../js/display.js';

const base = {
    seed: 9770, datetime: '20000112093000', moves: ' ',
    nethackrc: 'OPTIONS=name:wizard,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
        + 'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n'
        + 'OPTIONS=suppress_alert:3.4.3\nOPTIONS=!eight_bit_tty\nOPTIONS=symset:plain\n',
};
const line = (run, row = 0) => run._display.grid[row].map(cell => cell.ch).join('').trimEnd();
function snapshot(run) {
    return {inread: game.ttyDisplay?.inread || 0,
        inGetlin: game.program_state.in_getlin || 0, bot: !!game.bot_disabled,
        logical: game._toplines, visible: line(run), cursor: [run._display.cursorCol, run._display.cursorRow, run._display.cursorVisible],
        pending: game._pending_message, toplin: game._toplin,
        history: [...(game._msg_history || [])], maxrow: game._msg_maxrow || 0,
        maxcol: game._msg_maxcol || 0};
}
function feed(run, keys) {
    const states = [];
    let used = 0;
    run._display.onEmptyQueue = async () => {
        await setImmediate();
        states.push(snapshot(run));
        assert.ok(used < keys.length, 'unexpected physical input read');
        return keys.charCodeAt(used++);
    };
    return states;
}
async function boot(messages = []) {
    const run = await runSegment({...base, storage: new InMemoryStorage()});
    resetInputState();
    feed(run, ' '.repeat(20));
    await display_nhwindow_message();
    for (const message of messages) {
        await pline(message);
        await display_nhwindow_message();
    }
    return run;
}
async function answer(run, keys, query = 'Name?', suppress = false, core = false) {
    const before = [...getRngLog()], states = feed(run, keys);
    const value = core ? await getlin(query) : await hooked_tty_getlin(query, undefined, suppress);
    assert.deepEqual(getRngLog(), before);
    assert.equal(states.length, keys.length);
    return {value, states, after: snapshot(run)};
}

for (const core of [false, true]) await test(`pending ${core ? 'core' : 'direct tty'} reader retains its lifetime`, async () => {
    const run = await boot();
    const before = snapshot(run);
    const result = await answer(run, 'Text\n', 'Name?', false, core);
    assert.equal(result.value, 'Text');
    assert.ok(result.states.every(s => s.inread === 1));
    assert.ok(result.states.every(s => s.inGetlin === (core ? 1 : before.inGetlin)));
    assert.ok(result.states.every(s => s.bot === (core || before.bot)));
    assert.equal(result.after.inread, 0);
    assert.equal(result.after.inGetlin, before.inGetlin);
    assert.equal(result.after.bot, before.bot);
    assert.equal(result.after.toplin, TOPLINE_EMPTY);
    assert.equal(result.after.visible, '');
});

for (const [name, keys, expected] of [
    ['kill replaces the complete line', 'Edge\x15New\n', 'New'],
    ['kill at the beginning keeps reading', '\x15Arrow\n', 'Arrow'],
    ['kill then Enter returns an empty answer', 'Edge\x15\n', ''],
    ['DEL erases one byte', 'Edge\x7fX\n', 'EdgX'],
    ['backspace erases one byte', 'Edge\bX\n', 'EdgX'],
    ['ESC clears text before cancelling', 'Edge\x1b\x1b', '\x1b'],
    ['FF cancels typed text', 'Edge\xff', '\x1b'],
    ['empty FF cancels', '\xff', '\x1b'],
]) await test(name, async () => {
    const run = await boot();
    const result = await answer(run, keys);
    assert.equal(result.value, expected);
    assert.equal(result.after.inread, 0);
    assert.equal(result.after.visible, '');
    assert.equal(!!game.iflags.term_gone, keys.includes('\xff'));
});

for (const [name, keys, expected] of [
    ['resume', 'Ed\x10ge\n', 'Edge'],
    ['erase', 'Ed\x10\x7fX\n', 'EX'],
    ['cancel', 'Ed\x10\x1b\x1b', '\x1b'],
    ['empty answer', '\x10\n', ''],
    ['repeat', 'Ed\x10\x10ge\n', 'Edge'],
]) await test(`single-message history: ${name}`, async () => {
    const run = await boot(['First history message.', 'Second history message.']);
    const result = await answer(run, keys);
    assert.equal(result.value, expected);
    const recalled = result.states[keys.indexOf('\x10') + 1];
    assert.equal(recalled.visible, 'Second history message.');
    assert.equal(recalled.logical, 'Name? ' + keys.slice(0, keys.indexOf('\x10')));
    assert.equal(recalled.inread, 1);
    assert.equal(result.after.inread, 0);
    if (name === 'repeat') assert.equal(result.states[4].visible, 'First history message.');
    if (name === 'resume') assert.equal(result.states[4].visible, 'Name? Edg');
    assert.equal(result.after.visible, '');
});

await test('suppress-history exits keep the previous message but exclude the prompt', async () => {
    const run = await boot(['Preserved history.']);
    const result = await answer(run, 'Text\n', 'Name?', true);
    assert.equal(result.value, 'Text');
    assert.equal(result.after.logical, '');
    assert.ok(result.after.history.includes('Preserved history.'));
    assert.ok(!result.after.history.some(text => text?.includes('Name?')));
    feed(run, ' '.repeat(10));
    await pline('After the prompt.');
    assert.ok(!(game._msg_history || []).some(text => text?.includes('Name?')));
});

await test('line kill clears a wrapped answer and preserves the query', async () => {
    const run = await boot();
    const query = 'Q'.repeat(75) + '?';
    const result = await answer(run, 'abcdef\x15Z\n', query);
    assert.equal(result.value, 'Z');
    assert.ok(result.states[6].cursor[1] > 0);
    assert.equal(result.states[7].visible, query);
    assert.equal(result.states[8].visible, query + ' Z');
    assert.equal(line(run, 1), '');
});

await test('the actual extended-command hook truncates its completion after history', async () => {
    const prefix = ' \x17dagger\n\x17apple\n#ENH';
    const states = [], previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    let run;
    try {
        globalThis.__step_snapshot = {step: '*', cb(g, step) {
            states.push({step, logical: g._toplines, inread: g.ttyDisplay?.inread || 0});
        }};
        run = await runSegment({...base, moves: prefix + '\x10a\x1b\x1b', storage: new InMemoryStorage()});
    } finally {
        if (previous) Object.defineProperty(globalThis, '__step_snapshot', previous);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), previous);
    const at = step => states.find(s => s.step === step);
    assert.equal(at(prefix.length).logical, '# enhance');
    assert.equal(at(prefix.length).inread, 1);
    assert.equal(at(prefix.length + 2).logical, '# enhance');
    assert.equal(at(prefix.length + 3).logical, '# ');
    assert.equal(game._toplines, '');
    assert.equal(game.ttyDisplay.inread, 0);
    assert.equal(run._display.inputQueueLength, 0);
});

await test('wrapped recalled messages suspend the line reader during More', async () => {
    const run = await boot(['Before wrapping.', 'Wrapped history. ' + 'x'.repeat(120)]);
    const result = await answer(run, 'Ed\x10 ge\n');
    assert.equal(result.value, 'Edge');
    assert.equal(result.states[3].inread, 0);
    assert.ok(result.states[3].cursor[1] > 0);
    assert.equal(result.states[4].inread, 1);
    assert.equal(result.after.inread, 0);
    assert.equal(result.after.visible, '');
});
