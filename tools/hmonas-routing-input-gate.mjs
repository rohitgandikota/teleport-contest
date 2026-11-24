// Ordinary keyboard proposal checks. Read-only observation, no native claims.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {decodeScreen,renderCell} from '../frozen/screen-decode.mjs';
import {could_seduce,getmattk} from '../js/mhitu.js';
import {PMNAMES as P,ATTKS as A} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
const recipe=JSON.parse(readFileSync(new URL('gen-sessions/recipes/hero-polymorph-weapon-seduction.json',import.meta.url)));
const expected=[
    {form:P.PM_LICH,target:P.PM_OGRE,before:70,count:81,type:A.AD_COLD,compat:0,weapon:true},
    {form:P.PM_LICH,target:P.PM_ICE_TROLL,before:75,count:86,type:A.AD_PHYS,compat:0,weapon:true},
    {form:P.PM_BARROW_WIGHT,target:P.PM_OGRE,before:127,count:138,type:A.AD_DRLI,compat:0,weapon:true},
    {form:P.PM_WOOD_NYMPH,target:P.PM_OGRE,before:105,count:116,type:A.AD_SITM,compat:1,weapon:false},
    {form:P.PM_WOOD_NYMPH,target:P.PM_OGRE,before:107,count:118,type:A.AD_SITM,compat:2,weapon:false},
    {form:P.PM_AMOROUS_DEMON,target:P.PM_OGRE,before:102,count:113,type:A.AD_SSEX,compat:0,weapon:false},
];
for(const [index,part] of recipe.segments.entries())test(`ordinary hmonas: ${part.name}`,async()=>{
    const rows=[],previous=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');let run;
    try {
        globalThis.__step_snapshot={step:'*',cb(g,step){rows.push({step,hero:g.u.umonnum,
            canonical:g.youmonst.data===g.mons[g.u.umonnum],female:!!g.flags.female,
            xy:[g.u.ux,g.u.uy],mortality:g.u.umortality||0,weapon:g.u.uwep?.otyp,
            accuracy:g.u.uhitinc||0,ring:g.u.uright&&[g.u.uright.otyp,g.u.uright.spe],
            inventory:(g.invent||[]).map(o=>({id:o.o_id,type:o.otyp})),
            monsters:g.level.monsters.map(m=>({id:m.m_id,species:m.mnum,canonical:m.data===g.mons[m.mnum],
                xy:[m.mx,m.my],hp:m.mhp,max:m.mhpmax,level:m.m_lev,sleep:!!m.msleeping,peace:!!m.mpeaceful,
                female:!!m.female,compat:could_seduce(g.youmonst,m,g.youmonst.data.mattk[0]),
                selected:getmattk(g.youmonst,m,0,Array(6).fill(0))[1],
                inventory:(m.minvent||[]).map(o=>({id:o.o_id,type:o.otyp}))}))});}};
        run=await runSegment({...part,storage:new InMemoryStorage()});
    }finally{if(previous)Object.defineProperty(globalThis,'__step_snapshot',previous);else delete globalThis.__step_snapshot;}
    const want=expected[index],created=rows.find(r=>r.step===want.before),last=rows.at(-1);
    assert.equal(rows.length,want.count);assert.equal(run.getScreens().length,want.count);
    assert.ok(rows.every(r=>r.mortality===0));assert.equal(created.hero,want.form);assert.equal(last.hero,want.form);
    assert.ok(created.canonical&&last.canonical);
    assert.equal(created.weapon,want.weapon?O.CLUB:undefined);
    if(index>=2){assert.deepEqual(created.ring,[O.RIN_INCREASE_ACCURACY,10]);assert.equal(created.accuracy,10);}
    const target=created.monsters.find(m=>m.species===want.target);assert.ok(target?.canonical&&target.sleep);
    assert.equal(target.peace,false);assert.equal(target.compat,want.compat);assert.equal(target.selected,want.type);
    const delta=target.xy.map((value,axis)=>value-created.xy[axis]);
    assert.equal(Math.max(...delta.map(Math.abs)),1,'actual adjacent target before attack key');
    assert.ok(['h','j','k','l','y','u','b','n'].includes(part.moves[want.before]));
    const text=run.getScreens().map(s=>decodeScreen(s).slice(0,2).map(row=>row.map(renderCell).join('')).join('\n')).join('\n');
    for(const line of recipe.branchAssertions[index].screenIncludes)assert.ok(text.includes(line),line);
    for(const line of recipe.branchAssertions[index].screenExcludes)assert.ok(!text.includes(line),line);
    const finalTarget=last.monsters.find(m=>m.id===target.id);
    if(index===0)assert.equal(finalTarget,undefined,'cold follows real weapon hit and kills');
    else if(index===1){assert.equal(finalTarget.sleep,false);assert.equal(finalTarget.max,target.max);}
    else if(index===2){assert.equal(finalTarget.level,3);assert.equal(finalTarget.max,6);assert.equal(finalTarget.hp,1);}
    else {
        const item=target.inventory.find(o=>o.type===O.CLUB);assert.ok(item,'real generated weapon available for theft');
        assert.ok(last.inventory.some(o=>o.id===item.id));assert.equal(finalTarget.inventory.some(o=>o.id===item.id),false);
        if(index===3||index===4){
            assert.equal(finalTarget.sleep,true);assert.equal(finalTarget.hp,target.hp);assert.equal(finalTarget.peace,target.peace);
            assert.equal(finalTarget.female,index===4);assert.equal(last.female,true);
        }else{
            assert.equal(finalTarget.female,last.female);assert.equal(finalTarget.sleep,false);assert.ok(finalTarget.hp<target.hp);
        }
    }
});
