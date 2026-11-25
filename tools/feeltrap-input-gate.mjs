// Ordinary tactile discovery, with complete output and deferred-input checks.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {Blind,Levitation} from '../js/youprop.js';
import {VIBRATING_SQUARE} from '../js/const.js';
import {cmap_names as CM} from '../js/drawing_data.js';
import {decodeScreen,renderCell} from '../frozen/screen-decode.mjs';
import {outputs,hashes,deferred} from './half-damage-reader-observe.mjs';
import {branchAssertionErrors,recordingIntegrityErrors} from './gen-sessions/assertions.mjs';

const read=name=>JSON.parse(readFileSync(new URL(name,import.meta.url)));
const recipe=read('gen-sessions/recipes/feeltrap-discovery.json');
const native=read('gen-sessions/generated/feeltrap-discovery.session.json');
const fields=s=>['name','seed','datetime','nethackrc','moves'].map(k=>
    ({field:k,present:Object.hasOwn(s,k),value:s[k]}));
assert.equal(native.source,'c');assert.equal(native.version,5);
assert.deepEqual(recordingIntegrityErrors(native),[]);
assert.deepEqual(branchAssertionErrors(recipe,native),[]);
assert.deepEqual(native.segments.map(fields),recipe.segments.map(fields));
for(const s of native.segments)assert.deepEqual(s.steps.map(x=>x.key),[null,...s.moves]);
const deadline=setTimeout(()=>{console.error('55 second input limit');process.exit(2);},55000);
const results=[];
for(const part of recipe.segments) {
    const states=[],prior=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');
    const result={name:part.name};
    try {
        let out;
        try {
            globalThis.__step_snapshot={step:'*',cb(g,step){
                if(!g.u||!g.level)return;
                const trap=g.level.traps.find(t=>t.ttyp===VIBRATING_SQUARE);
                states.push({step,x:g.u.ux,y:g.u.uy,blind:Blind(),floating:Levitation(),
                    hp:g.u.uhp,mortality:g.u.umortality||0,
                    trap:trap?{x:trap.tx,y:trap.ty,seen:trap.tseen,
                        memory:structuredClone(g.level.at(trap.tx,trap.ty).remembered_glyph)}:null});
            }};
            out=outputs(await runSegment({...part,storage:new InMemoryStorage()}));
        } finally {
            if(prior)Object.defineProperty(globalThis,'__step_snapshot',prior);
            else delete globalThis.__step_snapshot;
        }
        assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),prior);
        assert.deepEqual(out,outputs(await runSegment({...part,storage:new InMemoryStorage()})));
        assert.deepEqual(out,await deferred(part));
        result.hashes=hashes(out);
        result.boundaries=out.screens.length;result.calls=out.calls.length;
        result.frames=out.frames.flat().length;
        assert.equal(out.screens.length,part.moves.length+1);
        assert.deepEqual(out.slices.flat(),out.calls);
        const last=states.at(-1);
        assert.ok(states.every(s=>s.hp>0&&!s.mortality));
        assert.equal(last.blind,part.name.startsWith('blind'));
        assert.equal(last.floating,part.name.endsWith('floating'));
        assert.ok(states.some(s=>s.trap&&!s.trap.seen),'trap begins undiscovered');
        assert.ok(states.some(s=>s.trap?.seen&&s.x===s.trap.x&&s.y===s.trap.y));
        assert.ok(last.x!==last.trap.x||last.y!==last.trap.y,'hero leaves the trap');
        assert.equal(last.trap.memory.glyph.cmap,CM.S_vibrating_square);
        const grid=decodeScreen(out.screens[part.moves.indexOf('#version')]);
        assert.equal(renderCell(grid[last.trap.y+1][last.trap.x-1]),'~');
        assert.match(decodeScreen(out.screens.at(-1))[0].map(renderCell).join(''),/NetHack Version/);
        if(part.name!=='blind-floating')
            assert.deepEqual(result.hashes,recipe.unchangedOutputHashes[part.name]);
        result.pass=true;
    } catch(error) {
        result.pass=false;result.error=error.message.slice(0,450);
    }
    results.push(result);
}
clearTimeout(deadline);
const report={passed:results.filter(r=>r.pass).length,total:results.length,results};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
if(report.passed!==report.total)process.exitCode=1;
