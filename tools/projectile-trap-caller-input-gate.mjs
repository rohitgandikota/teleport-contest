// Read-only observations of ordinary input reach. Native parity is separate.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {ART_ORB_OF_FATE} from '../js/artilist_data.js';
import {ARROW_TRAP,DART_TRAP,W_ART} from '../js/const.js';
import {decodeScreen} from '../frozen/screen-decode.mjs';
import {branchAssertionErrors} from './gen-sessions/assertions.mjs';
import coverage from './gen-sessions/coverage-requirements.json' with {type:'json'};

const recipe=JSON.parse(readFileSync(new URL('gen-sessions/recipes/projectile-trap-callers.json',import.meta.url)));
await test('recipe name, registered tags and observable branch assertions',()=>{
    assert.equal(recipe.name,'projectile-trap-callers');
    assert.equal(recipe.segments.length,4);
    assert.deepEqual(branchAssertionErrors(recipe),[]);
    for(const tag of recipe.coverage)assert.ok(coverage.requirements.some(r=>r.id===tag),tag);
});
for(const [index,part] of recipe.segments.entries())await test(part.name,async()=>{
    const orb=part.name.endsWith('orb'),type=part.name.startsWith('arrow')?ARROW_TRAP:DART_TRAP;
    const previous=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),states=[];
    let run;
    try {
        globalThis.__step_snapshot={step:'*',cb(g,step){
            const trap=g.level?.traps.find(t=>t.tx===g.u.ux&&t.ty===g.u.uy);
            states.push({step,hp:g.u.uhp,mortality:g.u.umortality||0,
                half:g.u.uprops?.HALF_PHDAM||0,intrinsic:g.u.intrinsic?.HHalf_physical_damage||0,
                orb:(g.invent||[]).some(o=>o.oartifact===ART_ORB_OF_FATE),
                trap:trap?.ttyp||0,once:trap?.once||0,text:g._toplines||''});
        }};
        run=await runSegment({...part,storage:new InMemoryStorage()});
    } finally {
        if(previous)Object.defineProperty(globalThis,'__step_snapshot',previous);
        else delete globalThis.__step_snapshot;
    }
    assert.equal(run.getScreens().length,part.moves.length+1);
    assert.ok(states.every(s=>s.hp>0&&s.mortality===0&&s.intrinsic===0));
    assert.ok(states.some(s=>s.trap===type&&s.once),'the wished trap actually fired');
    assert.ok(states.some(s=>s.trap===type&&s.hp<32&&/hit by/.test(s.text)));
    assert.equal(game.u.uprops?.HALF_PHDAM||0,orb?W_ART:0);
    assert.equal((game.invent||[]).some(o=>o.oartifact===ART_ORB_OF_FATE),orb);
    if(orb)assert.ok(states.some(s=>s.orb&&s.half===W_ART&&s.trap===type));
    assert.equal(game.u.uhpmax,32);assert.equal(game.u.uhp,[28,28,25,29][index]);
    const text=run.getScreens().map(s=>decodeScreen(s)
        .map(r=>r.map(c=>c.ch).join('')).join('\n')).join('\n');
    for(const wanted of recipe.branchAssertions[index].screenIncludes)
        assert.ok(text.includes(wanted),wanted);
    for(const unwanted of recipe.branchAssertions[index].screenExcludes)
        assert.ok(!text.includes(unwanted),unwanted);
    assert.ok(!game.program_state?.gameover);
});
