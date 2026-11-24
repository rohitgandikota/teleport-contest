// Ordinary keyboard route proof. Read-only observations, no native oracle.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {could_seduce} from '../js/mhitu.js';
import {canspotmon} from '../js/display.js';
import {decodeScreen,renderCell} from '../frozen/screen-decode.mjs';
import {PMNAMES as P,ATTKS as A} from '../js/monst_data.js';
const recipe=JSON.parse(readFileSync(new URL('gen-sessions/recipes/hero-polymorph-seduction-miss.json',import.meta.url)));
const expected=[
    {form:P.PM_WOOD_NYMPH,before:56,boundaries:65,compat:1,unseen:false},
    {form:P.PM_WOOD_NYMPH,before:58,boundaries:67,compat:2,unseen:false},
    {form:P.PM_WOOD_NYMPH,before:67,boundaries:76,compat:1,unseen:true},
    {form:P.PM_AMOROUS_DEMON,before:53,boundaries:62,compat:0,unseen:false},
    {form:P.PM_GNOME,before:51,boundaries:60,compat:0,unseen:false},
    {form:P.PM_GNOME,before:62,boundaries:71,compat:0,unseen:true},
];
for(const [index,part] of recipe.segments.entries())test(`ordinary miss: ${part.name}`,async()=>{
    const rows=[],previous=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');let run;
    try{
        globalThis.__step_snapshot={step:'*',cb(g,step){rows.push({step,form:g.u.umonnum,
            canonical:g.youmonst.data===g.mons[g.u.umonnum],xy:[g.u.ux,g.u.uy],female:!!g.flags.female,
            accuracy:g.u.uhitinc||0,weapon:g.u.uwep?.otyp,mortality:g.u.umortality||0,
            attacks:g.youmonst.data.mattk.map(a=>[...a]),inventory:(g.invent||[]).map(o=>o.o_id),
            monsters:g.level.monsters.map(m=>({id:m.m_id,type:m.mnum,canonical:m.data===g.mons[m.mnum],
                xy:[m.mx,m.my],hp:m.mhp,max:m.mhpmax,sleep:!!m.msleeping,peace:!!m.mpeaceful,
                female:!!m.female,invisible:!!m.minvis,spotted:canspotmon(m),
                compatibility:g.youmonst.data.mattk.map(a=>could_seduce(g.youmonst,m,a)),
                inventory:(m.minvent||[]).map(o=>o.o_id)}))});}};
        run=await runSegment({...part,storage:new InMemoryStorage()});
    }finally{if(previous)Object.defineProperty(globalThis,'__step_snapshot',previous);else delete globalThis.__step_snapshot;}
    const want=expected[index],before=rows.find(r=>r.step===want.before),last=rows.at(-1);
    assert.equal(rows.length,want.boundaries);assert.equal(run.getScreens().length,want.boundaries);
    assert.equal(part.moves.length+1,want.boundaries);assert.ok(rows.every(r=>r.mortality===0));
    assert.equal(before.form,want.form);assert.ok(before.canonical);assert.equal(before.weapon,undefined);
    assert.equal(before.accuracy,0);assert.equal(part.moves.includes('\x17'),false,'no wish or accuracy-ring detour');
    const target=before.monsters.find(m=>m.type===P.PM_OGRE);assert.ok(target?.canonical&&target.sleep);
    assert.equal(target.peace,false);assert.equal(target.invisible,want.unseen);assert.equal(target.spotted,!want.unseen);
    assert.equal(target.compatibility[0],want.compat);
    const delta=target.xy.map((n,i)=>n-before.xy[i]);assert.equal(Math.max(...delta.map(Math.abs)),1);
    assert.ok('hjklyubn'.includes(part.moves[want.before]),'actual adjacent directional attack');
    if(want.unseen)assert.equal(part.moves[want.before-1],'F','real force-fight prefix');
    const tops=run.getScreens().map(s=>decodeScreen(s).slice(0,2).map(r=>r.map(renderCell).join('')).join('\n'));
    const text=tops.join('\n'),branch=recipe.branchAssertions[index];
    for(const line of branch.screenIncludes)assert.ok(text.includes(line),line);
    for(const line of branch.screenExcludes)assert.ok(!text.includes(line),line);
    if(index<3){
        assert.deepEqual(before.attacks.slice(0,2).map(a=>a[1]),[A.AD_SITM,A.AD_SEDU]);
        assert.deepEqual(target.compatibility.slice(0,2),[want.compat,want.compat]);
        assert.equal(before.female,true);assert.equal(target.female,index===1);
        const final=last.monsters.find(m=>m.id===target.id);assert.ok(final?.sleep);
        assert.equal(final.hp,target.hp);assert.equal(final.max,target.max);assert.equal(final.peace,target.peace);
        assert.deepEqual(final.inventory,target.inventory);assert.deepEqual(last.inventory,before.inventory);
        assert.equal(last.form,want.form);
        assert.ok(tops[want.before+1].includes(branch.screenIncludes[0]));
        if(index<2){
            assert.ok(tops[want.before+1].includes('--More--'));
            assert.ok(tops[want.before+2].includes(branch.screenIncludes[0]));
        }else assert.equal(tops[want.before+1].split(branch.screenIncludes[0]).length-1,2);
    }else{
        assert.ok(tops[want.before+1].includes(branch.screenIncludes[0]),'first attack really misses');
        if(index===3)assert.equal(before.female,target.female);
    }
});
