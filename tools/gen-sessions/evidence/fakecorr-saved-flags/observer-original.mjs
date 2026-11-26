// Passive ordinary keyboard reach on fixed19946; no state mutation or helper replacement.
import assert from 'node:assert/strict';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {ONAMES} from '../js/objects_data.js';
import {outputs,hashes} from './observe.mjs';

export async function observed(part) {
    const prior=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');
    const states=[];let run,error=null;
    try {
        globalThis.__step_snapshot={step:'*',cb(g,step) {
            if(step<100||!g.level||!g.u)return;
            const c=g.level.at(25,5),guard=g.level.monsters.find(m=>m.isgd),e=guard?.mextra?.egd;
            const wand=g.invent.find(o=>o.otyp===ONAMES.WAN_DIGGING);
            const here=g.level.at(g.u.ux,g.u.uy);
            const snapshot={turn:g.moves,hero:[g.u.ux,g.u.uy],uinvault:g.u.uinvault,
                entry:{typ:c.typ,flags:c.flags,wall:c.wall_info,door:c.doormask,seen:c.seenv},
                here:{typ:here.typ,flags:here.flags,wall:here.wall_info,door:here.doormask},
                wand:{letter:wand?.invlet,charges:wand?.spe},
                guard:guard?{id:guard.m_id,xy:[guard.mx,guard.my],hp:guard.mhp,peaceful:guard.mpeaceful,
                    begin:e?.fcbeg,end:e?.fcend,done:e?.gddone,warn:e?.warncnt,
                    corridor:Array.isArray(e?.fakecorr)?e.fakecorr.map(c=>({...c})):null}:null};
            const state={step,key:part.moves[step-1],...snapshot,
                top:g.nhDisplay.grid[0].map(c=>c.ch).join('').trimEnd()};
            states.push(state);
        }};
        run=await runSegment({...part,storage:new InMemoryStorage()});
    } catch(e) {error={name:e.name,message:e.message};}
    finally {
        if(prior)Object.defineProperty(globalThis,'__step_snapshot',prior);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),prior);
    const out=run?outputs(run):null;
    return {error,states,output:out,hashes:out?hashes(out):null,allKeysCaptured:out?.screens.length===part.moves.length+1};
}
