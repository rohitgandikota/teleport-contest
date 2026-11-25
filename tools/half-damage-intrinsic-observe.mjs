import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {decodeScreen, renderCell} from '../frozen/screen-decode.mjs';

export const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const outputs = run => ({screens:run.getScreens(), cursors:run.getCursors(),
    calls:run.getRngLog(), slices:run.getRngSlices(), frames:run.getAnimationFramesByStep()});
export const hashes = out => Object.fromEntries(Object.entries(out).map(([k,v]) => [k,hash(v)]));
export async function unobserved(part) {
    return outputs(await runSegment({...part, storage:new InMemoryStorage()}));
}
export async function observe(part, keepOutput=false) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot');
    const states=[]; let run;
    try {
        globalThis.__step_snapshot = {step:'*', cb(g,step) {
            if (!g.u || !g.level) return;
            states.push({step, turn:g.moves, hp:g.u.uhp, mortality:g.u.umortality || 0,
                role:g.urole.mnum, hero:[g.u.ux,g.u.uy], amulet:g.u.uamul?.o_id || 0,
                intrinsic:[g.u.intrinsic?.HHalf_physical_damage || 0,
                           g.u.intrinsic?.HHalf_spell_damage || 0],
                extrinsic:[g.u.uprops?.HALF_PHDAM || 0, g.u.uprops?.HALF_SPDAM || 0],
                legacy:[g.u.wiz_intrinsic_timeouts?.HALF_PHDAM || 0,
                        g.u.wiz_intrinsic_timeouts?.HALF_SPDAM || 0],
                inventory:(g.invent || []).map(o => ({id:o.o_id,type:o.otyp,
                    artifact:o.oartifact || 0,letter:o.invlet,worn:o.owornmask || 0})),
                floor:(g.level.objects || []).filter(o => o.oartifact).map(o => ({id:o.o_id,
                    type:o.otyp,artifact:o.oartifact,x:o.ox,y:o.oy,where:o.where})),
            });
        }};
        run = await runSegment({...part, storage:new InMemoryStorage()});
    } finally {
        if (previous) Object.defineProperty(globalThis, '__step_snapshot', previous);
        else delete globalThis.__step_snapshot;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, '__step_snapshot'), previous);
    const output=outputs(run), texts=output.screens.map(screen => decodeScreen(screen)
        .map(row => row.map(renderCell).join('').trimEnd()).join('\n'));
    assert.equal(output.screens.length, part.moves.length+1);
    assert.deepEqual(output.slices.flat(), output.calls, 'all calls belong to the recorded input slices');
    const result={name:part.name,states,texts,hashes:hashes(output),boundaries:output.screens.length,
        calls:output.calls.length,frames:output.frames.flat().length};
    if (keepOutput) result.output=output;
    return result;
}
