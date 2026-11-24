// Real producers and explicit helper-only redraw contracts. No native claim.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setImmediate, setTimeout} from 'node:timers/promises';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {resetInputState, pushKey} from '../js/input.js';
import {getRngLog} from '../js/rng.js';
import * as display from '../js/display.js';
import {getdir, movecmd, cmdq_clear, cmdq_copy, cmdq_add_key, cmdq_add_dir} from '../js/cmd.js';
import {CQ_REPEAT, CQ_CANNED, Is_waterlevel, WATER, COLNO, ROWNO, MV_WALK} from '../js/const.js';
import {Underwater, Blind, Swimming} from '../js/youprop.js';
import {readobjnam} from '../js/objnam.js';
import {addinv} from '../js/invent.js';
import {polymon} from '../js/polyself.js';
import {PMNAMES} from '../js/monst_data.js';
import {goto_level} from '../js/do.js';
import {teleds} from '../js/teleport.js';
import {set_uinwater} from '../js/hack.js';

const parts=JSON.parse(fs.readFileSync(new URL('gen-sessions/recipes/docrt-flags.json',import.meta.url))).segments;
const ordinary={seed:99812,datetime:'20000110090000',moves:' ',nethackrc:
    'OPTIONS=name:wizard,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
    +'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist,!cmdassist\n'};
const flags={recalc:0,refresh:1,maponly:2,nocls:4}; // include/display.h:1017
async function boot(part=ordinary, cut=part.moves.length) {
    const run=await runSegment({...part,moves:part.moves.slice(0,cut),storage:new InMemoryStorage()});
    game._preNhgetchHook=null;
    resetInputState();
    run._display.onEmptyQueue=async()=>{await setImmediate();return 32;};
    await display.display_nhwindow_message();
    return run;
}
const pixels=run=>run._display.terminal.serialize();
const map=run=>structuredClone(run._display.grid.slice(1,22));
function outside(run) {
    let count=0;
    for(let y=0;y<ROWNO;y++)for(let x=1;x<COLNO;x++)
        if(Math.max(Math.abs(x-game.u.ux),Math.abs(y-game.u.uy))>1
            &&run._display.grid[y+1][x-1].ch!==' ')count++;
    return count;
}
function redrawFlags(value) {
    assert.equal(typeof display.docrt_flags,'function','canonical flags owner exists');
    return display.docrt_flags(value);
}
async function hold(run, action, check) {
    let release, settled=false, error;
    run._display.onEmptyQueue=()=>new Promise(resolve=>{release=resolve;});
    const operation=Promise.resolve().then(action).then(()=>{settled=true;},e=>{error=e;settled=true;});
    try {
        for(let i=0;i<200&&!release&&!settled;i++)await setTimeout(1);
        assert.ok(release,'real input is pending');assert.equal(settled,false);
        await check();
    }finally{
        run._display.onEmptyQueue=async()=>{await setImmediate();return 32;};
        release?.(32);await operation;
    }
    if(error)throw error;
}

