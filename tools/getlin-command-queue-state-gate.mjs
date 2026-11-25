// Constructed source controls using real queue, line, message and menu owners.
// Physical input is supplied through GameDisplay; no runtime or RNG is replaced.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { getlin, hooked_tty_getlin, cmdq_add_key, cmdq_add_int,
    cmdq_add_dir, cmdq_add_ec, cmdq_add_userinput, cmdq_copy } from '../js/cmd.js';
import { donull } from '../js/do.js';
import { resetInputState, nhgetch } from '../js/input.js';
import { getRngLog } from '../js/rng.js';
import { pline, display_nhwindow_message, TOPLINE_EMPTY } from '../js/display.js';
import { remember_topl, tty_yn_function } from '../js/tty/topl.js';
import { tty_create_nhwindow, tty_start_menu, tty_add_menu, tty_end_menu,
    tty_select_menu, tty_destroy_nhwindow } from '../js/tty/wintty.js';
import { NO_COLOR } from '../js/terminal.js';
import { CQ_CANNED, CQ_REPEAT, CMDQ_KEY, NHW_MENU, PICK_ONE,
    MENU_BEHAVE_STANDARD, ATR_NONE, MENU_ITEMFLAGS_NONE } from '../js/const.js';

const base = {
    seed: 9770, datetime: '20000112093000', moves: ' ',
    nethackrc: 'OPTIONS=name:wizard,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
        + 'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n'
        + 'OPTIONS=suppress_alert:3.4.3\nOPTIONS=!eight_bit_tty\nOPTIONS=symset:plain\n',
};
let reads;
function feed(run, keys) {
    reads = 0;
    run._display.onEmptyQueue = async () => {
        await setImmediate();
        assert.ok(reads < keys.length, 'unexpected physical input read');
        return keys.charCodeAt(reads++);
    };
}
async function boot() {
    const run = await runSegment({ ...base, storage: new InMemoryStorage() });
    resetInputState();
    feed(run, ' ');
    await display_nhwindow_message();
    feed(run, '');
    return run;
}
function keys(queue, text) {
    for (const key of text) cmdq_add_key(queue, key);
}
const queue = q => cmdq_copy(q) || [];
const keyEntries = text => [...text].map(key => ({ typ: CMDQ_KEY, key }));
async function noRng(action) {
    const before = [...getRngLog()];
    const result = await action();
    assert.deepEqual(getRngLog(), before);
    return result;
}

await test('queued LF terminates one answer and retains the tail and repeat queue', async () => {
    await boot(); keys(CQ_CANNED, 'alpha\nNEXT'); keys(CQ_REPEAT, 'R');
    const state = game.program_state.in_getlin, bot = game.bot_disabled;
    assert.equal(await noRng(() => getlin('Name?')), 'alpha');
    assert.equal(reads, 0); assert.deepEqual(queue(CQ_CANNED), keyEntries('NEXT'));
    assert.deepEqual(queue(CQ_REPEAT), keyEntries('R'));
    assert.equal(game._toplines, 'Name? alpha');
    assert.equal(game.program_state.in_getlin, state); assert.equal(game.bot_disabled, bot);
});
await test('queue exhaustion returns partial text without requesting a physical continuation', async () => {
    await boot(); keys(CQ_CANNED, 'partial');
    assert.equal(await noRng(() => getlin('Name?')), 'partial');
    assert.equal(reads, 0); assert.deepEqual(queue(CQ_CANNED), []);
});
await test('newline alone is a queued empty answer and echoes the query', async () => {
    await boot(); keys(CQ_CANNED, '\nZ');
    assert.equal(await noRng(() => getlin('Name?')), '');
    assert.equal(reads, 0); assert.equal(game._toplines, 'Name? ');
    assert.deepEqual(queue(CQ_CANNED), keyEntries('Z'));
});
for (const [label, text] of [
    ['CR', 'A\rB'], ['editing controls', '\x1bA\b\x7fB'],
    ['FF and other high bytes', '\x80\xc3\xa9\xfe\xff'],
    ['above the tty 80-byte cap', 'a'.repeat(100)],
]) await test(`queued ${label} are copied without tty interpretation`, async () => {
    const run = await boot(); keys(CQ_CANNED, text + '\n');
    if (text.length > 80) feed(run, ' '); // Wrapped pline requires a real More.
    assert.equal(await noRng(() => getlin('Text?')), text);
    assert.equal(reads, text.length > 80 ? 1 : 0); assert.ok(!game.iflags.term_gone);
});
await test('embedded NUL ends the caller-visible C string but not queue consumption', async () => {
    await boot(); keys(CQ_CANNED, 'A\0B\nZ');
    assert.equal(await noRng(() => getlin('Text?')), 'A');
    assert.equal(game._toplines, 'Text? A');
    assert.deepEqual(queue(CQ_CANNED), keyEntries('Z'));
});
await test('NUL alone still selects the queued answer path', async () => {
    await boot(); keys(CQ_CANNED, '\0');
    assert.equal(await noRng(() => getlin('Text?')), ''); assert.equal(reads, 0);
});

