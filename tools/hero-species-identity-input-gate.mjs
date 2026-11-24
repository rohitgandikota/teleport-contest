// Ordinary input reach checks. The C recording remains a separate oracle.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {PMNAMES as P, ATTKS as A} from '../js/monst_data.js';
import {decodeScreen} from '../frozen/screen-decode.mjs';
import {branchAssertionErrors} from './gen-sessions/assertions.mjs';
import tags from './gen-sessions/coverage-requirements.json' with {type:'json'};
const recipe=JSON.parse(readFileSync(new URL('gen-sessions/recipes/hero-species-table-identity.json',import.meta.url)));
const expected=[[P.PM_IRON_GOLEM,P.PM_RUST_MONSTER,A.AD_RUST,73],
    [P.PM_WOOD_GOLEM,P.PM_BROWN_PUDDING,A.AD_DCAY,74],
    [P.PM_STONE_GOLEM,P.PM_RUST_MONSTER,A.AD_RUST,74]];
test('recipe uses registered categories and concrete positive/negative assertions',()=>{
    assert.deepEqual(branchAssertionErrors(recipe),[]);
    const registered=new Set(tags.requirements.map(r=>r.id));
    for(const id of recipe.coverage)assert.ok(registered.has(id),id);
});
for(const [i,part] of recipe.segments.entries())test(part.name,async()=>{
    const [form,attacker,damage,count]=expected[i],rows=[];
    const descriptor=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');let run;
    try{
        globalThis.__step_snapshot={step:'*',cb(g,step){
            rows.push({step,form:g.u.umonnum,role:g.u.umonster,
                monsters:(g.level?.monsters||[]).filter(m=>m.mnum===attacker)
                    .map(m=>({id:m.m_id,xy:[m.mx,m.my],hostile:!m.mpeaceful&&!m.mtame,
                        cancelled:!!m.mcan,attack:m.data.mattk.some(a=>a[0]!==A.AT_NONE&&a[1]===damage)})),
                xy:[g.u.ux,g.u.uy]});
        }};
        run=await runSegment({...part,storage:new InMemoryStorage()});
    }finally{
        if(descriptor)Object.defineProperty(globalThis,'__step_snapshot',descriptor);
        else delete globalThis.__step_snapshot;
    }
    assert.equal(run.getScreens().length,count);
    const created=rows.find(r=>r.form===form&&r.monsters.some(m=>m.hostile&&!m.cancelled));
    assert.ok(created,'real command-created hostile attacker meets the polymorphed hero');
    const mon=created.monsters.find(m=>m.hostile&&!m.cancelled);
    assert.ok(mon.attack,'unaltered active species attack');
    assert.equal(Math.max(Math.abs(mon.xy[0]-created.xy[0]),Math.abs(mon.xy[1]-created.xy[1])),1);
    assert.ok(rows.some(r=>r.form===form&&!r.monsters.length),'polymorph precedes attacker creation');
    if(i<2)assert.ok(rows.some(r=>r.step>created.step&&r.form===r.role
        &&r.monsters.some(m=>m.id===mon.id)),'attack returns the hero to the living original form');
    else assert.equal(rows.at(-1).form,form,'ordinary negative keeps stone form');
    const text=run.getScreens().map(s=>decodeScreen(s).map(row=>row.map(c=>c.ch).join('')).join('\n')).join('\n');
    for(const textPart of recipe.branchAssertions[i].screenIncludes)assert.ok(text.includes(textPart),textPart);
    for(const textPart of recipe.branchAssertions[i].screenExcludes)assert.ok(!text.includes(textPart),textPart);
});
