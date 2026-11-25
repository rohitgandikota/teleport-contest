// Current-repository ordinary JS gate. No native parity is asserted here.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {branchAssertionErrors,recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {Blind} from '../js/youprop.js';
import {DOOR,D_CLOSED} from '../js/const.js';
import {ART_EYES_OF_THE_OVERWORLD} from '../js/artilist_data.js';
import {decodeScreen,renderCell} from '../frozen/screen-decode.mjs';
import {outputs,hashes,hash,deferred} from './half-damage-reader-observe.mjs';
assert.ok(process.argv.length<=3&&!process.argv[2]?.startsWith('--'));
const recipeBytes=readFileSync(new URL('gen-sessions/recipes/lookaround-owner.json',import.meta.url));
assert.equal(createHash('sha256').update(recipeBytes).digest('hex'),'dda405909c1c7231269b409a3c2dcf76f5eebc156ee65dccf3e502c1191784d5');
const recipe=JSON.parse(recipeBytes);
const fields=s=>['name','seed','datetime','nethackrc','moves'].map(field=>({field,present:Object.hasOwn(s,field),value:s[field]}));
assert.equal(recipe.segments.length,4);
assert.equal(hash(recipe.segments.map(fields)),'ad564805e489369dcf0b97c16868c87eb40d5cc89cab79c57fe140589259a9a3');
assert.equal(hash(recipe.branchRequirements),'397a1616a6de44aed79a7b8a1933fdf9807777bc8fd09ca668a5d31916306dcb');
assert.equal(hash(recipe.unchangedOutputHashes),'781243bc93db67dbcc1b6a8c9a112e5fc97011e85aea71aa49b2c595c1022388');
// Mandatory exact original C recording and input preflight; no replay comparison here.
const bytes=readFileSync(new URL('gen-sessions/generated/lookaround-owner.session.json',import.meta.url));
const rawSHA256=createHash('sha256').update(bytes).digest('hex');
assert.equal(rawSHA256,'c47781e9b14889ae7c676dd2940b481f9276d2ce19fbaf6632600fd186a4b979');
assert.equal(bytes.length,609265);const native=JSON.parse(bytes);
assert.equal(native.source,'c');assert.equal(native.version,5);assert.equal(native.segments.length,4);
assert.deepEqual(native.segments.map(fields),recipe.segments.map(fields));
for(const part of native.segments)assert.deepEqual(part.steps.map(s=>s.key),[null,...part.moves]);
assert.deepEqual(recordingIntegrityErrors(native),[]);
assert.equal(recipe.requireBranchAssertions,true);assert.equal(recipe.branchAssertions.length,6);
assert.deepEqual(branchAssertionErrors(recipe,native),[]);
assert.equal(native.segments.reduce((n,s)=>n+s.steps.length,0),251);
assert.equal(recipe.segments.reduce((n,s)=>n+s.moves.length,0),247);
const results=[],bound=setTimeout(()=>{console.error('55 second ordinary bound');process.exit(2);},55000);
for(const [i,part]of recipe.segments.entries()){
    const r={name:part.name,inputSHA256:hash(fields(part))},states=[];
    const prior=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');
    try{
        let output;
        try{
            globalThis.__step_snapshot={step:'*',cb(g,step){if(!g.u||!g.level)return;
                const door=g.level.at(70,8);
                states.push({step,xy:[g.u.ux,g.u.uy],turn:g.moves,hp:g.u.uhp,mortality:g.u.umortality||0,
                    blind:Blind(),cached:!!g.u.ublind,cream:g.u.ucreamed||0,timeout:g.u.intrinsic?.HBlinded||0,
                    blocked:g.u.blocked?.BLINDED||0,artifact:g.u.ublindf?.oartifact||0,
                    door:[door.typ,door.doormask]});
            }};
            output=outputs(await runSegment({...part,storage:new InMemoryStorage()}));
        }finally{if(prior)Object.defineProperty(globalThis,'__step_snapshot',prior);else delete globalThis.__step_snapshot;}
        assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),prior);
        Object.assign(r,{hashes:hashes(output),boundaries:output.screens.length,calls:output.calls.length,frames:output.frames.flat().length});
        assert.deepEqual(output,outputs(await runSegment({...part,storage:new InMemoryStorage()})),'all-five observer neutrality');r.observerNeutral=true;
        assert.deepEqual(output,await deferred(part),'all-five deferred delivery and held EOF');r.deferredNeutral=true;
        assert.equal(output.screens.length,part.moves.length+1);assert.deepEqual(output.slices.flat(),output.calls);
        const req=recipe.branchRequirements[i],before=states.find(s=>s.step===req.runKey),last=states.at(-1);
        const texts=output.screens.map(s=>decodeScreen(s).map(row=>row.map(renderCell).join('').trimEnd()).join('\n'));
        assert.equal(req.name,part.name);assert.ok(states.every(s=>s.hp>0&&!s.mortality),'survival');
        assert.deepEqual(before.xy,req.startXY);assert.deepEqual(before.door,[DOOR,D_CLOSED]);
        assert.equal(before.blind,req.blind);assert.equal(!!before.cream,req.cream);
        assert.equal(before.artifact===ART_EYES_OF_THE_OVERWORLD,req.eyes);
        if(req.eyes)assert.ok(before.blocked);
        if(req.cream)assert.ok(before.timeout>0);
        r.before=before;r.final={xy:last.xy,turn:last.turn,blind:last.blind};
        assert.deepEqual(last.xy,req.finalXY,'C lookaround stop versus blind continuation');assert.equal(last.turn,req.finalTurn);
        assert.equal(texts.join('\n').includes('You stop in front of the door.'),req.stopsAtDoor);
        assert.match(texts.at(-1),/MacOS NetHack Version 5\.0\.0/);
        if(req.negative)assert.deepEqual(r.hashes,recipe.unchangedOutputHashes[part.name],'three original all-five negatives');
        r.pass=true;
    }catch(e){r.pass=false;r.error=e.message.slice(0,500);}
    results.push(r);
}
clearTimeout(bound);
const report={classification:'four ordinary keyboard cases',nativeParityClaimed:false,total:results.length,passed:results.filter(r=>r.pass).length,results};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:report.total,passed:report.passed,failed:results.filter(r=>!r.pass).map(r=>r.name),hash:hash(results)}));
if(report.passed!==report.total)process.exitCode=1;
