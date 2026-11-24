// Ordinary commands only. This gate is JS reach evidence, not a native oracle.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { PMNAMES as P, ATTKS as A } from '../js/monst_data.js';
import { decodeScreen } from '../frozen/screen-decode.mjs';
import { branchAssertionErrors } from './gen-sessions/assertions.mjs';
import tags from './gen-sessions/coverage-requirements.json' with { type: 'json' };
const recipe=JSON.parse(readFileSync(new URL('gen-sessions/recipes/monster-damage-type-dispatch.json',import.meta.url)));
const expected=[[P.PM_XAN,A.AD_LEGS,P.PM_OGRE,58],
    [P.PM_DISENCHANTER,A.AD_ENCH,P.PM_OGRE,67], [P.PM_LITTLE_DOG,A.AD_PHYS,P.PM_NEWT,65]];
test('recipe has registered categories and meaningful branch assertions',()=>{
    assert.deepEqual(branchAssertionErrors(recipe),[]);
    const names=new Set(tags.requirements.map(r=>r.id));
    for(const key of recipe.coverage)assert.ok(names.has(key),key);
});
for(const [i,part] of recipe.segments.entries())test(`${part.name}: ordinary creation and actual attack outcome`,async()=>{
    const [petSpecies,adtyp,targetSpecies,count]=expected[i];
    const rows=[],descriptor=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');let replay;
    try {
        globalThis.__step_snapshot={step:'*',cb(g,step){
            const pet=g.level?.monsters.find(m=>m.mnum===petSpecies&&m.mtame);
            const targets=(g.level?.monsters||[]).filter(m=>m.mnum===targetSpecies);
            rows.push({step,pet:pet&&{id:pet.m_id,xy:[pet.mx,pet.my],cancelled:!!pet.mcan,
                attack:pet.data.mattk.some(a=>a[0]!==A.AT_NONE&&a[1]===adtyp)},
                targets:targets.map(m=>({id:m.m_id,hp:m.mhp,xy:[m.mx,m.my],asleep:!!m.msleeping,
                    hostile:!m.mtame&&!m.mpeaceful}))});
        }};
        replay=await runSegment({...part,storage:new InMemoryStorage()});
    }finally{if(descriptor)Object.defineProperty(globalThis,'__step_snapshot',descriptor);else delete globalThis.__step_snapshot;}
    assert.equal(replay.getScreens().length,count);
    const created=rows.find(r=>r.pet&&r.targets.some(m=>m.asleep&&m.hostile));
    assert.ok(created?.pet.attack);assert.equal(created.pet.cancelled,false);
    const target=created.targets.find(m=>m.asleep&&m.hostile);assert.ok(target.hp>0);
    const changes=rows.filter(r=>r.step>created.step&&r.pet?.id===created.pet.id);
    if(i===0){
        assert.ok(changes.some(r=>r.targets.some(m=>m.id===target.id&&m.hp<target.hp)),
            'active xan legs route inflicted physical damage');
    }else{
        assert.ok(changes.some(r=>!r.targets.some(m=>m.id===target.id)), 'created target died');
    }
    const text=replay.getScreens().map(s=>decodeScreen(s).map(row=>row.map(c=>c.ch).join('')).join('\n')).join('\n');
    for(const value of recipe.branchAssertions[i].screenIncludes)assert.ok(text.includes(value),value);
    for(const value of recipe.branchAssertions[i].screenExcludes)assert.ok(!text.includes(value),value);
});
