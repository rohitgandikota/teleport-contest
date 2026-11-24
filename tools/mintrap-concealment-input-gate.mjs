// Ordinary producers only. C recording and output comparison are separate gates.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {canseemon,canspotmon} from '../js/display.js';
import {hides_under} from '../js/mondata.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import {BEAR_TRAP} from '../js/const.js';

const recipe=JSON.parse(readFileSync(new URL('./gen-sessions/recipes/trapped-hider-concealment.json',import.meta.url)));
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const cases=[
    {type:P.PM_PIT_VIPER,hidden:true,caught:true,boundaries:112},
    {type:P.PM_GARTER_SNAKE,hidden:true,caught:false,boundaries:115},
    {type:P.PM_PIT_VIPER,hidden:false,caught:true,boundaries:105},
];
test('the three frozen ordinary input tuples are unchanged',()=>{
    const fields=['name','seed','datetime','nethackrc','moves'];
    assert.equal(recipe.segments.length,3);
    assert.equal(hash(recipe.segments.map(s=>fields.map(k=>s[k]))),
        '1df35cc265d7171cd1df8dac92d00f4106aa79ad239a1bf4c623da13864c29bc');
});
for(const [index,part] of recipe.segments.entries())test(part.name,async()=>{
    const spec=cases[index],states=[];
    const prior=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');
    let run;
    try {
        globalThis.__step_snapshot={step:'*',cb(g,step) {
            assert.equal(g,game);
            const mon=g.level.monsters.find(m=>m.mnum===spec.type);
            const cover=g.level.objectsAt(38,6).find(o=>o.otyp===O.DAGGER);
            const trap=g.level.traps.find(t=>t.tx===38&&t.ty===6);
            const wand=(g.invent||[]).find(o=>o.otyp===O.WAN_LOCKING);
            states[step]={hero:[g.u.ux,g.u.uy],mortality:g.u.umortality||0,
                message:g.nhDisplay.grid[0].map(c=>c.ch).join('').trimEnd(),
                mon:mon?{id:mon.m_id,at:[mon.mx,mon.my],hidden:!!mon.mundetected,trapped:!!mon.mtrapped,
                    hp:mon.mhp,sleeping:!!mon.msleeping,visible:canseemon(mon),spotted:canspotmon(mon),
                    hidesUnder:hides_under(mon.data),size:mon.data.msize}:null,
                cover:cover?.o_id,trap:trap?{type:trap.ttyp,seen:!!trap.tseen,madeByHero:!!trap.madeby_u}:null,
                wand:wand?{id:wand.o_id,letter:wand.invlet,charges:wand.spe}:null};
        }};
        run=await runSegment({...part,storage:new InMemoryStorage()});
    } finally {
        if(prior)Object.defineProperty(globalThis,'__step_snapshot',prior);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),prior);
    assert.equal(states.length,spec.boundaries);
    const ready=states.find(s=>s.mon&&s.message.startsWith('What do you want to zap?'));
    const before=states.find(s=>s.mon&&s.message==='In what direction?');
    assert.ok(ready&&before,'real zap command reached both prompts');
    assert.deepEqual(before.hero,[39,5]);assert.deepEqual(before.mon.at,[38,6]);
    assert.ok(before.cover);assert.deepEqual(before.trap,{type:BEAR_TRAP,seen:false,madeByHero:false});
    assert.ok(before.mon.hidesUnder);assert.equal(before.mon.hidden,spec.hidden);
    assert.equal(before.mon.visible,!spec.hidden);assert.equal(before.mon.spotted,!spec.hidden);
    assert.equal(before.mon.trapped,false);assert.equal(before.mon.sleeping,true);
    assert.equal(before.mon.size>1,spec.caught);
    assert.equal(before.wand.letter,'a');assert.equal(ready.wand.charges,3);
    assert.equal(before.wand.charges,2,'C dozap spends the charge before getdir');
    const after=states.at(-1);
    const calls=run.getRngLog().map(s=>s.replace(/\s*@\s.*$/,''));
    console.log(JSON.stringify({name:part.name,before,after,boundaries:states.length,calls:calls.length,
        rngSha256:hash(calls),slicesSha256:hash(run.getRngSlices()),screensSha256:hash(run.getScreens()),
        cursorsSha256:hash(run.getCursors()),animationsSha256:hash(run.getAnimationFramesByStep())}));
    assert.equal(after.mon.id,before.mon.id);assert.deepEqual(after.mon.at,before.mon.at);
    assert.equal(after.cover,before.cover);assert.equal(after.wand.id,before.wand.id);
    assert.equal(after.wand.charges,2,'real zapping spent a charge');
    assert.equal(after.mon.trapped,spec.caught);assert.equal(after.mon.hidden,!spec.caught);
    assert.equal(after.mon.sleeping,!spec.caught);
    assert.equal(after.mon.visible,spec.caught);
    assert.equal(before.mon.hp-after.mon.hp,spec.caught?7:0);
    const messages=states.map(s=>s.message).join('\n');
    if(index===0)assert.match(messages,/A pit viper appears\./);
    else assert.doesNotMatch(messages,/A (?:pit viper|garter snake) appears\./);
    if(index===2)assert.match(messages,/The pit viper is caught in a bear trap!/);
    assert.ok(states.every(s=>s.mortality===0));
});
