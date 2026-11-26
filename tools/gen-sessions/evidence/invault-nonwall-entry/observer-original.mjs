// Read-only ordinary reach; no game-map writes, replacement helpers or RNG.
import assert from 'node:assert/strict';
import {runSegment} from '../baseline/js/jsmain.js';
import {InMemoryStorage} from '../baseline/js/storage.js';
import {ONAMES} from '../baseline/js/objects_data.js';
import {MELT_ICE_AWAY,TIMER_LEVEL} from '../baseline/js/timeout.js';
import {outputs,hashes} from '../baseline/tools/observe.mjs';

export async function observed(part) {
    const prior=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');
    const states=[];let run,error=null;
    try {
        globalThis.__step_snapshot={step:'*',cb(g,step) {
            if(step<100||!g.level||!g.u)return;
            const c=g.level.at(25,5),guard=g.level.monsters.find(m=>m.isgd),e=guard?.mextra?.egd;
            const wand=g.invent.find(o=>o.otyp===ONAMES.WAN_DIGGING);
            const whistle=g.invent.find(o=>o.otyp===ONAMES.TIN_WHISTLE);
            states.push({step,turn:g.moves,hero:[g.u.ux,g.u.uy],uinvault:g.u.uinvault,
                entry:{typ:c.typ,flags:c.flags,wall:c.wall_info,door:c.doormask},
                wand:{letter:wand?.invlet,charges:wand?.spe},whistle:{letter:whistle?.invlet,cursed:whistle?.cursed},
                timers:(g.timer_base||[]).filter(t=>t.kind===TIMER_LEVEL&&t.func_index===MELT_ICE_AWAY&&t.arg===((25<<16)|5)).length,
                guard:guard?{id:guard.m_id,xy:[guard.mx,guard.my],peaceful:guard.mpeaceful,
                    begin:e?.fcbeg,end:e?.fcend,done:e?.gddone,room:e?.vroom,
                    first:Array.isArray(e?.fakecorr)&&e.fakecorr[0]?{...e.fakecorr[0]}:null}:null,
                top:g.nhDisplay.grid[0].map(c=>c.ch).join('').trimEnd()});
        }};
        run=await runSegment({...part,storage:new InMemoryStorage()});
    } catch(e) {error={name:e.name,message:e.message};}
    finally {
        if(prior)Object.defineProperty(globalThis,'__step_snapshot',prior);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),prior);
    const output=run?outputs(run):null;
    return {error,states,output,hashes:output?hashes(output):null,
        allKeysCaptured:output?.screens.length===part.moves.length+1};
}
