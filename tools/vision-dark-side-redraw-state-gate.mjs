// Source controls use real keyboard setup and runtime producers, not native data.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setImmediate,setTimeout} from 'node:timers/promises';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {resetInputState} from '../js/input.js';
import {getRngLog} from '../js/rng.js';
import {vision_recalc,cansee,couldsee,__debug_arrays} from '../js/vision.js';
import {teleds,TELEDS_TELEPORT} from '../js/teleport.js';
import {make_blinded} from '../js/potion.js';
import {Blind,Stealth} from '../js/youprop.js';
import {docrt,pline,display_nhwindow_message,flush_screen} from '../js/display.js';
import {DOOR,SDOOR,IS_WALL,ROOM} from '../js/const.js';

const parts=JSON.parse(fs.readFileSync(new URL(
    'gen-sessions/recipes/vision-dark-side-redraw.json',import.meta.url))).segments;
const cell=()=>({...game.nhDisplay.grid[14][10]});
const location=()=>game.level.at(11,13);
async function boot(index=0,terrain=null) {
    let moves=parts[index].moves.slice(0,parts[index].moves.lastIndexOf('\x14llk.'));
    if(terrain)moves=moves.replace('closed door',terrain);
    const run=await runSegment({...parts[index],moves,storage:new InMemoryStorage()});
    game._preNhgetchHook=null;
    resetInputState();
    run._display.onEmptyQueue=async()=>{await setImmediate();return 32;};
    await display_nhwindow_message();
    assert.deepEqual([game.u.ux,game.u.uy],[12,13]);
    assert.equal(Stealth(),true); assert.ok(cansee(11,13));
    assert.equal(cell().ch,'X');
    assert.ok(game.level.monAt.get('11,13')?.msleeping);
    return run;
}
async function leave() {
    const rng=[...getRngLog()],mon=game.level.monAt.get('11,13');
    const action=teleds(14,12,TELEDS_TELEPORT);
    assert.ok(action instanceof Promise);
    assert.equal(await action,undefined);
    assert.deepEqual(getRngLog(),rng,'selected teleport/redraw has no core RNG draw');
    assert.equal(game.level.monAt.get('11,13'),mon);
    assert.ok(mon.msleeping);assert.ok(couldsee(11,13));
}

await test('closed door loses a real sleeping monster glyph on dark-side departure',async()=>{
    await boot();assert.equal(location().typ,DOOR);
    const memory=structuredClone(location().remembered_glyph);
    await leave();
    assert.equal(!!cansee(11,13),false);
    assert.equal(location().lit,true);assert.equal(game.level.at(12,12).lit,0);
    assert.equal(__debug_arrays().viz_clear[13][11],0);
    assert.deepEqual(cell(),{ch:'+',color:3,attr:0});
    assert.deepEqual(location().remembered_glyph,memory);
    assert.equal(location().waslit,1,'lit wall memory is not the dark-room arm');
});
await test('wall terrain follows the same fallback using real terrain wishes',async()=>{
    await boot(0,'wall');assert.ok(IS_WALL(location().typ));
    const memory=structuredClone(location().remembered_glyph);
    await leave();assert.equal(!!cansee(11,13),false);
    assert.equal(cell().ch,memory.ch);assert.notEqual(cell().ch,'X');
});
await test('secret door follows the same fallback using real terrain wishes',async()=>{
    await boot(0,'secret door');assert.equal(location().typ,SDOOR);
    const memory=structuredClone(location().remembered_glyph);
    await leave();assert.equal(!!cansee(11,13),false);
    assert.equal(cell().ch,memory.ch);assert.notEqual(cell().ch,'X');
});
await test('real light scroll keeps the front lit and the monster visible',async()=>{
    await boot(1);await leave();
    assert.equal(location().typ,DOOR);assert.equal(!!game.level.at(12,12).lit,true);
    assert.ok(cansee(11,13));assert.equal(cell().ch,'X');
});
await test('passable lit floor remains visible across a dark front',async()=>{
    await boot(2);await leave();
    assert.equal(location().typ,ROOM);assert.equal(game.level.at(12,12).lit,0);
    assert.ok(cansee(11,13));assert.equal(cell().ch,'X');
});
await test('repeated normal recalculation preserves memory and consumes no core RNG',async()=>{
    await boot();await leave();
    const expected=cell(),memory=structuredClone(location().remembered_glyph),rng=[...getRngLog()];
    for(let repeat=0;repeat<2;repeat++)assert.equal(vision_recalc(0),undefined);
    assert.deepEqual(cell(),expected);assert.deepEqual(getRngLog(),rng);
    assert.deepEqual(location().remembered_glyph,memory);
});
await test('refresh control clears old sight then normal vision restores nearby monster',async()=>{
    await boot();const rng=[...getRngLog()];
    assert.equal(vision_recalc(2),undefined);assert.equal(!!cansee(11,13),false);
    await flush_screen(0);
    assert.equal(cell().ch,'+');
    vision_recalc(0);await flush_screen(0);
    assert.ok(cansee(11,13));assert.equal(cell().ch,'X');
    assert.deepEqual(getRngLog(),rng);
});
await test('real blindness takes the earlier clear-old-sight owner',async()=>{
    await boot();await make_blinded(100,false);
    await flush_screen(0);
    assert.equal(Blind(),true);assert.equal(!!cansee(11,13),false);
    assert.equal(cell().ch,'+');
});
await test('pending More delays docrt, reentry stays quiet, then departure completes',async()=>{
    const run=await boot();await pline('A message waits before the dark-side redraw.');
    let release,settled=false,error;
    run._display.onEmptyQueue=()=>new Promise(resolve=>{release=resolve;});
    const action=docrt().then(()=>{settled=true;},e=>{error=e;settled=true;});
    try {
        for(let i=0;i<200&&!release&&!settled;i++)await setTimeout(1);
        assert.ok(release);assert.equal(settled,false);
        assert.equal(game.program_state.in_docrt,true);
        const before=run._display.terminal.serialize(),rng=[...getRngLog()],view=game.viz_array;
        await docrt();
        assert.equal(game.viz_array,view);assert.equal(run._display.terminal.serialize(),before);
        assert.deepEqual(getRngLog(),rng);
    } finally {
        run._display.onEmptyQueue=async()=>{await setImmediate();return 32;};
        release?.(32);await action;
    }
    if(error)throw error;
    assert.equal(game.program_state.in_docrt,false);
    await leave();assert.equal(cell().ch,'+');
});
