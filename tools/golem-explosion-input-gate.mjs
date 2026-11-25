// Ordinary keyboard inputs, read-only snapshots, and five-collection neutrality.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {decodeScreen,renderCell} from '../frozen/screen-decode.mjs';
import {PMNAMES as P} from '../js/monst_data.js';
import {MSLOW} from '../js/const.js';
const recipe=JSON.parse(readFileSync(new URL('gen-sessions/recipes/polymorph-explosion-golem-feedback.json',import.meta.url)));
const outputs=run=>({screens:run.getScreens(),cursors:run.getCursors(),rng:run.getRngLog(),slices:run.getRngSlices(),frames:run.getAnimationFramesByStep()});
for(const [index,part]of recipe.segments.entries())test(`ordinary explosion: ${part.name}`,async()=>{
    const rows=[],previous=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');let run;
    try{
        globalThis.__step_snapshot={step:'*',cb(g,step){rows.push({step,form:g.u.umonnum,natural:g.u.umonster,mnum:g.youmonst.mnum,
            canonical:g.youmonst.data===g.mons[g.u.umonnum],hero:[g.u.ux,g.u.uy],mortality:g.u.umortality||0,
            monsters:g.level.monsters.map(m=>({id:m.m_id,type:m.mnum,canonical:m.data===g.mons[m.mnum],xy:[m.mx,m.my],
                hp:m.mhp,max:m.mhpmax,speed:m.mspeed,permanent:m.permspeed,sleeping:!!m.msleeping,peaceful:!!m.mpeaceful}))});}};
        run=await runSegment({...part,storage:new InMemoryStorage()});
    }finally{if(previous)Object.defineProperty(globalThis,'__step_snapshot',previous);else delete globalThis.__step_snapshot;}
    const observed=outputs(run),unobserved=outputs(await runSegment({...part,storage:new InMemoryStorage()}));
    for(const key of Object.keys(observed))assert.deepEqual(observed[key],unobserved[key],key+' observer neutrality');
    const attack=index<2?87:60,pre=rows[attack-1],last=rows.at(-1);
    assert.equal(rows.length,index<2?108:81);assert.equal(rows.length,part.moves.length+1);
    assert.ok(rows.every(r=>r.canonical&&r.mnum===r.form&&r.mortality===0));
    assert.equal(pre.form,P.PM_FREEZING_SPHERE);assert.ok(part.moves.includes('#polyself\rfreezing sphere\r'));
    assert.equal(part.moves[attack-2],'F');assert.equal(last.form,last.natural);
    const target=pre.monsters.find(m=>m.type===(index<2?P.PM_FLESH_GOLEM:P.PM_GOBLIN));
    assert.ok(target?.canonical&&target.sleeping&&!target.peaceful);
    assert.equal(Math.max(...target.xy.map((v,i)=>Math.abs(v-pre.hero[i]))),1);
    if(index<2){
        assert.ok(part.moves.includes('#levelchange\r10\r'));
        const after=last.monsters.find(m=>m.id===target.id);assert.ok(after);assert.equal(after.hp,target.hp);
        assert.equal(after.sleeping,false);assert.equal(after.speed,MSLOW);assert.equal(after.permanent,MSLOW);
    }else assert.ok(!last.monsters.some(m=>m.id===target.id));
    const top=observed.screens.map(s=>decodeScreen(s).slice(0,2).map(row=>row.map(renderCell).join('')).join('\n'));
    const text=top.slice(attack).join('\n');
    for(const phrase of recipe.branchAssertions[index].screenIncludes)assert.ok(text.includes(phrase),phrase);
    if(index===1)assert.doesNotMatch(text,/<49,10>:/);
    if(index===2)assert.doesNotMatch(text,/seems to be moving slower/);
    assert.equal(observed.rng.filter(c=>/^d\(4,6\)=/.test(c)).length,1);
    assert.equal(observed.frames.flat().length,21);
});
