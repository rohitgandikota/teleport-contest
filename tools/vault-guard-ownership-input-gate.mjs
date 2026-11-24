// Ordinary input only. Accept the unchanged later native fixture as argv[2].
import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {decodeScreen} from '../frozen/screen-decode.mjs';
const input = JSON.parse(fs.readFileSync(process.argv[2] || new URL(
    'gen-sessions/generated/vault-guard-ownership.session.json',import.meta.url)));
const recipe = JSON.parse(fs.readFileSync(new URL(
    'gen-sessions/recipes/vault-guard-ownership.json',import.meta.url)));
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
assert.equal(input.version,5);assert.equal(input.source,'c');
assert.equal(input.segments.length,3);
for (const [index,part] of input.segments.entries()) {
    for(const key of ['name','seed','datetime','nethackrc','moves'])
        assert.deepEqual(part[key],recipe.segments[index][key],key);
    const prior=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');
    const states=[];let run;
    try {
        globalThis.__step_snapshot={step:'*',cb(g,step){
            const mon=g.level.monsters.find(m=>m.isgd);
            states.push({step,moves:g.moves,hero:[g.u.ux,g.u.uy],deaths:g.mvitals[P.PM_GUARD].died||0,
                ball:g.u.uball&&[g.u.uball.ox,g.u.uball.oy,g.u.uball.where],
                stone:g.level.at(26,5).typ===0,
                guard:mon&&{id:mon.m_id,xy:[mon.mx,mon.my],hp:mon.mhp,
                    done:mon.mextra.egd.gddone,beg:mon.mextra.egd.fcbeg,end:mon.mextra.egd.fcend},
                text:g._toplines||''});
        }};
        run=await runSegment({...part,storage:new InMemoryStorage()});
    } finally {
        if(prior)Object.defineProperty(globalThis,'__step_snapshot',prior);else delete globalThis.__step_snapshot;
    }
    const messages=run.getScreens().map(s=>decodeScreen(s).map(row=>row.map(c=>c.ch).join('')).join('\n'));
    const joined=messages.join('\n');
    const kill=states.find(s=>s.text.includes('You kill an unseen guard!'));
    await test(`${part.name}: actual invault escort cuts the corridor before the kill`,()=>{
        const arrival=states.find(s=>s.guard?.end===1);
        const corridor=states.find(s=>s.guard?.end===3 && s.hero[0]===25);
        assert.ok(arrival&&corridor&&kill);
        assert.deepEqual(arrival.guard.xy,[25,5]);
        assert.equal(corridor.guard.id,arrival.guard.id);
        assert.equal(corridor.guard.beg,0);
        assert.equal(corridor.deaths,0);
    });
    await test(`${part.name}: real punishment controls deferred guard ownership and history`,()=>{
        if(index===0){
            assert.ok(!kill.ball&&!kill.guard);
            assert.equal(kill.deaths,1);
            assert.ok(kill.stone);
        } else {
            assert.deepEqual(kill.ball,[25,5,1]);
            assert.deepEqual(kill.guard.xy,[0,0]);
            assert.equal(kill.guard.hp,0);
            assert.equal(kill.guard.done,0);
            assert.equal(kill.deaths,0);
            assert.equal(kill.stone,false);
            const turn=states.find(s=>s.step>kill.step&&s.moves>kill.moves);
            assert.equal(turn.guard.done,1);
            assert.equal(turn.guard.id,kill.guard.id);
        }
    });
    await test(`${part.name}: ledger and cleanup witnesses follow the C owners`,()=>{
        const final=states.at(-1);
        assert.equal(final.deaths,index===0?1:0);
        assert.equal(!!final.guard,index===1);
        assert.equal(!!final.ball,index===1);
        assert.equal(final.stone,index!==1);
        for(const text of recipe.branchAssertions[index].screenIncludes) assert.ok(joined.includes(text),text);
        for(const text of recipe.branchAssertions[index].screenExcludes||[]) assert.ok(!joined.includes(text),text);
        if(index===2){
            const retired=states.find(s=>s.step>kill.step&&!s.ball&&!s.guard);
            assert.ok(retired&&retired.moves>kill.moves);
            assert.equal(retired.deaths,0);
            assert.equal(retired.text,'You are encased in rock.');
        }
    });
    await test(`${part.name}: all input boundaries finish alive and passive hook is restored`,()=>{
        for(const output of [run.getScreens(),run.getCursors(),run.getRngSlices(),run.getAnimationFramesByStep()])
            assert.equal(output.length,part.moves.length+1);
        assert.equal(run._display.inputQueueLength,0);
        assert.ok(game.u.uhp>0&&!game.program_state.gameover);
        assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),prior);
    });
    console.log(JSON.stringify({name:part.name,kill,final:states.at(-1),boundaries:run.getScreens().length,
        calls:run.getRngLog().length,frames:run.getAnimationFramesByStep().flat().length,
        outputHashes:{screens:hash(run.getScreens()),cursors:hash(run.getCursors()),
            calls:hash(run.getRngLog()),slices:hash(run.getRngSlices()),frames:hash(run.getAnimationFramesByStep())}}));
}
