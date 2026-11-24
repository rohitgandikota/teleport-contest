// Real startup, disclosure, bones and tty producers. No native coverage claim.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setImmediate, setTimeout} from 'node:timers/promises';
import {fileURLToPath} from 'node:url';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {resetInputState} from '../js/input.js';
import {getRngLog} from '../js/rng.js';
import {pline, display_nhwindow_message} from '../js/display.js';
import {NHW_TEXT, tty_create_nhwindow, tty_get_nhwindow, tty_putstr,
    tty_display_nhwindow, tty_dismiss_nhwindow, tty_destroy_nhwindow} from '../js/tty/wintty.js';

const sessions = process.argv[2] || fileURLToPath(new URL('../sessions/', import.meta.url));
const read = name => JSON.parse(fs.readFileSync(path.join(sessions, name)));
const deaths = read('seed0030-ten-diverse-deaths.session.json');
const stress = read('seed5006-tourist-stress-disaster.session.json');
const ordinary = {seed:99812, datetime:'20000110090000', moves:' ',
    nethackrc:'OPTIONS=name:wizard,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
        +'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist\n'};

async function boot(part = ordinary, count = part.moves.length) {
    const run = await runSegment({...part, moves:part.moves.slice(0,count), storage:new InMemoryStorage()});
    game._preNhgetchHook = null;
    resetInputState();
    run._display.onEmptyQueue = async () => {await setImmediate(); return 32;};
    return run;
}
const pixels = run => run._display.terminal.serialize();
const cursor = run => [run._display.cursorCol, run._display.cursorRow];
async function textWindow() {
    const id = tty_create_nhwindow(NHW_TEXT);
    tty_putstr(id,0,'Window lifetime control');
    await tty_display_nhwindow(id);
    return id;
}
function finalWindow() {
    // Inspect real public tty handles, without exporting private window state.
    const found = [];
    for(let id=1;id<256;id++) {
        const win = tty_get_nhwindow(id);
        if(win?.active && win.type===NHW_TEXT
            && win.data.some(line=>line.startsWith('You were level '))) found.push(id);
    }
    assert.equal(found.length,1,'actual final text window is active');
    return found[0];
}

await test('real startup initializes windows before ordinary menu use',async()=>{
    const run=await boot();
    assert.equal(game.iflags.window_inited,true);
    const id=await textWindow(), before=pixels(run), rng=[...getRngLog()];
    await tty_destroy_nhwindow(id);
    assert.equal(tty_get_nhwindow(id),undefined);
    assert.notEqual(pixels(run),before,'live dismissal restores the map');
    assert.deepEqual(getRngLog(),rng);
});

await test('actual death disclosure keeps windows initialized after gameover',async()=>{
    await boot(deaths.segments[0],73);
    assert.equal(game.program_state_gameover,true);
    assert.equal(game.iflags.vision_inited,false);
    assert.equal(game.iflags.window_inited,true);
    assert.ok(game.u.ux>0,'disclosure precedes successful bones preparation');
});

await test('gameover disclosure still redraws on dismissal',async()=>{
    const run=await boot(deaths.segments[0],73);
    assert.equal(game.program_state_gameover,true);
    await display_nhwindow_message();
    const id=await textWindow(), before=pixels(run), rng=[...getRngLog()];
    await tty_destroy_nhwindow(id);
    assert.notEqual(pixels(run),before,'gameover alone must not suppress erasure');
    assert.deepEqual(getRngLog(),rng);
});

await test('successful bones preparation precedes final window shutdown',async()=>{
    await boot(stress.segments[0],187);
    assert.equal(game.program_state_gameover,true);
    assert.equal(game.iflags.vision_inited,false);
    assert.deepEqual([game.u.ux,game.u.uy],[0,0],'real savebones removes the hero from the map');
    assert.ok(game.u.ux0>0);
    assert.equal(game.iflags.window_inited,false);
    finalWindow();
});

await test('destroying actual final text preserves pixels and needs no input or RNG',async()=>{
    const run=await boot(stress.segments[0],187), id=finalWindow();
    const before=pixels(run), position=cursor(run), rng=[...getRngLog()];
    run._display.onEmptyQueue=()=>{throw new Error('unexpected final-window input');};
    const result=tty_destroy_nhwindow(id);
    await result;
    assert.equal(result,undefined,'shutdown dismissal is synchronous');
    await setImmediate();
    assert.equal(tty_get_nhwindow(id),undefined);
    assert.equal(pixels(run),before);
    assert.deepEqual(cursor(run),position);
    assert.deepEqual(getRngLog(),rng);
    assert.deepEqual(game.impossible_log||[],[]);
});

await test('live destruction remains pending until the real More is acknowledged',async()=>{
    const run=await boot(), id=await textWindow(), win=tty_get_nhwindow(id);
    await pline('An earlier message must finish before the window is destroyed.');
    let release, settled=false, error;
    run._display.onEmptyQueue=()=>new Promise(resolve=>{release=resolve;});
    const pending=Promise.resolve(tty_destroy_nhwindow(id)).then(
        ()=>{settled=true;},e=>{settled=true;error=e;});
    try {
        for(let i=0;i<100&&!release&&!settled;i++)await setTimeout(1);
        assert.ok(release,'real nhgetch is pending');
        assert.equal(settled,false);
        assert.equal(tty_get_nhwindow(id),win);
        assert.equal(win.active,1);
    } finally {
        run._display.onEmptyQueue=async()=>{await setImmediate();return 32;};
        release?.(32);
        await pending;
    }
    if(error)throw error;
    assert.equal(tty_get_nhwindow(id),undefined);
});

await test('erasing-screen arm leaves pixels alone and deactivates the window',async()=>{
    const run=await boot(), id=await textWindow(), win=tty_get_nhwindow(id);
    const before=pixels(run), rng=[...getRngLog()];
    // Source-only flag arm: JS has no erase_tty_screen producer yet.
    game._erasing_tty_screen=1;
    try {
        const result=tty_dismiss_nhwindow(id);
        await result;
        assert.equal(result,undefined);
        assert.equal(win.active,0);
        assert.equal(pixels(run),before);
        assert.deepEqual(getRngLog(),rng);
        assert.equal(tty_dismiss_nhwindow(id),undefined);
    } finally {delete game._erasing_tty_screen;}
    tty_destroy_nhwindow(id);
});
