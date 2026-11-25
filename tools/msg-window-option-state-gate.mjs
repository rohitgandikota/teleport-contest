// Real option parser, startup, menu and save/restore owners. No helper replacements.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {game, resetGame} from '../js/gstate.js';
import {parseNethackrc, parseoptions, doset} from '../js/options.js';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {getRngLog, initRng, enableRngLog} from '../js/rng.js';
import {resetInputState} from '../js/input.js';
import {display_nhwindow_message} from '../js/display.js';
import {gamestate_decode} from '../js/save.js';

const base = {seed: 9770, datetime: '20000112093000', moves: ' ',
    nethackrc: 'OPTIONS=name:wizard,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
        + 'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n'
        + 'OPTIONS=suppress_alert:3.4.3\nOPTIONS=symset:plain\n'};
const rc = text => text === null ? '' : 'OPTIONS=' + text + '\n';

for (const [text, mode] of [
    [null, 's'], ['msg_window:single', 's'], ['msg_window:combination', 'c'],
    ['msg_window:full', 'f'], ['msg_window:reversed', 'r'],
    ['msg_window', 'f'], ['!msg_window', 's'], ['msg_window:', 'f'],
    ['!msg_window=', 's'], ['msg_window:   ', 'f'], ['!nomsg_window', 'f'],
    ['MSG_WINDOW=Full', 'f'], ['msg_window:c', 'c'], ['msg_window:Really', 'r'],
    ['msg_window:full=unused', 'f'],
]) test(`C parameter semantics: ${JSON.stringify(text)}`, () => {
    resetGame(); initRng(7); enableRngLog();
    const result = parseNethackrc(rc(text));
    assert.deepEqual(result.errors, []);
    assert.equal(game.iflags.prevmsg_window, mode);
    assert.equal(Object.hasOwn(result.opts, 'msg_window'), false, 'instance option never becomes flags.msg_window');
    assert.equal(!!result.optSetInConfig?.msg_window, text !== null);
    assert.deepEqual(getRngLog(), []);
});

for (const [text, error] of [
    ['msg_window:unknown', "Unknown msg_window parameter 'unknown'"],
    ['msg_window: full', "Unknown msg_window parameter ' full'"],
    ['msg_window:null', "Unknown msg_window parameter 'null'"],
    ['msg_window:0', "Unknown msg_window parameter '0'"],
    ['!msg_window:full', 'The msg_window option may not both have a value and be negated.'],
    ['no-msg_window:single', 'The msg_window option may not both have a value and be negated.'],
]) test(`invalid parameter preserves the preceding configured mode: ${text}`, () => {
    resetGame(); initRng(7); enableRngLog();
    const result = parseNethackrc('OPTIONS=msg_window:reversed\n' + rc(text));
    assert.deepEqual(result.errors, [error]);
    assert.equal(game.iflags.prevmsg_window, 'r');
    assert.equal(Object.hasOwn(result.opts, 'msg_window'), false);
    assert.deepEqual(getRngLog(), []);
});

test('right-to-left comma evaluation and later config lines retain C precedence', () => {
    resetGame();
    parseNethackrc(rc('msg_window:single,msg_window:full'));
    assert.equal(game.iflags.prevmsg_window, 's');
    parseNethackrc('OPTIONS=msg_window:single\nOPTIONS=msg_window:full\n');
    assert.equal(game.iflags.prevmsg_window, 'f');
});

test('mode parsing preserves unrelated boolean and compound stores', () => {
    resetGame();
    const result = parseNethackrc(rc('!autopickup,menustyle:partial,msg_window:full,petattr:bold'));
    assert.deepEqual(result.errors, []);
    assert.equal(result.opts.autopickup, false);
    assert.equal(result.opts.menu_style, 3);
    assert.equal(result.opts.menustyle, 'partial');
    assert.equal(game.iflags.wc2_petattr, 1);
    assert.equal(game.iflags.prevmsg_window, 'f');
});

for (const mode of ['single', 'combination', 'full', 'reversed']) test(`normal startup stores ${mode} in the live reader location`, async () => {
    await runSegment({...base, nethackrc: base.nethackrc + rc('msg_window:' + mode), storage: new InMemoryStorage()});
    assert.equal(game.iflags.prevmsg_window, mode[0]);
    assert.equal(Object.hasOwn(game.flags, 'msg_window'), false);
    assert.deepEqual(game.rc.errors, []);
});

