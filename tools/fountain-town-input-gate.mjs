// Ordinary keys only. The observer reads state at existing input boundaries.
// No runtime helper, monster, terrain, input decoder or RNG is replaced.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { setImmediate } from 'node:timers/promises';
import { NethackGame, runSegment } from '../js/jsmain.js';
import { GameDisplay } from '../js/game_display.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { moveloop_core } from '../js/allmain.js';
import { Blind, Deaf, Fire_resistance } from '../js/youprop.js';
import { in_town } from '../js/hack.js';
import { cansee, couldsee } from '../js/vision.js';
import { glyph_at } from '../js/display.js';
import { getRngLog } from '../js/rng.js';
import { PMNAMES } from '../js/monst_data.js';
import { cmap_names } from '../js/drawing_data.js';
import { FOUNTAIN, ROOM } from '../js/const.js';
import { branchAssertionErrors } from './gen-sessions/assertions.mjs';
import { decodeScreen } from '../frozen/screen-decode.mjs';

const recipePath = new URL('gen-sessions/recipes/fountain-town-coverage.json', import.meta.url);
const recipe = JSON.parse(fs.readFileSync(recipePath));
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const hashes = value => Object.fromEntries(Object.entries(value).map(([k,v]) => [k, hash(v)]));
const outputs = run => ({screens:run.getScreens(), cursors:run.getCursors(),
    rng:[...run.getRngLog()], slices:run.getRngSlices(), frames:run.getAnimationFramesByStep()});