const nonkeys = [
    ['user-input', () => cmdq_add_userinput(CQ_CANNED)],
    ['integer', () => cmdq_add_int(CQ_CANNED, 7)],
    ['direction', () => cmdq_add_dir(CQ_CANNED, 1, 0, 0)],
    ['command', () => cmdq_add_ec(CQ_CANNED, donull)],
];
for (const [label, add] of nonkeys) {
    await test(`${label} after partial text is consumed, while its following tail remains`, async () => {
        await boot(); keys(CQ_CANNED, 'A'); add(); keys(CQ_CANNED, 'Z');
        assert.equal(await noRng(() => getlin('Text?')), 'A');
        assert.equal(reads, 0); assert.deepEqual(queue(CQ_CANNED), keyEntries('Z'));
    });
    await test(`${label} first is consumed and falls through to physical input`, async () => {
        const run = await boot(); add(); keys(CQ_CANNED, 'Z'); feed(run, 'OK\n');
        assert.equal(await noRng(() => getlin('Text?')), 'OK');
        assert.equal(reads, 3); assert.deepEqual(queue(CQ_CANNED), keyEntries('Z'));
        assert.equal(game.program_state.in_getlin, 0);
    });
}
await test('repeat selects its own queued answer and does not consume canned input', async () => {
    await boot(); keys(CQ_CANNED, 'C\n'); keys(CQ_REPEAT, 'R\nZ');
    game.in_doagain = true;
    assert.equal(await noRng(() => getlin('Text?')), 'R');
    assert.deepEqual(queue(CQ_CANNED), keyEntries('C\n'));
    assert.deepEqual(queue(CQ_REPEAT), keyEntries('Z'));
});
await test('an empty repeat queue uses tty and never steals the canned answer', async () => {
    const run = await boot(); keys(CQ_CANNED, 'C\n'); game.in_doagain = true; feed(run, 'R\n');
    assert.equal(await noRng(() => getlin('Text?')), 'R');
    assert.deepEqual(queue(CQ_CANNED), keyEntries('C\n')); assert.deepEqual(queue(CQ_REPEAT), []);
});
await test('queued echo follows ordinary message history, not tty prompt cleanup', async () => {
    await boot(); keys(CQ_CANNED, 'alpha\n');
    await noRng(() => getlin('Name?')); remember_topl();
    assert.ok(game._msg_history.includes('Name? alpha'));
    assert.notEqual(game._toplin, TOPLINE_EMPTY);
});
await test('queued echo awaits a real More with both wrapper flags untouched', async () => {
    const run = await boot(); await pline('Earlier message');
    keys(CQ_CANNED, 'answer\nZ'); game.program_state.in_getlin = 7;
    const bot = game.bot_disabled;
    const before = [...getRngLog()]; let entered = false, finished = false, release, used = 0;
    const wait = new Promise(resolve => release = resolve);
    run._display.onEmptyQueue = async () => {
        entered = true; await wait; assert.ok(++used <= 2); return used === 1 ? 32 : 10;
    };
    const pending = getlin('Q'.repeat(79)).then(value => { finished = true; return value; });
    await setImmediate();
    try {
        assert.ok(entered); assert.equal(finished, false);
        assert.equal(game.program_state.in_getlin, 7); assert.equal(game.bot_disabled, bot);
        assert.deepEqual(queue(CQ_CANNED), keyEntries('Z'));
    } finally { release(); }
    assert.equal(await pending, 'answer'); assert.deepEqual(getRngLog(), before);
    assert.equal(game.program_state.in_getlin, 7); assert.equal(game.bot_disabled, bot);
});
await test('queued echo preserves an already disabled status flag', async () => {
    await boot(); game.bot_disabled = true; keys(CQ_CANNED, 'A\n');
    assert.equal(await noRng(() => getlin('Name?')), 'A'); assert.equal(game.bot_disabled, true);
});
for (const [label, text, answer] of [
    ['LF', 'OK\n', 'OK'], ['Escape', '\x1b', '\x1b'], ['FF EOF', '\xff', '\x1b'],
]) await test(`physical ${label} runs with in_getlin=1 and restores flags before return`, async () => {
    const run = await boot(); game.bot_disabled = true; let used = 0;
    run._display.onEmptyQueue = async () => {
        await setImmediate(); assert.equal(game.program_state.in_getlin, 1);
        assert.equal(game.bot_disabled, true); assert.ok(used < text.length);
        return text.charCodeAt(used++);
    };
    assert.equal(await noRng(() => getlin('Name?')), answer);
    assert.equal(game.program_state.in_getlin, 0); assert.equal(game.bot_disabled, true);
    assert.equal(!!game.iflags.term_gone, label === 'FF EOF');
    assert.deepEqual(queue(CQ_REPEAT), []);
});
await test('pending tty input keeps in_getlin set until the real key arrives', async () => {
    const run = await boot(); let entered = false, release, finished = false;
    const wait = new Promise(resolve => release = resolve);
    run._display.onEmptyQueue = async () => { entered = true; await wait; return 10; };
    const pending = getlin('Name?').then(value => { finished = true; return value; });
    await setImmediate();
    try {
        assert.ok(entered); assert.equal(finished, false);
        assert.equal(game.program_state.in_getlin, 1); assert.equal(game.bot_disabled, true);
    } finally { release(); }
    assert.equal(await pending, ''); assert.equal(game.program_state.in_getlin, 0);
    assert.equal(game.bot_disabled, false);
});
await test('rejected physical input propagates its identity and clears the wrapper lifetime', async () => {
    const run = await boot(); const failure = new Error('bounded physical input ended');
    run._display.onEmptyQueue = async () => { await setImmediate(); throw failure; };
    await assert.rejects(getlin('Name?'), error => error === failure);
    assert.equal(game.program_state.in_getlin, 0); assert.equal(game.bot_disabled, false);
    assert.ok(!game.iflags.term_gone);
});
await test('direct tty reader preserves queued FF and never enters the core wrapper', async () => {
    const run = await boot(); keys(CQ_CANNED, '\xff'); const state = game.program_state.in_getlin;
    feed(run, 'OK\n'); assert.equal(await noRng(() => hooked_tty_getlin('Name?')), 'OK');
    assert.deepEqual(queue(CQ_CANNED), keyEntries('\xff'));
    assert.equal(game.program_state.in_getlin, state); assert.ok(!game.iflags.term_gone);
});
await test('tty menu search reads physical text with a queued confirmation still pending', async () => {
    const run = await boot(); keys(CQ_CANNED, 'y'); const state = game.program_state.in_getlin;
    const win = tty_create_nhwindow(NHW_MENU); tty_start_menu(win, MENU_BEHAVE_STANDARD);
    tty_add_menu(win, null, 1, 'a', 0, ATR_NONE, NO_COLOR, 'dagger', MENU_ITEMFLAGS_NONE);
    tty_add_menu(win, null, 2, 'b', 0, ATR_NONE, NO_COLOR, 'apple', MENU_ITEMFLAGS_NONE);
    tty_end_menu(win, 'Choose an object');
    let used = 0; const text = ':dagger\n';
    run._display.onEmptyQueue = async () => {
        await setImmediate(); assert.equal(game.program_state.in_getlin, state);
        assert.deepEqual(queue(CQ_CANNED), keyEntries('y')); assert.ok(used < text.length);
        return text.charCodeAt(used++);
    };
    try { assert.deepEqual([...await noRng(() => tty_select_menu(win, PICK_ONE))], [1]); }
    finally { tty_destroy_nhwindow(win); }
    assert.equal(used, text.length); assert.deepEqual(queue(CQ_CANNED), keyEntries('y'));
    assert.equal(await noRng(() => tty_yn_function('Proceed?', 'yn', 'n', true)), 'y');
    assert.deepEqual(queue(CQ_CANNED), []); assert.deepEqual(queue(CQ_REPEAT), []);
});
await test('yn addcmdq=false leaves queued FF intact and reads the physical response', async () => {
    const run = await boot(); keys(CQ_CANNED, '\xff'); feed(run, 'n');
    assert.equal(await noRng(() => tty_yn_function('Proceed?', 'yn', 'n', false)), 'n');
    assert.equal(reads, 1); assert.deepEqual(queue(CQ_CANNED), keyEntries('\xff'));
    assert.deepEqual(queue(CQ_REPEAT), []); assert.ok(!game.iflags.term_gone);
});
await test('yn addcmdq=true still consumes literal FF without terminal EOF or repeat recording', async () => {
    await boot(); keys(CQ_CANNED, '\xffZ');
    assert.equal(await noRng(() => tty_yn_function('Key?', null, '\0', true)), '\xff');
    assert.equal(reads, 0); assert.deepEqual(queue(CQ_CANNED), keyEntries('Z'));
    assert.deepEqual(queue(CQ_REPEAT), []); assert.ok(!game.iflags.term_gone);
});
await test('queued FF leaves the following physical byte unread', async () => {
    const run = await boot(); keys(CQ_CANNED, '\xff\n'); feed(run, 'Z');
    assert.equal(await noRng(() => getlin('Name?')), '\xff'); assert.equal(reads, 0);
    assert.equal(await nhgetch(), 90); assert.equal(reads, 1);
});
