import assert from 'node:assert/strict';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {game} from '../js/gstate.js';
import {InMemoryStorage} from '../js/storage.js';
import {resetInputState} from '../js/input.js';
import {getRngLog} from '../js/rng.js';
import {display_nhwindow_message, pline} from '../js/display.js';
import {tty_create_nhwindow, tty_get_nhwindow, tty_putstr,
    tty_display_nhwindow, tty_destroy_nhwindow, tty_dismiss_nhwindow,
    tty_start_menu, tty_add_menu, tty_end_menu, tty_select_menu,
    NHW_TEXT, NHW_MENU, ATR_BOLD} from '../js/tty/wintty.js';
import {PICK_ONE, MENU_ITEMFLAGS_SELECTED, MENU_BEHAVE_STANDARD} from '../js/const.js';
import {NO_COLOR} from '../js/terminal.js';

const boot = {seed: 9770, datetime: '20000112093000', moves: ' ',
    nethackrc: 'OPTIONS=name:wizard,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
        + 'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n'
        + 'OPTIONS=suppress_alert:3.4.3\nOPTIONS=symset:plain\n'};
async function ready(extra = '') {
    const run = await runSegment({...boot, nethackrc: boot.nethackrc + extra,
        storage: new InMemoryStorage()});
    resetInputState();
    run._display.onEmptyQueue = () => 32;
    await display_nhwindow_message();
    return run._display;
}
const text = display => display.grid.map(row => row.map(c => c.ch).join('')).join('\n');
function makeWindow(type, count, attr = 0) {
    const win = tty_create_nhwindow(type);
    for (let i = 0; i < count; i++) tty_putstr(win, attr, `Text line ${i}`);
    return win;
}
async function drive(display, win, keys, blocking = true) {
    const reads = [], before = [...getRngLog()];
    display.onEmptyQueue = () => {
        reads.push({text: text(display), cursor: [display.cursorCol, display.cursorRow],
            grid: structuredClone(display.grid), active: tty_get_nhwindow(win).active});
        assert.ok(reads.length <= keys.length, 'unexpected extra read');
        return keys.charCodeAt(reads.length - 1);
    };
    await tty_display_nhwindow(win, blocking);
    assert.deepEqual(getRngLog(), before, 'text display consumes no RNG');
    assert.equal(reads.length, keys.length, 'exact input ownership');
    return reads;
}

test('display stays pending and alive until the actual reader receives a key', async () => {
    const display = await ready(), win = makeWindow(NHW_TEXT, 2);
    let arrived, release, done = false;
    const atInput = new Promise(resolve => { arrived = resolve; });
    display.onEmptyQueue = () => { arrived(); return new Promise(resolve => { release = resolve; }); };
    const pending = tty_display_nhwindow(win, true).then(() => { done = true; });
    const state = await Promise.race([atInput.then(() => 'input'), pending.then(() => 'returned')]);
    const during = {done, active: tty_get_nhwindow(win).active, text: text(display)};
    release?.(32);
    await pending;
    assert.equal(state, 'input');
    assert.equal(during.done, false);
    assert.equal(during.active, 1);
    assert.match(during.text, /Text line 0/);
    assert.match(during.text, /--More--/);
    await tty_destroy_nhwindow(win);
    assert.equal(tty_get_nhwindow(win), undefined);
});

for (const type of [NHW_TEXT, NHW_MENU]) for (const blocking of [true, false])
test(`data window ${type} waits with blocking=${blocking}`, async () => {
    const display = await ready(), win = makeWindow(type, 2);
    const reads = await drive(display, win, ' ', blocking);
    assert.match(reads[0].text, /Text line 1/);
    assert.equal(reads[0].cursor[1], type === NHW_TEXT ? 23 : 2);
    assert.equal(tty_get_nhwindow(win).active, 1);
    await tty_destroy_nhwindow(win);
});

for (const [count, pages] of [[0, 1], [23, 1], [24, 2], [49, 3]])
test(`text boundary ${count} lines has ${pages} waits`, async () => {
    const display = await ready(), win = makeWindow(NHW_TEXT, count);
    const reads = await drive(display, win, ' '.repeat(pages));
    if (count) assert.ok(reads[0].text.includes('Text line 0'));
    if (pages > 1) {
        assert.ok(reads[1].text.includes('Text line 23'));
        assert.ok(!reads[1].text.includes('Text line 0\n'));
    }
    if (pages === 3) assert.ok(reads[2].text.includes('Text line 48'));
    assert.equal(tty_get_nhwindow(win).maxcol, 80, 'NHW_TEXT forces full width');
    await tty_destroy_nhwindow(win);
});

test('Escape cancels before later pages and a cancelled redisplay does not read', async () => {
    const display = await ready(), win = makeWindow(NHW_TEXT, 49);
    const reads = await drive(display, win, '\x1b');
    assert.ok(!reads[0].text.includes('Text line 23'));
    assert.equal(tty_get_nhwindow(win).cancelled, true);
    display.onEmptyQueue = () => { throw Error('cancelled window read again'); };
    const before = text(display);
    await tty_display_nhwindow(win, true);
    assert.equal(text(display), before);
    await tty_destroy_nhwindow(win);
});

