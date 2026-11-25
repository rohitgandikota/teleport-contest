// Normal keyboard producers and read-only observations. Native parity is separate.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {decodeScreen,renderCell} from '../frozen/screen-decode.mjs';
import {PMNAMES as P,ATTKS as A} from '../js/monst_data.js';
import {ONAMES as O,MATERIALS as M} from '../js/objects_data.js';
import * as C from '../js/const.js';
const recipe=JSON.parse(readFileSync(new URL('gen-sessions/recipes/polymorph-natural-contact.json',import.meta.url)));
const expected=[
    {form:P.PM_WOLF,target:P.PM_SHADE,attack:48,count:63,hp:43,after:43},
    {form:P.PM_LARGE_MIMIC,target:P.PM_FOG_CLOUD,attack:59,count:74,hp:10,after:10},
    {form:P.PM_FLESH_GOLEM,target:P.PM_SHADE,attack:88,count:103,hp:55,after:54},
    {form:P.PM_ROPE_GOLEM,target:P.PM_SHADE,attack:87,count:102,hp:56,after:47},
    {form:P.PM_MINOTAUR,target:P.PM_SHADE,attack:83,count:98,hp:52,after:50},
    {form:P.PM_WOLF,target:P.PM_RUST_MONSTER,attack:55,count:70,hp:14,after:14},
    {form:P.PM_LARGE_MIMIC,target:P.PM_RUST_MONSTER,attack:62,count:77,hp:15,after:7},
];
for(const [index,part]of recipe.segments.entries())test(`ordinary natural contact: ${part.name}`,async()=>{
    const rows=[],previous=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');let run;
    try{
        globalThis.__step_snapshot={step:'*',cb(g,step){
            const object=o=>o&&({type:o.otyp,material:g.objects[o.otyp].oc_material,
                blessed:!!o.blessed,worn:o.owornmask,known:!!o.dknown});
            rows.push({step,hero:[g.u.ux,g.u.uy],form:g.u.umonnum,
                canonical:g.youmonst.data===g.mons[g.u.umonnum],attacks:g.youmonst.data.mattk,
                mortality:g.u.umortality||0,stuck:g.u.ustuck?.m_id||null,swallowed:!!g.u.uswallow,
                right:object(g.u.uright),helmet:object(g.u.uarmh),weapon:object(g.u.uwep),
                monsters:g.level.monsters.map(m=>({id:m.m_id,type:m.mnum,canonical:m.data===g.mons[m.mnum],
                    xy:[m.mx,m.my],hp:m.mhp,sleeping:!!m.msleeping,peaceful:!!m.mpeaceful}))});}};
        run=await runSegment({...part,storage:new InMemoryStorage()});
    }finally{
        if(previous)Object.defineProperty(globalThis,'__step_snapshot',previous);
        else delete globalThis.__step_snapshot;
    }
    const outputs = result => structuredClone({ screens: result.getScreens(),
        cursors: result.getCursors(), rng: result.getRngLog(),
        slices: result.getRngSlices(), frames: result.getAnimationFramesByStep() });
    const observed = outputs(run);
    const unobserved = await runSegment({ ...part, storage: new InMemoryStorage() });
    assert.deepEqual(observed, outputs(unobserved), 'observation preserves every output collection');
    const want=expected[index],pre=rows[want.attack-1],last=rows.at(-1);
    assert.equal(rows.length,want.count);assert.equal(run.getScreens().length,want.count);
    assert.equal(part.moves.length+1,want.count);assert.ok(rows.every(r=>r.mortality===0));
    assert.equal(pre.canonical,true);assert.equal(pre.form,want.form);assert.ok(!pre.weapon);
    assert.equal(part.moves[want.attack-2],'F');assert.ok(part.moves.includes('#polyself\r'));
    const target=pre.monsters.find(m=>m.type===want.target);
    assert.ok(target?.canonical&&target.sleeping&&!target.peaceful);assert.equal(target.hp,want.hp);
    assert.equal(Math.max(...target.xy.map((v,i)=>Math.abs(v-pre.hero[i]))),1);
    const after=last.monsters.find(m=>m.id===target.id);assert.ok(after);
    assert.equal(after.hp,want.after);assert.equal(after.sleeping,index===5);
    assert.deepEqual(last.hero,pre.hero);assert.equal(last.swallowed,false);
    assert.equal(last.stuck,index===6?target.id:null);
    const top=run.getScreens().map(s=>decodeScreen(s).slice(0,2).map(row=>row.map(renderCell).join('')).join('\n'));
    const text=top.slice(want.attack).join('\n');
    for(const phrase of recipe.branchAssertions[index].screenIncludes)assert.ok(text.includes(phrase),phrase);
    const calls=run.getRngSlices().slice(want.attack).flat();
    if(index===0){assert.equal(calls.filter(c=>/^d\(2,4\)=/.test(c)).length,0);assert.doesNotMatch(text,/You bite/);}
    if(index===1||index===6){
        assert.deepEqual(pre.attacks[0],[A.AT_CLAW,A.AD_STCK,3,4]);
        assert.equal(calls.filter(c=>/^d\(3,4\)=/.test(c)).length,index===1?0:1);
    }
    if(index===2||index===3){
        assert.equal(pre.right.material,M.SILVER);assert.equal(pre.right.worn,C.W_RINGR);
        assert.equal(pre.right.known,true);assert.deepEqual(last.right,pre.right);
        assert.ok(part.moves.includes('uncursed silver ring\r'));assert.ok(part.moves.includes('Par'));
        if(index===3){
            assert.equal(top[88].includes('Your silver ring sears the shade!'),true);
            assert.equal(top[89].includes('You grasp the shade.  Your silver ring sears the shade!'),true);
            assert.equal(calls.filter(c=>/^d\(6,1\)=/.test(c)).length,1);
        }
    }
    if(index===4){
        assert.equal(pre.helmet.type,O.CORNUTHAUM);assert.equal(pre.helmet.blessed,true);
        assert.equal(pre.helmet.worn,C.W_ARMH);assert.deepEqual(last.helmet,pre.helmet);
        assert.ok(part.moves.includes('blessed cornuthaum\r'));assert.ok(part.moves.includes('Wa'));
        assert.ok(calls.includes('rnd(4)=2'));assert.equal(calls.filter(c=>/^d\(2,8\)=/.test(c)).length,1);
    }
});
