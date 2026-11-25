// Current-repository gate. Exact canonical C integrity is not native parity.
// Usage: node tools/travel-input-gate.mjs [compact-report.json]
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {DOOR,D_CLOSED} from '../js/const.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import {decodeScreen,renderCell} from '../frozen/screen-decode.mjs';
import {outputs,hashes,hash,deferred} from './half-damage-reader-observe.mjs';
import {branchAssertionErrors,recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
assert.ok(process.argv.length<=3&&!process.argv[2]?.startsWith('--'));
const recipe=JSON.parse(readFileSync(new URL('gen-sessions/recipes/travel-owner.json',import.meta.url)));
const fields=s=>['name','seed','datetime','nethackrc','moves'].map(field=>({field,present:Object.hasOwn(s,field),value:s[field]}));
assert.equal(recipe.segments.length,12);
assert.equal(hash(recipe.segments.map(fields)),'47b59143359a2e583a76d62ed09b5e2ae263a0a6e8db94ea1af3b7f9a2c3d4f1');
assert.equal(hash(recipe.branchRequirements),'5ea82ae6e8fde40d438446df568c9d6db81648f31908c5f611a042b1ea4277cb');
assert.equal(hash(recipe.unchangedOutputHashes),'8265ea398a05cf95fc4cbb82573f763255a05667b3921404d7cdf3adfd8fd399');
assert.equal(Object.keys(recipe.unchangedOutputHashes).length,5);
function warningFrames(frames){
    const warnings={one:0,two:0};
    for(const frame of frames){
        const cells=decodeScreen(frame.screen).slice(1,22).flat();
        if(cells.some(c=>c.color===1&&c.ch==='1'))warnings.one++;
        if(cells.some(c=>c.color===1&&c.ch==='2'))warnings.two++;
    }
    return warnings;
}
// Mandatory inline preflight. Preserve the original bytes, not a reserialization.
const bytes=readFileSync(new URL('gen-sessions/generated/travel-owner.session.json',import.meta.url));
const rawSHA256=createHash('sha256').update(bytes).digest('hex');
assert.equal(rawSHA256,'ee704e7134c27ca01221c3e842bfbf7095bdd2097ba5c4cad746b62e7a869e18');
assert.equal(bytes.length,1556167);const native=JSON.parse(bytes);
assert.equal(native.source,'c');assert.equal(native.version,5);assert.equal(native.segments.length,12);
assert.deepEqual(native.segments.map(fields),recipe.segments.map(fields),'five input fields and presence');
for(const part of native.segments)assert.deepEqual(part.steps.map(s=>s.key),[null,...part.moves],'every input key');
assert.deepEqual(recordingIntegrityErrors(native),[]);assert.equal(recipe.requireBranchAssertions,true);
assert.equal(recipe.branches.length,12);assert.equal(recipe.branchAssertions.length,12);assert.equal(recipe.branchRequirements.length,12);
assert.deepEqual(recipe.branches,recipe.branchRequirements.map(r=>r.branch));
assert.deepEqual(recipe.branchAssertions.map(r=>[r.branch,r.segment]),recipe.branches.map((branch,i)=>[branch,i]));
assert.deepEqual(branchAssertionErrors(recipe,native),[],'twelve native branch assertions');
for(const [i,part] of native.segments.entries()){
    const req=recipe.branchRequirements[i],frames=part.steps.flatMap(s=>s.animation_frames||[]);
    assert.deepEqual(recipe.branchAssertions[i],{branch:req.branch,segment:i,
        screenIncludes:[req.message,'MacOS NetHack Version 5.0.0'],
        screenExcludes:req.name==='grid-mapped-diagonal'?['You cannot move diagonally.']:[],
        screenCells:[{step:part.moves.length,x:req.finalXY[0]-1,y:req.finalXY[1]+1,equals:req.finalGlyph}]});
    assert.equal(req.name,part.name);assert.equal(frames.length,req.frames,'native branch frame count');
    assert.deepEqual(warningFrames(frames),req.warningFrames,'native frontier/fallback branch evidence');
}
const results=[],bound=setTimeout(()=>{console.error('55 second ordinary worker bound');process.exit(2);},55000);
for(const [index,part] of recipe.segments.entries()){
    const r={name:part.name,inputSHA256:hash(fields(part))},states=[],prior=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');
    try{
        let output;
        try{
            globalThis.__step_snapshot={step:'*',cb(g,step){if(!g.u||!g.level)return;
                const loc=g.level.at(53,18);
                states.push({step,xy:[g.u.ux,g.u.uy],d:[g.u.dx,g.u.dy],form:g.u.umonnum,turn:g.moves,
                    hp:g.u.uhp,mh:g.u.mh,mortality:g.u.umortality||0,travel:g.context.travel||0,
                    cc:g.iflags.travelcc,terrain:loc.typ,door:loc.doormask,
                    inventory:g.invent.map(o=>o.otyp)});
            }};
            output=outputs(await runSegment({...part,storage:new InMemoryStorage()}));
        }finally{if(prior)Object.defineProperty(globalThis,'__step_snapshot',prior);else delete globalThis.__step_snapshot;}
        assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),prior);
        Object.assign(r,{hashes:hashes(output),boundaries:output.screens.length,calls:output.calls.length,frames:output.frames.flat().length});
        assert.deepEqual(output,outputs(await runSegment({...part,storage:new InMemoryStorage()})),'all-five observer neutrality');r.observerNeutral=true;
        assert.deepEqual(output,await deferred(part),'all-five deferred delivery and held EOF');r.deferredNeutral=true;
        assert.equal(output.screens.length,part.moves.length+1);assert.deepEqual(output.slices.flat(),output.calls);
        const texts=output.screens.map(s=>decodeScreen(s).map(row=>row.map(renderCell).join('').trimEnd()).join('\n'));
        const req=recipe.branchRequirements[index],last=states.at(-1),text=texts.join('\n');
        assert.equal(req.name,part.name);assert.equal(req.branch,recipe.branches[index]);
        assert.ok(states.every(s=>s.hp>0&&!s.mortality),'survival');assert.match(texts.at(-1),/MacOS NetHack Version 5\.0\.0/);
        r.final={xy:last.xy,d:last.d,turn:last.turn,form:last.form};assert.deepEqual(last.xy,req.finalXY);
        assert.ok(text.includes(req.message),'source branch message');
        const cell=decodeScreen(output.screens.at(-1))[req.finalXY[1]+1][req.finalXY[0]-1];assert.equal(cell.ch,req.finalGlyph);
        if(part.name==='grid-mapped-diagonal'){
            assert.equal(last.form,P.PM_GRID_BUG);assert.equal(last.turn,6);assert.deepEqual(last.d,[1,0]);
            assert.ok(!text.includes('You cannot move diagonally.'));assert.deepEqual(last.cc,{x:0,y:0});
        }
        if(['ooze-door-direct','bulky-ooze-negative','human-door-negative'].includes(part.name)){
            assert.ok(states.some(s=>s.terrain===DOOR&&(s.door&D_CLOSED)));assert.equal(last.terrain,DOOR);
            if(part.name!=='human-door-negative')assert.equal(last.form,P.PM_GRAY_OOZE);
            if(part.name==='ooze-door-direct'){assert.deepEqual(last.d,[1,0]);assert.equal(last.inventory.length,0);}
            else {assert.ok(!text.includes('You ooze under the door.'));assert.notEqual(last.d[1],0);}
            if(part.name==='bulky-ooze-negative')assert.ok(last.inventory.includes(O.LONG_SWORD));
        }
        r.warningFrames=warningFrames(output.frames.flat());assert.equal(r.frames,req.frames,'exact branch frame count');
        assert.deepEqual(r.warningFrames,req.warningFrames,'source frontier/fallback branches');
        if(req.negative)assert.deepEqual(r.hashes,recipe.unchangedOutputHashes[part.name],'all-five fixed negative hashes');
        r.pass=true;
    }catch(e){r.pass=false;r.error=e.message.slice(0,700);}
    results.push(r);
}
clearTimeout(bound);
const report={classification:'twelve ordinary keyboard cases',nativeParityClaimed:false,
    nativeIntegrity:{rawSHA256,sourceCVersion5:true,fieldsAndKeysExact:true,branches:12},
    total:results.length,passed:results.filter(r=>r.pass).length,results};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:report.total,passed:report.passed,nativeBranches:12,firstFailure:results.find(r=>!r.pass)||null}));
if(report.passed!==report.total)process.exitCode=1;
