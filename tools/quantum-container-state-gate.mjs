#!/usr/bin/env node

// C makemon.c:777..795, pickup.c:2826..2900 and shk.c:921..949.
// Native traces pin outputs and RNG. These checks also inspect hidden state.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {runSegment} from '../js/jsmain.js';
import {game} from '../js/gstate.js';
import {InMemoryStorage} from '../js/storage.js';
import {resetInputState} from '../js/input.js';
import {weight} from '../js/invent.js';
import {ONAMES as N} from '../js/objects_data.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {OBJ_INVENT,OBJ_FLOOR,OBJ_MINVENT,OBJ_CONTAINED,ROT_CORPSE} from '../js/const.js';
const read=(kind,name)=>JSON.parse(fs.readFileSync(new URL(`gen-sessions/${kind}/${name}${kind==='generated'?'.session':''}.json`,import.meta.url)));
function objects(label) {
    const found=[];
    function walk(list,where,parent) {
        for(const o of list||[]) {
            assert.ok(!found.includes(o),label+': unique live owner');found.push(o);
            assert.equal(o.where,where,label+': location');
            if(where===OBJ_MINVENT)assert.equal(o.ocarry,parent,label+': carrier');
            if(where===OBJ_CONTAINED)assert.equal(o.ocontainer,parent,label+': container');
            walk(o.cobj,OBJ_CONTAINED,o);
        }
    }
    walk(game.invent,OBJ_INVENT);walk(game.level.objects,OBJ_FLOOR);
    for(const mon of game.level.monsters)walk(mon.minvent,OBJ_MINVENT,mon);
    return found;
}
let count=0,live=0,dead=0,frozen=0;
for(const name of ['quantum-mechanic-creation','quantum-cat-observation','concealed-shop-picks']) {
    const recipe=read('recipes',name),oracle=read('generated',name);
    for(const [i,s]of recipe.segments.entries()) {
        const label=name+':'+s.name;let box,lastXp,lastScore,lastMove,seenFrozen=false;
        const pickTimes=new Set();
        globalThis.__step_snapshot={step:'*',cb:()=>{
            for(const o of objects(label))if(o.otyp===N.LARGE_BOX&&o.spe===1) {
                box=o;const corpse=o.cobj?.[0];assert.ok(corpse,label+': unobserved corpse');
                assert.equal(corpse.otyp,N.CORPSE,label);assert.equal(corpse.corpsenm,P.PM_HOUSECAT,label);
                assert.equal(corpse.timed||0,0,label+': unopened corpse has no timers');
                assert.ok(!game.timer_base.some(t=>t.arg===corpse),label+': no queued corpse timer');
                assert.equal(o.owt,weight(o),label+': unobserved weight');seenFrozen=true;
                lastXp=game.u.uexp;lastScore=game.u.urexp;lastMove=game.moves;
            }
            if(game.pickmovetime)pickTimes.add(game.pickmovetime);
        }};
        resetInputState();let replay;
        try {replay=await runSegment({...s,storage:new InMemoryStorage()});}
        finally {delete globalThis.__step_snapshot;}
        const rng=oracle.segments[i].steps.flatMap(t=>t.rng||[]);
        assert.equal(replay.getRngLog().length,rng.length,label+': native RNG total');
        assert.equal(game.u.umortality||0,0,label+': no setup death');
        objects(label);
        if(name==='quantum-mechanic-creation') {
            const mon=game.level.monsters.find(m=>m.mnum===P.PM_QUANTUM_MECHANIC&&m.mhp>0);
            assert.ok(mon,label+': created mechanic');
            const expected=rng.some(r=>r.includes('rn2(20)=0 @ m_initinv(makemon.c:777)'));
            assert.equal(seenFrozen,expected,label+': C box roll');
            if(expected){assert.equal(box.where,OBJ_MINVENT,label);assert.equal(box.ocarry,mon,label);frozen++;}
            else assert.ok(!(mon.minvent||[]).some(o=>o.otyp===N.LARGE_BOX),label+': no-box control');
        } else if(name==='quantum-cat-observation') {
            assert.ok(seenFrozen,label);assert.equal(box.spe,0,label+': observation completed');
            const roll=rng.find(r=>r.includes('@ observe_quantum_cat'));
            assert.ok(roll,label);const alive=roll.startsWith('rn2(2)=0');
            const cats=game.level.monsters.filter(m=>m.mnum===P.PM_HOUSECAT&&m.mhp>0);
            if(alive) {
                assert.equal(cats.length,1,label);assert.equal(cats[0].mgivenname,"Schroedinger's Cat",label);
                assert.equal(cats[0].mpeaceful,1,label);assert.equal(box.cobj.length,0,label);
                assert.equal(box.owt,weight(box),label+': weight after live observation');live++;
            } else {
                const corpse=box.cobj[0];assert.ok(corpse,label);assert.equal(corpse.oname,"Schroedinger's Cat",label);
                assert.equal(corpse.corpsenm,P.PM_HOUSECAT,label);assert.equal(corpse.age,lastMove,label+': age reset at observation');
                assert.equal(corpse.timed,1,label+': rot restarted');
                assert.ok(game.timer_base.some(t=>t.arg===corpse&&t.func_index===ROT_CORPSE&&t.timeout>game.moves),label);
                assert.equal(cats.length,0,label);dead++;
            }
            assert.equal(game.u.uexp-lastXp,alive?10:20,label+': observation experience');
            assert.equal(game.u.urexp-lastScore,alive?60:90,label+': observation score');
        } else {
            const bag=game.invent.find(o=>o.otyp===N.SACK);assert.ok(bag,label);assert.equal(bag.cobj.length,0,label);
            const picks=game.invent.filter(o=>[N.PICK_AXE,N.DWARVISH_MATTOCK].includes(o.otyp));
            const expected=s.name.includes('no-pick')?0:s.name.includes('two')?2:1;
            assert.equal(picks.length,expected,label+': picks transferred');
            assert.equal(pickTimes.size,expected?1:0,label+': one reaction turn');
        }
        count++;
    }
}
assert.equal(count,43);assert.equal(frozen,9);assert.ok(live&&dead);
console.log(`quantum containers: ${count} native replays, ${frozen} frozen births, ${live} live and ${dead} dead observations, five shop controls`);
