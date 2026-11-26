// Fresh passive observation, derived from tools/probe.mjs without state writes.
import assert from 'node:assert/strict';
const {runSegment}=await import('../baseline/js/jsmain.js');
const {InMemoryStorage}=await import('../baseline/js/storage.js');
const {couldsee,cansee}=await import('../baseline/js/vision.js');
const {money_cnt,hidden_gold}=await import('../baseline/js/invent.js');
const {outputs,hashes}=await import('../baseline/tools/observe.mjs');
export async function observed(part) {
    const prior=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');
    const states=[];let run,error=null;
    try {
        globalThis.__step_snapshot={step:'*',cb(g,step) {
            if(step<180||!g.u||!g.level)return;
            const guard=g.level.monsters.find(m=>m.isgd);
            const e=guard?.mextra?.egd;
            const corridor=Array.isArray(e?.fakecorr)?e.fakecorr:null;
            const inside=(x,y)=>corridor?.slice(e.fcbeg,e.fcend).some(c=>c.fx===x&&c.fy===y)??null;
            const entry=corridor?.[0];
            const terms=e&&entry?{
                extended:e.fcend>2,guardInside:inside(guard.mx,guard.my),
                notDone:!e.gddone,heroOutside:!inside(g.u.ux,g.u.uy),
                entryRestored:g.level.at(entry.fx,entry.fy).typ===entry.ftyp
            }:null;
            states.push({step,key:part.moves[step-1],turn:g.moves,
                hero:[g.u.ux,g.u.uy],gold:money_cnt(g.invent),hiddenGold:hidden_gold(g.invent,true),
                top:g.nhDisplay.grid[0].map(c=>c.ch).join('').trimEnd(),logical:g._toplines,
                terms,eligible:terms?Object.values(terms).every(Boolean):false,
                guard:guard?{id:guard.m_id,xy:[guard.mx,guard.my],hp:guard.mhp,
                    peaceful:guard.mpeaceful,done:e?.gddone,begin:e?.fcbeg,end:e?.fcend,
                    old:[e?.ogx,e?.ogy],movement:guard.movement,
                    corridor:corridor?.map(c=>({xy:[c.fx,c.fy],saved:c.ftyp,
                        current:g.level.at(c.fx,c.fy).typ,couldsee:couldsee(c.fx,c.fy),
                        cansee:cansee(c.fx,c.fy)}))??null}:null});
        }};
        run=await runSegment({...part,storage:new InMemoryStorage()});
    } catch(e) {error={name:e.name,message:e.message};}
    finally {
        if(prior)Object.defineProperty(globalThis,'__step_snapshot',prior);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),prior);
    const out=run?outputs(run):null;
    return {name:part.name,error,keys:part.moves.length,boundaries:out?.screens.length,
        calls:out?.calls.length,hashes:out?hashes(out):null,
        allKeysCaptured:out?.screens.length===part.moves.length+1,states,output:out};
}
