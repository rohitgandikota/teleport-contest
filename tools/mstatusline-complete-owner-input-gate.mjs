// Ordinary keys only; the observer reads existing producer state.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {EDOG} from '../js/const.js';
import {PMNAMES} from '../js/monst_data.js';
import {ONAMES} from '../js/objects_data.js';
import {decodeScreen,renderCell} from '../frozen/screen-decode.mjs';
import {branchAssertionErrors} from './gen-sessions/assertions.mjs';
import coverage from './gen-sessions/coverage-requirements.json' with {type:'json'};

const recipe=JSON.parse(readFileSync(new URL('gen-sessions/recipes/mstatusline-complete-owner.json',import.meta.url)));
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const output=run=>({screens:run.getScreens(),cursors:run.getCursors(),calls:run.getRngLog(),
    slices:run.getRngSlices(),frames:run.getAnimationFramesByStep()});
const hashes=out=>Object.fromEntries(Object.entries(out).map(([key,value])=>[key,hash(value)]));
const plain=screen=>decodeScreen(screen).map(row=>row.map(renderCell).join('')).join('\n');

test('recipe has six supported inputs and only registered coverage tags',()=>{
    assert.equal(recipe.name,'mstatusline-complete-owner');assert.equal(recipe.segments.length,6);
    assert.equal(recipe.branchAssertions.length,6);assert.deepEqual(branchAssertionErrors(recipe),[]);
    const registered=new Set(coverage.requirements.map(r=>r.id));
    assert.ok(recipe.coverage.every(tag=>registered.has(tag)));
    assert.ok(recipe.segments.every(s=>typeof s.moves==='string'&&!Object.hasOwn(s,'steps')));
});
for(const [index,part] of recipe.segments.entries())test(part.name,async()=>{
    const expected=recipe.jsReach[index],states=[];
    const previous=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');
    let run;
    try {
        globalThis.__step_snapshot={step:'*',cb(g,step){
            const mon=g.level.monsters.find(m=>m.m_id===expected.target.id);
            if(!mon)return;
            const dog=EDOG(mon),tail=[];
            if(mon.wormno)
                for(let seg=g.worms.wtails[mon.wormno];seg;seg=seg.nseg)tail.push([seg.wx,seg.wy]);
            states.push({step,wizard:g.wizard,hero:[g.u.ux,g.u.uy],hp:g.u.uhp,
                mortality:g.u.umortality||0,hit:g.bhitpos?{...g.bhitpos}:null,notonhead:g.notonhead,
                mon:{id:mon.m_id,mnum:mon.mnum,cham:mon.cham,dataIsInnate:mon.data===g.mons[mon.cham],
                    xy:[mon.mx,mon.my],...(mon.wormno===undefined?{}:{wormno:mon.wormno}),tame:mon.mtame,
                    ...(mon.isminion===undefined?{}:{minion:mon.isminion}),
                    edog:dog?{hungrytime:dog.hungrytime,apport:dog.apport}:null,
                    hp:mon.mhp,sleeping:mon.msleeping,peaceful:mon.mpeaceful},
                dataIsCurrentSpecies:mon.data===g.mons[mon.mnum],size:mon.data.msize,tail,
                inventory:(g.invent||[]).map(o=>({type:o.otyp,letter:o.invlet}))});
        }};
        run=await runSegment({...part,storage:new InMemoryStorage()});
    }finally{
        if(previous)Object.defineProperty(globalThis,'__step_snapshot',previous);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),previous);
    const out=output(run),actualHashes=hashes(out);
    const unobserved=output(await runSegment({...part,storage:new InMemoryStorage()}));
    assert.deepEqual(actualHashes,hashes(unobserved),'observer preserves all five original output hashes');
    assert.deepEqual(actualHashes,expected.originalOutputHashes);
    if(expected.negative)assert.deepEqual(actualHashes,expected.baselineNegativeHashes);
    assert.equal(out.screens.length,part.moves.length+1);assert.equal(out.screens.length,expected.boundaries);
    assert.equal(out.cursors.length,expected.boundaries);assert.equal(out.slices.length,expected.boundaries);
    assert.equal(out.calls.length,expected.calls);assert.equal(out.frames.flat().length,expected.frames);
    assert.deepEqual(out.slices.flat(),out.calls);
    for(const call of out.calls)assert.match(call.replace(/\s+@\s*.*$/,''),/^(?:~d)?(?:rn2|rnd|rn1|rnl|rne|rnz|d)\(-?\d+(?:,\s*-?\d+)*\)=-?\d+$/);
    const at=states.find(s=>s.step===expected.selectedStep);assert.ok(at);
    assert.deepEqual(at.mon,expected.target);assert.deepEqual(at.hero,expected.hero);
    assert.deepEqual(at.hit,expected.hit);assert.equal(at.notonhead,expected.notonhead);
    assert.equal(at.wizard,expected.wizard);assert.equal(at.hp,expected.hp);assert.equal(at.mortality,0);
    assert.equal(at.dataIsCurrentSpecies,true);
    assert.ok(at.inventory.some(o=>o.type===ONAMES.STETHOSCOPE&&o.letter===(index===5?'c':'a')));
    const text=plain(out.screens[expected.selectedStep]);assert.ok(text.includes('Status of'));
    if(index<4)assert.ok(text.includes('--More--'));
    if(index===0||index===5){
        assert.equal(at.mon.mnum,PMNAMES.PM_LITTLE_DOG);assert.equal(at.mon.tame,10);assert.ok(at.mon.edog);
        if(index===0)assert.ok(text.includes(`hungry ${at.mon.edog.hungrytime}; apport ${at.mon.edog.apport}`));
        else assert.doesNotMatch(text,/hungry|apport/);
    }
    if(index===1||index===2){
        assert.equal(at.mon.mnum,PMNAMES.PM_LONG_WORM);assert.equal(at.size,7);
        assert.deepEqual(at.tail,expected.worms[String(at.mon.wormno)]);
        assert.equal(at.tail.length,3);assert.deepEqual(at.tail.at(-1),at.mon.xy);
        assert.deepEqual(at.tail[index===1?2:1],[at.hit.x,at.hit.y]);
        assert.ok(text.includes(index===1?'1st of 3 segments':'2nd of 3 segments'));
        assert.equal(part.moves[expected.commandDirectionStep-1],index===1?'l':'n');
    }
    if(index===3){
        assert.equal(at.mon.cham,PMNAMES.PM_CHAMELEON);assert.equal(at.mon.dataIsInnate,false);
        assert.match(text,/shapechanger/);assert.doesNotMatch(text,/chameleon/);
    }
    const generated={segments:recipe.segments.map((_s,i)=>i===index?{
        steps:out.screens.map((screen,step)=>({screen,rng:out.slices[step]}))}:{steps:[]})};
    assert.deepEqual(branchAssertionErrors({...recipe,branches:[recipe.branches[index]],
        branchAssertions:[recipe.branchAssertions[index]]},generated),[]);
    console.log(JSON.stringify({name:part.name,boundaries:out.screens.length,calls:out.calls.length,
        frames:out.frames.flat().length,selectedStep:expected.selectedStep,observerFiveHashesExact:true,
        negativeFiveHashesExact:expected.negative,hashes:actualHashes,evidence:'JS actual input only; independent C recording pending.'}));
});