test('new games reset the tty default without carrying a previous configured mode', async () => {
    await runSegment({...base, nethackrc: base.nethackrc + rc('msg_window:reversed'), storage: new InMemoryStorage()});
    assert.equal(game.iflags.prevmsg_window, 'r');
    await runSegment({...base, storage: new InMemoryStorage()});
    assert.equal(game.iflags.prevmsg_window, 's');
});

test('parseoptions do_set updates the live instance during play', async () => {
    await runSegment({...base, storage: new InMemoryStorage()});
    const result = {opts: {}, errors: []}, before = [...getRngLog()];
    assert.equal(parseoptions('msg_window:combination', false, false, result), true);
    assert.equal(game.iflags.prevmsg_window, 'c');
    assert.deepEqual(result.opts, {});
    assert.deepEqual(getRngLog(), before);
});

for (const choice of ['f', '\x1b']) test(`real options menu ${choice === 'f' ? 'changes' : 'cancels'} configured mode`, async () => {
    const run = await runSegment({...base, nethackrc: base.nethackrc + rc('msg_window:combination'), storage: new InMemoryStorage()});
    resetInputState(); run._display.onEmptyQueue = () => 32;
    await display_nhwindow_message();
    let keys = ':msg_window\r\r' + choice, consumed = 0;
    run._display.onEmptyQueue = () => {
        assert.ok(consumed < keys.length, 'unexpected extra menu input');
        return keys.charCodeAt(consumed++);
    };
    const before = [...getRngLog()];
    await doset();
    assert.equal(consumed, keys.length);
    assert.equal(game.iflags.prevmsg_window, choice === 'f' ? 'f' : 'c');
    assert.deepEqual(getRngLog(), before);
});

test('actual save excludes instance state and restoring startup chooses the new rc mode', async () => {
    const storage = new InMemoryStorage();
    await runSegment({...base, nethackrc: base.nethackrc + rc('msg_window:full'), moves: ' Sy', storage});
    const key = 'save:' + game.plname, raw = storage.getItem(key);
    assert.ok(raw, 'ordinary save command writes a save');
    const saved = gamestate_decode(JSON.parse(raw));
    assert.equal(Object.hasOwn(saved, 'iflags'), false);
    assert.equal(Object.hasOwn(saved.flags, 'msg_window'), false);
    await runSegment({...base, nethackrc: base.nethackrc + rc('msg_window:reversed'), moves: '   ', storage});
    assert.equal(game.iflags.prevmsg_window, 'r');
    assert.equal(Object.hasOwn(game.flags, 'msg_window'), false);
    assert.ok(!storage.getItem(key), 'ordinary restore consumes the nonpersistent save');
});

test('the live mode stays unchanged while the real selection menu waits for a key', async () => {
    const run = await runSegment({...base, nethackrc: base.nethackrc + rc('msg_window:combination'), storage: new InMemoryStorage()});
    resetInputState(); run._display.onEmptyQueue = () => 32;
    await display_nhwindow_message();
    const prefix = ':msg_window\r\r';
    let consumed = 0, arrived, release;
    const atInput = new Promise(resolve => { arrived = resolve; });
    run._display.onEmptyQueue = () => {
        if (consumed < prefix.length) return prefix.charCodeAt(consumed++);
        arrived();
        return new Promise(resolve => { release = resolve; });
    };
    const pending = doset();
    const stopped = await Promise.race([atInput.then(() => true), pending.then(() => false)]);
    const during = {mode: game.iflags.prevmsg_window,
        text: run._display.grid.map(row => row.map(cell => cell.ch).join('')).join('\n')};
    run._display.onEmptyQueue = () => { throw Error('unexpected extra menu input'); };
    release?.('f'.charCodeAt(0));
    await pending;
    assert.equal(stopped, true);
    assert.equal(during.mode, 'c');
    assert.match(during.text, /c \* combination/);
    assert.equal(game.iflags.prevmsg_window, 'f');
});
