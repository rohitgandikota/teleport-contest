// Read-only ordinary-input reach and independent native provenance.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {ONAMES as O} from '../js/objects_data.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {decodeScreen} from '../frozen/screen-decode.mjs';
import {branchAssertionErrors} from './gen-sessions/assertions.mjs';
import coverage from './gen-sessions/coverage-requirements.json' with {type:'json'};
const recipe=JSON.parse(readFileSync(new URL('gen-sessions/recipes/trap-monster-hit.json',import.meta.url)));
const nativeBytes=readFileSync(new URL('gen-sessions/generated/trap-monster-hit.session.json',import.meta.url));
const native=JSON.parse(nativeBytes);
test('recipe name, registered tags and observable assertions',()=>{
    assert.equal(recipe.name,'trap-monster-hit');
    assert.equal(recipe.segments.length,4);
    assert.deepEqual(branchAssertionErrors(recipe),[]);
    for(const tag of recipe.coverage)assert.ok(coverage.requirements.some(r=>r.id===tag));
});
test('unchanged native source, input tuples, keys and visible assertions',()=>{
    assert.equal(createHash('sha256').update(nativeBytes).digest('hex'),
        'cc30cf36f074d05c2b7da899686aa1118aa63cadda815a416a26d2b4dcb7979f');
    assert.equal(native.source,'c');assert.equal(native.version,5);
    assert.equal(native.segments.length,4);
    for(const [i,part]of native.segments.entries()) {
        for(const field of ['name','seed','datetime','nethackrc','moves'])
            assert.equal(part[field],recipe.segments[i][field]);
        assert.equal(part.steps.length,part.moves.length+1);
        for(const [step,recorded]of part.steps.entries())
            assert.equal(recorded.key,step?part.moves[step-1]:null);
        const visible=part.steps.map(s=>decodeScreen(s.screen)
            .map(row=>row.map(c=>c.ch).join('')).join('\n')).join('\n');
        assert.ok(!/Die\? \[yn\]|OK, so you don't die/.test(visible));
    }
    assert.deepEqual(branchAssertionErrors(recipe,native),[]);
});
for(const [index,part] of recipe.segments.entries())test(part.name,async()=>{
    const states=[],previous=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');
    let run;
    try {
        globalThis.__step_snapshot={step:'*',cb(g,step){
            states.push({step,hp:g.u.uhp,mortality:g.u.umortality||0,disintegested:!!g.disintegested,
                monsters:g.level.monsters.map(m=>({id:m.m_id,type:m.mnum,hp:m.mhp,x:m.mx,y:m.my})),
                traps:g.level.traps.map(t=>({type:t.ttyp,x:t.tx,y:t.ty,once:t.once,seen:t.tseen})),
                objects:g.level.objects.map(o=>({type:o.otyp,x:o.ox,y:o.oy,where:o.where}))});
        }};
        run=await runSegment({...part,storage:new InMemoryStorage()});
    }finally{
        if(previous)Object.defineProperty(globalThis,'__step_snapshot',previous);
        else delete globalThis.__step_snapshot;
    }
    assert.equal(run.getScreens().length,part.moves.length+1);
    const visible=run.getScreens().map(s=>decodeScreen(s).map(r=>r.map(c=>c.ch).join('')).join('\n')).join('\n');
    assert.ok(!/Die\? \[yn\]|OK, so you don't die/.test(visible));
    assert.ok(states.every(s=>s.hp>0 && s.mortality===0));
    const species=part.name==='cat-rock'?P.PM_LARGE_CAT:part.name==='paper-fire'?P.PM_PAPER_GOLEM:P.PM_XORN;
    const first=states.flatMap(s=>s.monsters).find(m=>m.type===species);
    assert.ok(first,'real monster creation reached');
    const entry=states.find(s=>s.monsters.some(m=>m.id===first.id
        && s.traps.some(t=>t.x===m.x&&t.y===m.y)));
    assert.ok(entry,'monster actually reaches its trap');
    const last=states.at(-1),mon=last.monsters.find(m=>m.id===first.id);
    const target=entry.monsters.find(m=>m.id===first.id);
    // Fire reveals its trap after damage and death, at the caller's tail.
    const triggered=last.traps.find(t=>t.x===target.x&&t.y===target.y);
    assert.ok(triggered?.seen);
    if(part.name!=='paper-fire')assert.equal(triggered.once,1);
    if(part.name==='paper-fire') {
        assert.ok(!mon);assert.ok(last.disintegested);
        assert.ok(!last.objects.some(o=>o.type===O.SCR_BLANK_PAPER));
    } else {
        assert.ok(mon);
        if(part.name==='xorn-rock')assert.equal(mon.hp,first.hp);
        else assert.ok(mon.hp<first.hp);
        const rock=last.objects.some(o=>o.type===O.ROCK && o.x===mon.x&&o.y===mon.y);
        assert.equal(rock,part.name!=='xorn-arrow');
    }
    const slices=run.getRngSlices();
    const generated={source:'js',segments:recipe.segments.map((s,i)=>i===index?
        {...s,steps:run.getScreens().map((screen,j)=>({screen,rng:slices[j]}))}:null)};
    assert.deepEqual(branchAssertionErrors({...recipe,branches:[recipe.branches[index]],
        branchAssertions:[recipe.branchAssertions[index]]},generated),[]);
});