const watch = s => s.monsters.filter(m => m.watch && m.hp > 0);
const gremlins = s => s.monsters.filter(m => m.gremlin && m.hp > 0);
const tile = (s,x,y) => s.tiles.find(t => t.x === x && t.y === y);
const tracked = new WeakMap();
function snapshot(g, step) {
    let cells = tracked.get(g.level);
    if (!cells) { cells = new Set(); tracked.set(g.level,cells); }
    for (let x=1;x<80;x++) for (let y=0;y<21;y++)
        if (g.level.at(x,y).typ === FOUNTAIN) cells.add(`${x},${y}`);
    return {step, turn:g.moves, xy:[g.u.ux,g.u.uy], town:in_town(g.u.ux,g.u.uy),
        level:{...g.u.uz}, blind:Blind(), deaf:Deaf(), fireResistant:Fire_resistance(),
        top:g._toplines, pending:g._pending_message, rngCount:getRngLog().length,
        tiles:[...cells].map(key => {
            const [x,y]=key.split(',').map(Number), loc=g.level.at(x,y), glyph=glyph_at(x,y);
            return {x,y,typ:loc.typ,looted:loc.looted||0,town:in_town(x,y),cansee:cansee(x,y),
                glyph:{kind:glyph.kind,cmap:glyph.cmap,glyphnum:glyph.glyphnum,monId:glyph.mon?.m_id}};
        }),
        monsters:(g.level.monsters||[]).map(m => ({id:m.m_id,xy:[m.mx,m.my],hp:m.mhp,
            peace:!!m.mpeaceful,tame:m.mtame,gremlin:m.mnum===PMNAMES.PM_GREMLIN,
            watch:[PMNAMES.PM_WATCHMAN,PMNAMES.PM_WATCH_CAPTAIN].includes(m.mnum),couldsee:couldsee(m.mx,m.my)}))};
}
async function delayed(input, hold, pendingStates) {
    const run=new NethackGame({...input,storage:new InMemoryStorage()}), display=new GameDisplay(null);
    const end=new Error('Input queue empty: bounded fountain town gate'); let used=0,finished=false;
    display.onEmptyQueue=async () => {
        await setImmediate();
        if (used === hold) {
            const before=snapshot(game,used), rng=[...getRngLog()];
            await setImmediate();
            assert.equal(finished,false);
            assert.deepEqual(snapshot(game,used),before,'state changes while answer is withheld');
            assert.deepEqual(getRngLog(),rng,'RNG changes while answer is withheld');
            pendingStates.push(before);
        }
        if (used === input.moves.length) throw end;
        return input.moves.charCodeAt(used++);
    };
    run._pendingDisplay=display;
    try { await run.start(); for(let i=0;i<1024&&!game.program_state?.gameover;i++) await moveloop_core(); }
    catch(e) { if(e!==end) throw e; }
    finished=true; assert.equal(used,input.moves.length); return run;
}
if (process.argv[2] === '--worker') {
    const part=JSON.parse(fs.readFileSync(process.argv[3])).segments[Number(process.argv[4])];
    const input=Object.fromEntries(['seed','datetime','nethackrc','moves'].map(k => [k,part[k]]));
    const mode=process.argv[5], hold=Number(process.argv[6]??-1), states=[],pendingStates=[];
    const previous=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'); let run;
    try {
        if(mode==='observer') globalThis.__step_snapshot={step:'*',cb(g,s){states.push(snapshot(g,s));}};
        run=(mode==='deferred'||mode==='pending') ? await delayed(input,hold,pendingStates)
            : await runSegment({...input,storage:new InMemoryStorage()});
    } finally {
        if(previous) Object.defineProperty(globalThis,'__step_snapshot',previous);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),previous);
    console.log('__TOWN_OUTPUT__'+JSON.stringify({outputs:outputs(run),states,pendingStates}));
} else {
    const inputPath=process.argv[2]||recipePath.pathname, inputBytes=fs.readFileSync(inputPath);
    const input=JSON.parse(inputBytes), reportPath=process.argv[3], reports=[],generated=[],rawOutputs=[];
    assert.equal(input.segments.length,recipe.segments.length);
    const categories=new Set(JSON.parse(fs.readFileSync(new URL('gen-sessions/coverage-requirements.json',import.meta.url))).requirements.map(r=>r.id));
    for(const tag of recipe.coverage) assert.ok(categories.has(tag),`unknown coverage tag ${tag}`);
    assert.deepEqual(branchAssertionErrors(recipe),[]);
    function worker(index,mode,hold=-1) {
        const child=spawnSync(process.execPath,[process.argv[1],'--worker',inputPath,String(index),mode,String(hold)],
            {encoding:'utf8',timeout:30000,maxBuffer:20*1024*1024});
        assert.equal(child.status,0,child.stderr||child.error?.message||child.stdout);
        const marker=child.stdout.lastIndexOf('__TOWN_OUTPUT__'); assert.ok(marker>=0);
        return JSON.parse(child.stdout.slice(marker+'__TOWN_OUTPUT__'.length));
    }
    for(const [index,part] of input.segments.entries()) {
        for(const field of ['name','seed','datetime','nethackrc','moves']) {
            assert.equal(Object.hasOwn(part,field),Object.hasOwn(recipe.segments[index],field));
            assert.deepEqual(part[field],recipe.segments[index][field]);
        }
        if(part.steps?.length) {
            assert.equal(input.version,5); assert.equal(input.source,'c');
            assert.deepEqual(part.steps.map(s=>s.key),[null,...part.moves]);
        }
        const seen=worker(index,'observer'),plain=worker(index,'plain'),late=worker(index,'deferred');
        const v=plain.outputs,states=seen.states,final=states.at(-1),h=hashes(v);
        assert.deepEqual(hashes(seen.outputs),h,'observer neutrality');
        assert.deepEqual(hashes(late.outputs),h,'deferred neutrality');
        assert.equal(v.screens.length,part.moves.length+1);
        assert.equal(v.cursors.length,v.screens.length);assert.equal(v.frames.length,v.screens.length);
        assert.equal(states.length,v.screens.length);assert.deepEqual(v.slices.flat(),v.rng);
        const text=v.screens.map(s=>decodeScreen(s).map(r=>r.map(c=>c.ch).join('')).join('\n'));
        const has=t=>text.some(s=>s.includes(t));
        const queries=states.filter(s=>s.pending?.startsWith('Dry up fountain?'));
        const [x,y]=index<2?[10,12]:index<6||index===8?[24,6]:[29,12];
        const warned=states.find(s=>(tile(s,x,y)?.looted&2)&&tile(s,x,y).typ===FOUNTAIN);
        await test(part.name+': actual producers and branch state',()=>{
            if(index<6||index===8) {
                assert.ok(warned?.town); assert.equal(watch(warned).length,5);
                assert.ok(watch(warned).every(m=>m.peace)); assert.equal(watch(final).length,5);
                assert.deepEqual(watch(final).map(m=>m.id),watch(warned).map(m=>m.id));
            }
            if(index<4) {
                const query=queries.at(-1); assert.ok(query);
                assert.equal(tile(query,x,y).typ,FOUNTAIN);assert.ok(tile(query,x,y).looted&2);
                assert.ok(watch(query).every(m=>m.peace));
                const accepted=index%2===0;
                assert.equal(part.moves[query.step],accepted?'y':'n');
                assert.equal(tile(final,x,y).typ,accepted?ROOM:FOUNTAIN);
                assert.ok(watch(final).every(m=>m.peace===!accepted));
                if(index<2) assert.ok(watch(warned).every(m=>!m.couldsee));
                else assert.ok(watch(warned).some(m=>m.couldsee));
            } else if(index===4||index===5) {
                assert.equal(queries.length,0);assert.ok(!has('You swap places'));
                const onFountain=states.find(s=>tile(s,x,y)?.typ===FOUNTAIN
                    && gremlins(s).some(m=>m.xy[0]===x&&m.xy[1]===y));
                assert.ok(onFountain);assert.notDeepEqual(onFountain.xy,[x,y]);
                const original=gremlins(onFountain).find(m=>m.xy[0]===x&&m.xy[1]===y);
                assert.equal(original.hp,20);assert.ok(original.tame>0);
                assert.equal(gremlins(final).length,2);
                assert.equal(gremlins(final).find(m=>m.id===original.id).hp,10);
                assert.equal(gremlins(final).find(m=>m.id!==original.id).hp,10);
                assert.equal(tile(final,x,y).typ,ROOM); assert.ok(watch(final).every(m=>m.peace));
                assert.equal(final.blind,index===5);assert.equal(tile(final,x,y).cansee,index===4);
                assert.equal(has('The fountain dries up!'),index===4);
            } else if(index===6||index===7) {
                const query=queries.at(-1);assert.ok(query?.fireResistant);
                const f=tile(query,x,y);assert.equal(f.typ,FOUNTAIN);assert.equal(f.cansee,true);
                assert.equal(f.glyph.kind,'cmap');assert.equal(f.glyph.cmap,cmap_names.S_cloud);
                assert.equal(part.moves[query.step],index===6?'y':'n');
                assert.equal(tile(final,x,y).typ,index===6?ROOM:FOUNTAIN);
                assert.ok(!has('The fountain dries up!'));
            } else {
                assert.ok(warned.deaf);assert.ok(watch(warned).some(m=>m.couldsee));
                assert.equal(queries.length,0);assert.equal(tile(final,x,y).typ,FOUNTAIN);
                assert.ok(watch(final).every(m=>m.peace));assert.ok(has('earnestly waves her arms!'));
            }
        });
        let pendingHashes=null,pendingStates=[];
        if([0,2,6].includes(index)) {
            const query=queries.at(-1),held=worker(index,'pending',query.step);
            pendingHashes=hashes(held.outputs);pendingStates=held.pendingStates;
            await test(part.name+': real unanswered query remains pending',()=>{
                assert.equal(pendingStates.length,1);assert.ok(pendingStates[0].pending.startsWith('Dry up fountain?'));
                assert.equal(tile(pendingStates[0],x,y).typ,FOUNTAIN);
                if(index!==6)assert.ok(watch(pendingStates[0]).every(m=>m.peace));
                assert.deepEqual(pendingHashes,h);
            });
        }
        reports.push({index,name:part.name,boundaries:v.screens.length,calls:v.rng.length,frames:v.frames.flat().length,
            hashes:h,observerHashes:hashes(seen.outputs),deferredHashes:hashes(late.outputs),pendingHashes,pendingStates,states});
        generated.push({steps:v.screens.map((screen,i)=>({screen,rng:v.slices[i]}))});rawOutputs.push(v);
    }
    const errors=branchAssertionErrors(recipe,{segments:generated});
    const native=input.segments.every(s=>s.steps?.length),nativeErrors=native?branchAssertionErrors(recipe,input):null;
    await test('nine canonical recipe assertions',()=>{assert.deepEqual(errors,[]);if(native)assert.deepEqual(nativeErrors,[]);});
    const report={evidence:'ordinary JS keys and actual producers; native branch assertions are supplementary, not full parity or C coverage',
        inputSHA256:createHash('sha256').update(inputBytes).digest('hex'),reports,
        totals:{boundaries:reports.reduce((n,r)=>n+r.boundaries,0),calls:reports.reduce((n,r)=>n+r.calls,0),frames:reports.reduce((n,r)=>n+r.frames,0)},
        observerHashes:reports.length*5,deferredHashes:reports.length*5,pendingHashes:15,
        recipeAssertions:{count:recipe.branchAssertions.length,jsErrors:errors,nativeChecked:native,nativeErrors}};
    if(reportPath){fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');fs.writeFileSync(reportPath.replace(/\.json$/,'.outputs.json'),JSON.stringify(rawOutputs)+'\n');}
    console.log(JSON.stringify({totals:report.totals,inputSHA256:report.inputSHA256}));
}
