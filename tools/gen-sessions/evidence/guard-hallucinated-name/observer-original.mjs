// Ordinary keyboard reach only. No state changes, private exports or RNG overrides.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const [input, output] = process.argv.slice(2);
assert.ok(input && output && process.argv.length === 4);
const {runSegment} = await import('../baseline/js/jsmain.js');
const {InMemoryStorage} = await import('../baseline/js/storage.js');
const {Hallucination, Blind} = await import('../baseline/js/youprop.js');
const {canspotmon} = await import('../baseline/js/display.js');
const {outputs, hashes} = await import('../baseline/tools/observe.mjs');
const sha = value => createHash('sha256').update(JSON.stringify(value,
    (_key, v) => typeof v === 'bigint' ? v.toString() : v)).digest('hex');
const recipe = JSON.parse(readFileSync(input));
const results = [];
const timer = setTimeout(() => { throw new Error('bounded probe exceeded55s'); }, 55000);
try {
    for (const part of recipe.segments) {
        const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
        const states = [];
        let run, error = null;
        try {
            globalThis.__step_snapshot = {step:'*',cb(g, step) {
                if (step < 180 || !g.u || !g.level) return;
                const guard = g.level.monsters.find(m => m.isgd);
                const egd = guard?.mextra?.egd;
                states.push({step, key:part.moves[step - 1], turn:g.moves,
                    hero:[g.u.ux,g.u.uy], hallu:Hallucination(), blind:Blind(),
                    timeouts:[g.u.intrinsic?.HHallucination || 0,g.u.intrinsic?.HBlinded || 0],
                    top:g.nhDisplay.grid[0].map(c=>c.ch).join('').trimEnd(),
                    logical:g._toplines, impossible:g.program_state.in_impossible || 0,
                    displayRngHash:sha(g.dispCtx || null),
                    guard:guard ? {id:guard.m_id,xy:[guard.mx,guard.my],hp:guard.mhp,
                        spot:canspotmon(guard),peaceful:guard.mpeaceful,state:guard.mstate,
                        done:egd.gddone,begin:egd.fcbeg,end:egd.fcend,
                        heroInCorridor:Array.isArray(egd.fakecorr)
                            ? egd.fakecorr.slice(egd.fcbeg,egd.fcend)
                                .some(c=>c.fx===g.u.ux && c.fy===g.u.uy) : null} : null});
            }};
            run = await runSegment({...part, storage:new InMemoryStorage()});
        } catch (e) { error = {name:e.name,message:e.message}; }
        finally {
            if (previous) Object.defineProperty(globalThis,'__step_snapshot',previous);
            else delete globalThis.__step_snapshot;
        }
        assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),previous);
        const out = run ? outputs(run) : null;
        results.push({name:part.name,keys:part.moves.length,error,
            boundaries:out?.screens.length,calls:out?.calls.length,
            hashes:out ? hashes(out) : null,
            allKeysCaptured:out?.screens.length===part.moves.length+1,states});
    }
} finally {clearTimeout(timer);}
writeFileSync(output, JSON.stringify({classification:'Baseline ordinary JS reach; no C evidence or candidate',
    results},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(results.map(r=>({name:r.name,error:r.error,
    keys:r.keys,allKeysCaptured:r.allKeysCaptured,
    hallu:r.states.some(s=>s.hallu),blind:r.states.some(s=>s.blind),
    cleanup:r.states.find(s=>s.guard?.done),final:r.states.at(-1)}))));
