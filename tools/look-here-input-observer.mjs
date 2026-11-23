// Read-only boundary observations with exact hook restoration.
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { Blind, Underwater, Flying, Levitation } from '../js/youprop.js';
import { t_at } from '../js/mon.js';
import { Is_airlevel, Is_waterlevel } from '../js/const.js';
export async function observe(part) {
    const states=[];
    const old=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');
    let run;
    try{
        globalThis.__step_snapshot={step:'*',cb(g,step){
            const trap=t_at(g.u.ux,g.u.uy);
            states.push({step,turn:g.moves,x:g.u.ux,y:g.u.uy,level:{...g.u.uz},
                typ:g.level.at(g.u.ux,g.u.uy).typ,blind:Blind(),underwater:Underwater(),
                air:Is_airlevel(g.u.uz),water:Is_waterlevel(g.u.uz),hp:g.u.uhp,mortality:g.u.umortality||0,
                swallowed:!!g.u.uswallow,mentionDecor:!!g.flags.mention_decor,
                flying:Flying(),levitating:Levitation(),intrinsic:{...g.u.intrinsic},
                last_msg:g.iflags.last_msg,prev_decor:g.iflags.prev_decor,utrap:g.u.utrap,
                trap:trap?{type:trap.ttyp,seen:!!trap.tseen}:null,
                floor:g.level.objectsAt(g.u.ux,g.u.uy).map(o=>({id:o.o_id,type:o.otyp,quantity:o.quan})),
                text:g.nhDisplay.grid[0].map(c=>c.ch).join('').trimEnd(),
            });
        }};
        run=await runSegment({...part,storage:new InMemoryStorage()});
    }finally{
        if(old)Object.defineProperty(globalThis,'__step_snapshot',old);else delete globalThis.__step_snapshot;
    }
    const row={name:part.name,boundaries:run.getScreens().length,rngCalls:run.getRngLog().length,
        last:states.at(-1),states};
    return row;
}
