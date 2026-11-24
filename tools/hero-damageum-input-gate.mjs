// Ordinary keyboard proposals, not native oracles. All observation is read-only.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {decodeScreen,renderCell} from '../frozen/screen-decode.mjs';
import {PMNAMES as P} from '../js/monst_data.js';
import {MSLOW} from '../js/const.js';
const recipe=JSON.parse(readFileSync(new URL('gen-sessions/recipes/hero-natural-damage-dispatch.json',import.meta.url)));
const expected=[
    {form:P.PM_SKELETON,target:P.PM_OGRE,created:47,count:56},
    {form:P.PM_RUST_MONSTER,target:P.PM_IRON_GOLEM,created:57,count:66},
    {form:P.PM_XAN,target:P.PM_OGRE,created:42,count:51},
    {form:P.PM_VROCK,target:P.PM_MINOTAUR,created:48,count:57},
    {form:P.PM_DINGO,target:P.PM_OGRE,created:44,count:53},
];
for(const [index,part] of recipe.segments.entries())test(`ordinary hero damage route: ${part.name}`,async()=>{
    const want=expected[index],rows=[],previous=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');
    let run;
    try {
        globalThis.__step_snapshot={step:'*',cb(g,step){rows.push({step,hero:g.u.umonnum,
            canonicalHero:g.youmonst.data===g.mons[g.u.umonnum],mortality:g.u.umortality||0,kills:g.u.uconduct.killer,
            monsters:g.level.monsters.map(m=>({id:m.m_id,species:m.mnum,canonical:m.data===g.mons[m.mnum],
                hp:m.mhp,tame:m.mtame,speed:m.mspeed,sleep:m.msleeping,edog:!!m.edog}))});}};
        run=await runSegment({...part,storage:new InMemoryStorage()});
    } finally {
        if(previous)Object.defineProperty(globalThis,'__step_snapshot',previous);else delete globalThis.__step_snapshot;
    }
    assert.equal(run.getScreens().length,want.count);
    assert.equal(rows.length,want.count);
    const created=rows.find(r=>r.step===want.created),last=rows.at(-1);
    assert.equal(created.hero,want.form);assert.equal(last.hero,want.form);
    assert.ok(created.canonicalHero&&last.canonicalHero);
    const target=created.monsters.find(m=>m.species===want.target);
    assert.ok(target?.canonical);assert.ok(target.sleep);assert.ok(target.hp>0);
    assert.ok(rows.every(r=>r.mortality===0));
    const finalTarget=last.monsters.find(m=>m.id===target.id);
    const text=run.getScreens().map(s=>decodeScreen(s).slice(0,2).map(row=>row.map(renderCell).join('')).join('\n')).join('\n');
    for(const line of recipe.branchAssertions[index].screenIncludes)assert.ok(text.includes(line),line);
    for(const line of recipe.branchAssertions[index].screenExcludes)assert.ok(!text.includes(line),line);
    if(index===0){assert.equal(finalTarget.speed,MSLOW);assert.ok(finalTarget.hp<target.hp);}
    else if(index===1){assert.equal(finalTarget,undefined);assert.equal(last.kills,1);}
    else if(index===2){assert.equal(finalTarget.hp,25);assert.equal(finalTarget.speed,0);}
    else if(index===3){
        const ids=new Set(created.monsters.map(m=>m.id));
        const pets=last.monsters.filter(m=>!ids.has(m.id)&&m.tame>0);
        assert.ok(pets.length>0);assert.ok(pets.every(m=>m.canonical&&m.edog));
    }else{assert.equal(finalTarget.hp,16);assert.equal(finalTarget.speed,0);assert.equal(last.kills,0);}
});