for(const i of [0,2])await test(`ordinary producer keeps underwater redraw local: ${parts[i].name}`,async()=>{
    const part=parts[i],run=await boot(part,part.moves.length-1),rng=[...getRngLog()];
    assert.equal(Underwater(),true);assert.equal(outside(run),0);
    if(i===2){assert.equal(Blind(),true);assert.equal(Swimming(),true);}
    await display.docrt();
    assert.equal(outside(run),0);assert.deepEqual(getRngLog(),rng);
    assert.equal(game.program_state.in_docrt,false);
});
await test('dry redraw retains the ordinary map and RNG',async()=>{
    const part=parts[1],run=await boot(part,part.moves.length-1),before=map(run),rng=[...getRngLog()];
    assert.equal(Underwater(),false);assert.ok(outside(run)>0);
    await display.docrt();assert.deepEqual(map(run),before);assert.deepEqual(getRngLog(),rng);
});
await test('swallowed full redraw reaches the common status arm',async()=>{
    const part=parts[3];await boot(part,part.moves.length-1);
    assert.ok(game.u.uswallow&&game.u.ustuck);
    const rng=[...getRngLog()];
    await redrawFlags(flags.recalc);
    assert.equal(game.disp.botlx,true,'common post-map update follows swallowed bot()');
    assert.equal(game.program_state.in_docrt,false);assert.deepEqual(getRngLog(),rng);
});
await test('helper-only MapOnly keeps swallowed bot() from being dirtied again',async()=>{
    const part=parts[3];await boot(part,part.moves.length-1);
    await redrawFlags(flags.maponly);
    assert.equal(game.disp.botlx,false);assert.equal(game.program_state.in_docrt,false);
});
await test('real Plane of Water producer bypasses the restricted pool view',async()=>{
    const run=await boot();
    await addinv(await readobjnam('Amulet of Yendor',null));
    assert.ok(game.u.uhave.amulet);
    await polymon(PMNAMES.PM_WATER_ELEMENTAL);
    await goto_level({...game.special_levels.water_level},false,false,false);
    assert.equal(Is_waterlevel(game.u.uz),true);
    let water;
    for(let y=0;y<ROWNO&&!water;y++)for(let x=1;x<COLNO;x++)
        if(game.level.at(x,y)?.typ===WATER){water={x,y};break;}
    assert.ok(water);await teleds(water.x,water.y,0);
    assert.equal(Underwater(),true);
    await display.display_nhwindow_message();
    const rng=[...getRngLog()];await display.docrt();
    assert.ok(outside(run)>0,'Water level uses its bubble/map rendering');
    assert.deepEqual(getRngLog(),rng);
});
await test('pending More owns the redraw until acknowledgment; nested call is quiet',async()=>{
    const run=await boot();await display.pline('A previous message must be acknowledged before redraw.');
    const rng=[...getRngLog()];
    await hold(run,()=>display.docrt(),async()=>{
        assert.equal(game.program_state.in_docrt,true);
        const before=pixels(run),position=[run._display.cursorCol,run._display.cursorRow];
        await display.docrt();
        assert.equal(game.program_state.in_docrt,true,'nested call does not release outer ownership');
        assert.equal(pixels(run),before);assert.deepEqual([run._display.cursorCol,run._display.cursorRow],position);
    });
    assert.equal(game.program_state.in_docrt,false);assert.deepEqual(getRngLog(),rng);
});
await test('Ctrl-R at More is ignored and does not end pending ownership',async()=>{
    const run=await boot();await display.pline('A prior message waits at More before redraw.');
    let reads=0;
    run._display.onEmptyQueue=async()=>{
        await setImmediate();assert.equal(game.program_state.in_docrt,true);
        return ++reads===1 ? 18 : 32;
    };
    await display.docrt();assert.equal(reads,2);assert.equal(game.program_state.in_docrt,false);
});
await test('input interruption releases the new owner flag',async()=>{
    const run=await boot();await display.pline('Input interruption during a pending redraw.');
    const end=new Error('test input ended');run._display.onEmptyQueue=()=>{throw end;};
    await assert.rejects(display.docrt(),e=>e===end);
    assert.equal(game.program_state.in_docrt,false);
});
await test('helper-only Nocls leaves a pending message unconsumed',async()=>{
    const run=await boot();await display.pline('This line survives a no-clear redraw.');
    const before=structuredClone(run._display.grid[0]),rng=[...getRngLog()];
    run._display.onEmptyQueue=()=>{throw new Error('Nocls consumed input');};
    await redrawFlags(flags.nocls);
    assert.deepEqual(run._display.grid[0],before);assert.deepEqual(getRngLog(),rng);
    assert.equal(game.disp.botlx,true);assert.equal(game.program_state.in_docrt,false);
});
await test('temporary terrain refresh keeps glyph identities and memory unchanged',async()=>{
    const part=parts[4],run=await boot(part,part.moves.indexOf('\x12'));
    assert.equal(game.iflags.terrainmode,17);
    const before=map(run),rng=[...getRngLog()],buffer=game.gbuf;
    const cells=buffer.flat().filter(Boolean),memory=[];
    for(let x=1;x<COLNO;x++)for(let y=0;y<ROWNO;y++)memory.push(game.level.at(x,y).remembered_glyph);
    await redrawFlags(flags.refresh);
    assert.equal(game.gbuf,buffer);
    assert.deepEqual(buffer.flat().filter(Boolean),cells);
    assert.deepEqual(map(run),before);assert.deepEqual(getRngLog(),rng);
    let i=0;for(let x=1;x<COLNO;x++)for(let y=0;y<ROWNO;y++)assert.equal(game.level.at(x,y).remembered_glyph,memory[i++]);
});
await test('helper-only MapOnly refresh does not request a status redraw',async()=>{
    await boot();assert.equal(game.disp.botlx,false);
    await redrawFlags(flags.refresh|flags.maponly);
    assert.equal(game.disp.botlx,false);
    await redrawFlags(flags.refresh);
    assert.equal(game.disp.botlx,true);
});
await test('getdir retries a live redraw without recording it in the repeat queue',async()=>{
    await boot();cmdq_clear(CQ_REPEAT);cmdq_clear(CQ_CANNED);
    pushKey(18);pushKey('l'.charCodeAt(0));
    const rng=[...getRngLog()];assert.equal(await getdir(null),true);
    assert.deepEqual([game.u.dx,game.u.dy,game.u.dz],[1,0,0]);
    assert.deepEqual(cmdq_copy(CQ_REPEAT).map(e=>e.key),['l']);assert.deepEqual(getRngLog(),rng);
});
await test('getdir honors a real rc redraw binding',async()=>{
    await boot({...ordinary,nethackrc:ordinary.nethackrc+'BINDINGS=X:redraw\n'});
    cmdq_clear(CQ_REPEAT);cmdq_clear(CQ_CANNED);pushKey(88);pushKey(108);
    assert.equal(await getdir(null),true);
    assert.deepEqual(cmdq_copy(CQ_REPEAT).map(e=>e.key),['l']);
});
await test('queued redraw key preserves C goto got_dirsym and is not retried',async()=>{
    await boot();cmdq_clear(CQ_REPEAT);cmdq_clear(CQ_CANNED);
    cmdq_add_key(CQ_CANNED,'\x12');
    assert.equal(await getdir(null),false);
    assert.equal(cmdq_copy(CQ_REPEAT),null);
    assert.match(game._toplines,/What a strange direction/);
});
await test('queued valid direction remains synchronous to input and unrecorded',async()=>{
    const run=await boot();cmdq_clear(CQ_REPEAT);cmdq_clear(CQ_CANNED);
    cmdq_add_dir(CQ_CANNED,0,-1,0);
    run._display.onEmptyQueue=()=>{throw new Error('queued direction asked for input');};
    const rng=[...getRngLog()];assert.equal(await getdir(null),true);
    assert.deepEqual([game.u.dx,game.u.dy,game.u.dz],[0,-1,0]);
    assert.equal(cmdq_copy(CQ_REPEAT),null);assert.deepEqual(getRngLog(),rng);
});