for (const keys of ['j ', '\n', '\r']) test(`dmore accepts exactly ${JSON.stringify(keys)}`, async () => {
    const display = await ready(), win = makeWindow(NHW_TEXT, 1);
    const reads = await drive(display, win, keys);
    if (keys === 'j ') assert.deepEqual(reads[0], reads[1], 'invalid key leaves page visible');
    assert.equal(game.morc, keys === 'j ' ? ' ' : 0);
    await tty_destroy_nhwindow(win);
});

test('real standout option styles only the More prompt, preserving text attributes', async () => {
    const display = await ready('OPTIONS=standout\n'), win = makeWindow(NHW_TEXT, 1, ATR_BOLD);
    const [read] = await drive(display, win, ' ');
    assert.equal(read.grid[0][0].attr, 2);
    assert.equal(read.grid[23][0].ch, '-');
    assert.equal(read.grid[23][0].attr, 1);
    assert.equal(read.grid[23][8].attr, 0);
    await tty_destroy_nhwindow(win);
});

test('old pending message is acknowledged before the text page is drawn', async () => {
    const display = await ready(), win = makeWindow(NHW_TEXT, 1);
    await pline('A preceding message.');
    const reads = await drive(display, win, '  ');
    assert.ok(reads[0].text.includes('A preceding message.'));
    assert.ok(!reads[0].text.includes('Text line 0'));
    assert.ok(reads[1].text.includes('Text line 0'));
    await tty_destroy_nhwindow(win);
});

test('dismiss clears cancellation and reusing the same real window can display again', async () => {
    const display = await ready(), win = makeWindow(NHW_TEXT, 1);
    await drive(display, win, '\x1b');
    const cw = tty_get_nhwindow(win);
    assert.equal(cw.cancelled, true);
    await tty_dismiss_nhwindow(win);
    assert.equal(cw.active, 0);
    assert.equal(cw.cancelled, false);
    await drive(display, win, ' ');
    await tty_destroy_nhwindow(win);
});

test('real selection retains its cancellation result after dismissal clears the window flag', async () => {
    const display = await ready(), win = tty_create_nhwindow(NHW_MENU);
    tty_start_menu(win, MENU_BEHAVE_STANDARD);
    tty_add_menu(win, null, 1, 'a', 0, 0, NO_COLOR, 'Choice', MENU_ITEMFLAGS_SELECTED);
    tty_end_menu(win, 'Choose');
    let reads = 0;
    display.onEmptyQueue = () => { assert.equal(reads++, 0); return 27; };
    const cancelled = await tty_select_menu(win, PICK_ONE);
    assert.equal(reads, 1);
    assert.equal(cancelled.cancelled, true);
    assert.equal(cancelled.length, 0);
    assert.equal(tty_get_nhwindow(win).cancelled, false);
    reads = 0;
    display.onEmptyQueue = () => { assert.equal(reads++, 0); return 97; };
    const selected = await tty_select_menu(win, PICK_ONE);
    assert.equal(reads, 1);
    assert.equal(selected.cancelled, false);
    assert.deepEqual([...selected], [1]);
    await tty_destroy_nhwindow(win);
});

for (const key of [' ', '\x1b']) test(`empty real menu has one text wait for ${JSON.stringify(key)}`, async () => {
    const display = await ready(), win = tty_create_nhwindow(NHW_MENU);
    let reads = 0;
    display.onEmptyQueue = () => { assert.equal(reads++, 0); return key.charCodeAt(0); };
    const picks = await tty_select_menu(win, PICK_ONE);
    assert.equal(reads, 1);
    assert.equal(picks.length, 0);
    assert.equal(picks.cancelled, key === '\x1b');
    await tty_destroy_nhwindow(win);
});

test('real data producer selects the C text arm even when menu entries also exist', async () => {
    const display = await ready(), win = tty_create_nhwindow(NHW_MENU);
    tty_start_menu(win, MENU_BEHAVE_STANDARD);
    tty_add_menu(win, null, 1, 'a', 0, 0, NO_COLOR, 'Menu entry', 0);
    tty_end_menu(win, null);
    tty_putstr(win, 0, 'Data line');
    const [read] = await drive(display, win, ' ');
    assert.match(read.text, /Data line/);
    assert.ok(!read.text.includes('a - Menu entry'));
    assert.match(read.text, /\(end\)/);
    await tty_destroy_nhwindow(win);
});

test('a wide short data menu preserves the map below its footer', async () => {
    const display = await ready(), win = tty_create_nhwindow(NHW_MENU);
    const below = structuredClone(display.grid.slice(2));
    tty_putstr(win, 0, 'X'.repeat(80));
    const [read] = await drive(display, win, ' ');
    assert.equal(tty_get_nhwindow(win).offx, 0);
    assert.deepEqual(read.grid.slice(2), below);
    assert.equal(read.grid[0][78].ch, 'X');
    assert.equal(read.grid[0][79].ch, ' ');
    await tty_destroy_nhwindow(win);
});

test('the real menu_overlay option clears the entire short menu background', async () => {
    const display = await ready('OPTIONS=!menu_overlay\n');
    assert.equal(game.iflags.menu_overlay, false);
    assert.ok(display.grid.slice(2).some(row => row.some(c => c.ch !== ' ')));
    const win = makeWindow(NHW_MENU, 1);
    const [read] = await drive(display, win, ' ');
    assert.equal(tty_get_nhwindow(win).offx, 0);
    assert.ok(read.grid.slice(2).every(row => row.every(c => c.ch === ' ')));
    await tty_destroy_nhwindow(win);
});
