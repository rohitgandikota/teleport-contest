// Actual keyboard producers and read-only observations, not a native oracle.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {decodeScreen,renderCell} from '../frozen/screen-decode.mjs';
import {PMNAMES as P,ATTKS as A} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import * as C from '../js/const.js';
const recipe=JSON.parse(readFileSync(new URL('gen-sessions/recipes/polymorph-weapon-slots.json',import.meta.url)));
const expected=[
    {form:P.PM_ETTIN,birth:112,attack:115,count:126,primary:O.DAGGER,swings:2,hit:1,erosion:[0,1]},
    {form:P.PM_ETTIN,birth:122,attack:125,count:136,primary:O.TWO_HANDED_SWORD,swings:1,hit:1,erosion:[1,0]},
    {form:P.PM_ETTIN,birth:122,attack:125,count:136,primary:O.TWO_HANDED_SWORD,swings:2,hit:1,erosion:[1,0]},
    {form:P.PM_ETTIN,birth:151,attack:154,count:165,primary:O.DAGGER,swings:2,hit:1,erosion:[1,0]},
    {form:P.PM_GNOME,birth:112,attack:115,count:126,primary:O.DAGGER,swings:1,hit:0,erosion:[0,0]},
    {form:P.PM_WIZARD,birth:92,attack:95,count:106,primary:O.DAGGER,swings:1,hit:0,erosion:[0,0]},
];
const object=o=>o&&({id:o.o_id,type:o.otyp,spe:o.spe,cursed:!!o.cursed,erosion:o.oeroded||0,where:o.where,worn:o.owornmask});
for(const [index,part]of recipe.segments.entries())test(`ordinary polymorph weapon slots: ${part.name}`,async()=>{
    const rows=[],previous=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');let run;
    try{
        globalThis.__step_snapshot={step:'*',cb(g,step){rows.push({step,hero:[g.u.ux,g.u.uy],form:g.u.umonnum,
            canonical:g.youmonst.data===g.mons[g.u.umonnum],attacks:g.youmonst.data.mattk.map(a=>[...a]),
            mortality:g.u.umortality||0,twoweap:!!g.u.twoweap,twohits:g.twohits||0,weaphit:g.u.uconduct.weaphit,
            primary:object(g.u.uwep),secondary:object(g.u.uswapwep),inventory:(g.invent||[]).map(object),floor:g.level.objects.map(object),
            monsters:g.level.monsters.map(m=>({id:m.m_id,type:m.mnum,canonical:m.data===g.mons[m.mnum],xy:[m.mx,m.my],hp:m.mhp,sleeping:!!m.msleeping}))});}};
        run=await runSegment({...part,storage:new InMemoryStorage()});
    }finally{
        if(previous)Object.defineProperty(globalThis,'__step_snapshot',previous);
        else delete globalThis.__step_snapshot;
    }
    const want=expected[index],birth=rows[want.birth],pre=rows[want.attack-1],last=rows.at(-1);
    assert.equal(rows.length,want.count);assert.equal(run.getScreens().length,want.count);
    assert.equal(part.moves.length+1,want.count);assert.ok(rows.every(r=>r.mortality===0));
    assert.equal(pre.form,want.form);assert.equal(pre.canonical,true);assert.equal(pre.twoweap,false);
    assert.equal(pre.primary.type,want.primary);assert.equal(pre.secondary.type,O.LONG_SWORD);
    assert.ok(pre.primary.worn&C.W_WEP);assert.ok(pre.secondary.worn&C.W_SWAPWEP);
    assert.equal(pre.primary.id,birth.primary.id);assert.equal(pre.secondary.id,birth.secondary.id);
    const target=birth.monsters.find(m=>m.type===P.PM_RUST_MONSTER);
    assert.ok(target?.canonical&&target.sleeping);
    assert.equal(Math.max(...target.xy.map((v,i)=>Math.abs(v-pre.hero[i]))),1);
    assert.equal(last.weaphit,want.hit);
    const top=run.getScreens().map(s=>decodeScreen(s).slice(0,2).map(row=>row.map(renderCell).join('')).join('\n'));
    for(const phrase of recipe.branchAssertions[index].screenIncludes)assert.ok(top.join('\n').includes(phrase),phrase);
    const attackCalls=run.getRngSlices().slice(want.attack).flat();
    assert.equal(attackCalls.filter(c=>/^rnd\(20\)=/.test(c)).length,want.swings);
    assert.equal(last.primary.erosion,want.erosion[0]);
    if(index<4){
        assert.equal(pre.attacks.filter(a=>a[0]===A.AT_WEAP).length,2);
        assert.ok(rows.some(r=>r.step>=want.attack&&r.twohits===want.swings));
    }
    if(index===3){
        assert.ok(part.moves.includes('#dip\rbc'));
        const cursed=rows.find(r=>r.secondary?.cursed);
        assert.ok(cursed&&cursed.step<want.birth);
        const prior=rows[cursed.step-1];assert.equal(prior.secondary.cursed,false);
        assert.ok(prior.inventory.some(o=>o.type===O.POT_WATER&&o.cursed));
        assert.equal(last.secondary,null);assert.equal(last.inventory.some(o=>o.id===pre.secondary.id),false);
        const dropped=last.floor.find(o=>o.id===pre.secondary.id);
        assert.ok(dropped?.cursed);assert.equal(dropped.where,C.OBJ_FLOOR);assert.equal(dropped.erosion,want.erosion[1]);
        assert.ok(top[155].includes('You miss the rust monster.'));
        assert.ok(top[156].includes('evades your grasp'),'cursed alternate drops even after a miss');
    }else{
        assert.equal(pre.secondary.cursed,false);assert.equal(last.secondary.id,pre.secondary.id);
        assert.equal(last.secondary.erosion,want.erosion[1]);
    }
    if(index===0)assert.ok(top[want.attack].includes('You miss the rust monster.  You hit'));
    if(index===1)assert.equal(pre.primary.spe,5);
    if(index===2){assert.equal(pre.primary.spe,0);assert.ok(top[want.attack].includes('You miss the rust monster.  You hit'));}
    assert.equal(last.twohits,0);
});
