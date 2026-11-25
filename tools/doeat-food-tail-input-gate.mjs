// Real ordinary commands, actual meal state, and five-collection observer neutrality.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {ONAMES as O} from '../js/objects_data.js';
import {decodeScreen,renderCell} from '../frozen/screen-decode.mjs';
const recipe=JSON.parse(readFileSync(new URL('gen-sessions/recipes/doeat-food-tail.json',import.meta.url)));
const outputs=run=>({screens:run.getScreens(),cursors:run.getCursors(),rng:run.getRngLog(),slices:run.getRngSlices(),frames:run.getAnimationFramesByStep()});
const steps=[26,42,37,25,23,24];
const types=[O.MEATBALL,O.FOOD_RATION,O.CARROT,O.PANCAKE,O.APPLE,O.CARROT];
for(const [index,part]of recipe.segments.entries())test(`ordinary food tail: ${part.name}`,async()=>{
    const rows=[],previous=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');let run;
    try{
        globalThis.__step_snapshot={step:'*',cb(g,step){const v=g.context.victual||{};rows.push({step,role:g.urole.name.m,
            conduct:{...g.u.uconduct},record:g.u.ualign.record,abuse:g.u.ualign.abuse||0,hunger:g.u.uhunger,
            victual:{...v,piece:v.piece?.o_id||null},inventory:(g.invent||[]).map(o=>({id:o.o_id,type:o.otyp,
                quantity:o.quan,eaten:o.oeaten,letter:o.invlet})),moves:g.moves});}};
        run=await runSegment({...part,storage:new InMemoryStorage()});
    }finally{if(previous)Object.defineProperty(globalThis,'__step_snapshot',previous);else delete globalThis.__step_snapshot;}
    const observed=outputs(run),unobserved=outputs(await runSegment({...part,storage:new InMemoryStorage()}));
    for(const key of Object.keys(observed))assert.deepEqual(observed[key],unobserved[key],key+' observer neutrality');
    assert.equal(observed.screens.length,part.moves.length+1);assert.equal(rows.length,part.moves.length+1);
    assert.equal(run._display.inputQueueLength,0);
    const step=steps[index],before=rows[step-1],after=rows[step],last=rows.at(-1);
    assert.equal(part.moves.slice(step-2,step),'ea','real eat command and selection');
    assert.equal(before.role,index===0?'Monk':'Wizard');assert.equal(before.moves,1);
    assert.equal(before.conduct.food,0);assert.equal(before.conduct.unvegan,0);
    assert.equal(before.conduct.unvegetarian,0);assert.equal(before.inventory.length,1);
    const obj=before.inventory[0];assert.equal(obj.type,types[index]);assert.equal(obj.letter,'a');
    assert.equal(obj.quantity,1);assert.equal(obj.eaten,index===1?400:index===2?25:0);
    assert.ok(part.moves.includes('\x17'));assert.ok(part.moves.includes('#conduct\r'));
    assert.equal(last.conduct.food,1);assert.equal(last.conduct.unvegan,index===0||index===3?1:0);
    assert.equal(last.conduct.unvegetarian,index===0?1:0);
    assert.equal(last.inventory.length,0,'ordinary meal is consumed');
    if(index===0){assert.equal(after.record,before.record-1);assert.equal(after.abuse,before.abuse+1);}
    if(index===1){assert.equal(after.victual.piece,obj.id);assert.equal(after.victual.reqtime,3);assert.equal(after.victual.nmod,-133);}
    if(index===2)assert.equal(after.hunger,924,'half nutrition and one actual time step');
    const texts=observed.screens.map(s=>decodeScreen(s).map(r=>r.map(renderCell).join('')).join('\n'));
    for(const phrase of recipe.branchAssertions[index].screenIncludes)assert.ok(texts.some(s=>s.includes(phrase)),phrase);
    if(index===2)assert.match(texts[step],/finish eating the carrot/);
    if(index===3)assert.doesNotMatch(texts.join('\n'),/followed a strict vegan diet/);
    if(index>=4){assert.doesNotMatch(texts[step],/guilty|finish eating/);assert.equal(after.record,before.record);}
    assert.equal(observed.frames.flat().length,0);
});
