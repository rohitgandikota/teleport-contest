// Passive observation of ordinary inputs; accepts a later unchanged C fixture.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {ONAMES as O} from '../js/objects_data.js';
import {Blind} from '../js/youprop.js';
import {decodeScreen} from '../frozen/screen-decode.mjs';
const input=JSON.parse(fs.readFileSync(process.argv[2]||new URL(
    'gen-sessions/generated/vault-corridor-gold.session.json',import.meta.url)));
const recipe=JSON.parse(fs.readFileSync(new URL(
    'gen-sessions/recipes/vault-corridor-gold.json',import.meta.url)));
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
assert.equal(input.version,5);assert.equal(input.source,'c');assert.equal(input.segments.length,5);
for(const [index,part] of input.segments.entries()) {
    for(const key of ['name','seed','datetime','nethackrc','moves'])
        assert.deepEqual(part[key],recipe.segments[index][key],key);
    const prior=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');
    const states=[];let run;
    try {
        globalThis.__step_snapshot={step:'*',cb(g,step){
            const guard=g.level.monsters.find(m=>m.isgd);
            states.push({step,turn:g.moves,hero:[g.u.ux,g.u.uy],blind:!!Blind(),
                heroGold:(g.invent||[]).filter(o=>o.otyp===O.GOLD_PIECE).reduce((n,o)=>n+o.quan,0),
                floor:g.level.objects.filter(o=>o.otyp===O.GOLD_PIECE).map(o=>[o.o_id,o.ox,o.oy,o.quan]),
                guard:guard&&{id:guard.m_id,xy:[guard.mx,guard.my],peaceful:guard.mpeaceful,
                    gold:(guard.minvent||[]).filter(o=>o.otyp===O.GOLD_PIECE).map(o=>[o.o_id,o.quan]),
                    warn:guard.mextra.egd.warncnt,end:guard.mextra.egd.fcend,beg:guard.mextra.egd.fcbeg},
                text:g._toplines||''});
        }};
        run=await runSegment({...part,storage:new InMemoryStorage()});
    }finally{if(prior)Object.defineProperty(globalThis,'__step_snapshot',prior);else delete globalThis.__step_snapshot;}
    const messages=run.getScreens().map(s=>decodeScreen(s).map(row=>row.map(c=>c.ch).join('')).join('\n')).join('\n');
    const final=states.at(-1),collected=states.find(s=>s.guard?.gold.some(([,n])=>n===50));
    await test(`${part.name}: actual escort and gold input reach the intended coordinates`,()=>{
        const arrival=states.find(s=>s.guard?.end===1);
        assert.ok(arrival);assert.deepEqual(arrival.guard.xy,[25,5]);
        assert.equal(final.guard.id,arrival.guard.id);
        if(index===3){assert.deepEqual(final.hero,[23,5]);assert.equal(final.guard.end,1);}
        else {const corridor=states.find(s=>s.guard?.end===3);assert.ok(corridor);assert.deepEqual(corridor.hero,[25,5]);assert.equal(final.guard.end,3);}
        assert.equal(final.guard.beg,0);
    });
    await test(`${part.name}: C ownership and anger branch state`,()=>{
        if(index<3){
            assert.ok(collected,'gold reaches the guard inventory');
            const oid=collected.guard.gold[0][0];
            assert.ok(!final.floor.some(([id])=>id===oid));
            assert.equal(final.heroGold,0);assert.deepEqual(final.guard.gold,[[oid,50]]);
            assert.equal(final.guard.peaceful,1);assert.equal(final.guard.warn,5);
            assert.deepEqual(final.guard.xy,[27,5]);
            if(index<2)assert.deepEqual(collected.guard.xy,[26,5],'temporary visible approach before pending feedback');
            else {assert.ok(collected.blind);assert.deepEqual(collected.guard.xy,[27,5]);}
            if(index===1)assert.ok(states.some(s=>s.guard?.warn===6&&s.heroGold===50&&s.guard.peaceful));
            if(index===0)assert.ok(!states.some(s=>s.guard?.warn===6));
        }else if(index===3){
            assert.ok(!collected);assert.equal(final.heroGold,0);
            const starting=states.find(s=>s.guard)?.floor.find(([,x,y])=>x===23&&y===5)?.[3]||0;
            assert.ok(final.floor.some(([,x,y,n])=>x===23&&y===5&&n===starting+550));
            assert.equal(final.guard.peaceful,1);
        }else{
            assert.ok(!collected);assert.equal(final.heroGold,50);assert.equal(final.guard.peaceful,0);
            assert.ok(states.some(s=>s.guard?.warn===6&&s.guard.peaceful));
        }
    });
    await test(`${part.name}: source-derived feedback assertions`,()=>{
        for(const str of recipe.branchAssertions[index].screenIncludes)assert.ok(messages.includes(str),str);
        for(const str of recipe.branchAssertions[index].screenExcludes)assert.ok(!messages.includes(str),str);
    });
    await test(`${part.name}: every key completes alive and the passive hook is restored`,()=>{
        for(const out of [run.getScreens(),run.getCursors(),run.getRngSlices(),run.getAnimationFramesByStep()])
            assert.equal(out.length,part.moves.length+1);
        assert.equal(run._display.inputQueueLength,0);assert.ok(game.u.uhp>0&&!game.program_state.gameover);
        assert.equal(run.getAnimationFramesByStep().flat().length,0);
        assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),prior);
    });
    console.log(JSON.stringify({name:part.name,boundaries:run.getScreens().length,calls:run.getRngLog().length,
        frames:run.getAnimationFramesByStep().flat().length,collected,final,outputHashes:{
            screens:hash(run.getScreens()),cursors:hash(run.getCursors()),rng:hash(run.getRngLog()),
            slices:hash(run.getRngSlices()),frames:hash(run.getAnimationFramesByStep())}}));
}