const sessions=process.argv[2];
assert.ok(sessions,'supply the public sessions directory for the real bones control');
await test('real bones ux teardown makes a later direct redraw quiet, helper-only invocation',async()=>{
    const raw=JSON.parse(fs.readFileSync(path.join(sessions,'seed5006-tourist-stress-disaster.session.json')));
    const run=await boot(raw.segments[0],187);
    assert.deepEqual([game.u.ux,game.u.uy],[0,0]);assert.equal(game.iflags.window_inited,false);
    const before=pixels(run),rng=[...getRngLog()],diagnostics=[...(game.impossible_log||[])];
    await display.docrt();
    assert.equal(pixels(run),before);assert.deepEqual(getRngLog(),rng);
    assert.deepEqual(game.impossible_log||[],diagnostics);
});

await test('special underwater redraw clears even when Nocls is requested',async()=>{
    const part=parts[0],run=await boot(part,part.moves.length-1);
    await display.pline('A prior message precedes the restricted water redraw.');
    await hold(run,()=>redrawFlags(flags.nocls),async()=>{
        assert.equal(game.program_state.in_docrt,true);
        assert.equal(outside(run),0);
    });
    assert.equal(game.disp.botlx,true);assert.equal(game.program_state.in_docrt,false);
});
await test('swallowing precedes water dispatch, using the canonical water setter',async()=>{
    const part=parts[3],run=await boot(part,part.moves.length-1);
    const before=map(run);await set_uinwater(1);
    assert.equal(Underwater(),true);assert.ok(game.u.uswallow);
    await display.docrt();assert.deepEqual(map(run),before);
});
await test('source-only inactive buried arm clears rather than rebuilding memory',async()=>{
    const run=await boot();
    // C bury_you() is #if 0. This flag arm has no ordinary producer claim.
    game.u.uburied=1;
    try {
        await display.docrt();
        assert.ok(run._display.grid.slice(1,22).every(row=>row.every(cell=>cell.ch===' ')));
        assert.equal(game.program_state.in_docrt,false);
    }finally{game.u.uburied=0;}
});
await test('real level-transition pending message does not refresh mismatched old/new levels',async()=>{
    const run=await boot();
    movecmd('>',MV_WALK);
    await display.pline('A previous long message must be acknowledged before descending the stairs.');
    await hold(run,()=>goto_level({dnum:0,dlevel:2},true,false,false),async()=>{
        assert.notDeepEqual(game.u.uz,game.u.uz0);
        const before=pixels(run),rng=[...getRngLog()];
        await redrawFlags(flags.refresh);
        assert.equal(pixels(run),before);assert.deepEqual(getRngLog(),rng);
    });
    assert.deepEqual(game.u.uz,game.u.uz0);assert.equal(game._delay_flushing,false);
});
