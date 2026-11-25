// Ordinary wizard commands, current-runtime assertions, no cached baseline.
// Usage: node tools/potion-breathing-input-gate.mjs [compact-report.json]
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import {TIMEOUT,FROMFORM} from '../js/const.js';
import {Blind,Invis,See_invisible} from '../js/youprop.js';
import {decodeScreen,renderCell} from '../frozen/screen-decode.mjs';
import {hash,outputs,hashes,deferred} from './half-damage-reader-observe.mjs';
import {branchAssertionErrors,recordingIntegrityErrors} from './gen-sessions/assertions.mjs';

const recipeURL=new URL('gen-sessions/recipes/potion-breathing-owner.json',import.meta.url);
const nativeURL=new URL('gen-sessions/generated/potion-breathing-owner.session.json',import.meta.url);
const bytes=readFileSync(recipeURL),recipe=JSON.parse(bytes),parts=recipe.segments;
const names=['poly-healing','poly-extra-healing','poly-full-healing','base-full-healing',
    'poly-full-healing-cap','invisibility-visible','invisibility-timed','invisibility-see-timed',
    'invisibility-stalker','invisibility-form-see','invisibility-ring-blocked'];
const fields=p=>['name','seed','datetime','nethackrc','moves'].map(field=>
    ({field,present:Object.hasOwn(p,field),value:p[field]}));
assert.deepEqual(parts.map(s=>s.name),names);
const nativeBytes=readFileSync(nativeURL);
const nativeSHA256=createHash('sha256').update(nativeBytes).digest('hex');
assert.equal(nativeSHA256,'26442f594516d515810d74803225c1bbdef02bfb086746b12213cd0462683a8b',
    'canonical native recording must preserve the original raw bytes');
const native=JSON.parse(nativeBytes);
assert.equal(native.source,'c');assert.equal(native.version,5);
assert.equal(parts.length,11);assert.equal(native.segments.length,11);
assert.equal(hash(parts.map(fields)),'e1d06468cc5f90b2f4edda4b1d93fb72428acf01a7e508eb43d760122b5868bf',
    'original five input fields and presence are fixed');
assert.deepEqual(native.segments.map(fields),parts.map(fields));
for(const part of native.segments) {
    assert.ok(part.steps?.length,'recorded native boundaries are mandatory');
    assert.deepEqual(part.steps.map(s=>s.key),[null,...part.moves],'every recorded input key is fixed');
}
assert.deepEqual(recordingIntegrityErrors(native),[]);
assert.equal(recipe.requireBranchAssertions,true);
assert.deepEqual(recipe.branches,names.map(name=>'potion-breathing.owner.'+name));
assert.equal(recipe.branchAssertions.length,11);
assert.deepEqual(recipe.branchAssertions.map(a=>[a.branch,a.segment]),recipe.branches.map((b,i)=>[b,i]));
assert.deepEqual(branchAssertionErrors(recipe,native),[],'all eleven C branch assertions');
assert.ok(Array.isArray(recipe.coverage)&&recipe.coverage.length>0);
const negativeNames=['base-full-healing','poly-full-healing-cap','invisibility-visible'];
assert.deepEqual(Object.keys(recipe.unchangedOutputHashes).sort(),[...negativeNames].sort());
const negatives=negativeNames.map(name=>[name,['screens','cursors','calls','slices','frames']
    .map(key=>[key,recipe.unchangedOutputHashes[name][key]])]);
assert.equal(hash(negatives),'edb7cad6bc897f85ba0941f02f6ea0b10fbc76d8145bd3c50529621de6935fc5',
    'all fifteen original unchanged output hashes are fixed');
const nativeIntegrity={rawSHA256Exact:true,inputFieldsAndKeysExact:true,recordingIntegrity:true,
    branches:11,negativeControls:3,nativeParityClaimed:false};
const results=[];
const deadline=setTimeout(()=>{console.error('55 second ordinary worker limit');process.exit(2);},55000);
for(const part of parts) {
    const states=[],prior=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');
    const result={name:part.name,inputSHA256:hash(fields(part))};let output;
    try {
        try {
            globalThis.__step_snapshot={step:'*',cb(g,step){
                if(!g.u||!g.level) return;
                states.push({step,turn:g.moves,hp:g.u.uhp,hpmax:g.u.uhpmax,
                    mh:g.u.mh,mhmax:g.u.mhmax,form:g.u.umonnum,base:g.u.umonster,
                    mortality:g.u.umortality||0,blind:Blind(),invisible:Invis(),see:See_invisible(),
                    HInvis:g.u.intrinsic?.HInvis||0,HSee_invisible:g.u.intrinsic?.HSee_invisible||0,
                    EInvis:g.u.uprops?.INVIS||0,BInvis:g.u.blocked?.INVIS||0,
                    known:!!g.objects[O.POT_INVISIBILITY].oc_name_known,
                    held:(g.invent||[]).map(o=>({id:o.o_id,type:o.otyp,letter:o.invlet,quantity:o.quan})),
                    floor:(g.level.objects||[]).map(o=>o.o_id)});
            }};
            output=outputs(await runSegment({...part,storage:new InMemoryStorage()}));
        } finally {
            if(prior) Object.defineProperty(globalThis,'__step_snapshot',prior);
            else delete globalThis.__step_snapshot;
        }
        assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),prior);
        assert.deepEqual(output,outputs(await runSegment({...part,storage:new InMemoryStorage()})),
            'all five collections observer neutral');
        assert.deepEqual(output,await deferred(part),'all five collections deferred neutral');
        assert.equal(output.screens.length,part.moves.length+1);
        assert.deepEqual(output.slices.flat(),output.calls);
        const texts=output.screens.map(s=>decodeScreen(s).map(r=>r.map(renderCell).join('').trimEnd()).join('\n'));
        assert.match(texts.at(-1),/NetHack Version/,'final command completes');
        assert.ok(states.every(s=>s.hp>0&&!s.mortality&&(s.form===s.base||s.mh>0)),
            'no death, rehumanization from fatal damage, or debug resurrection');
        Object.assign(result,{observerNeutral:true,deferredNeutral:true,boundaries:output.screens.length,
            calls:output.calls.length,frames:output.frames.flat().length,hashes:hashes(output)});
        const index=parts.indexOf(part),recorded={segments:[]};
        recorded.segments[index]={steps:output.screens.map((screen,i)=>({screen,rng:output.slices[i]}))};
        const branchRecipe={branches:[recipe.branches[index]],requireBranchAssertions:true,
            branchAssertions:[recipe.branchAssertions[index]]};
        assert.deepEqual(branchAssertionErrors(branchRecipe,recorded),[],'ordinary JS branch assertions');
        if(recipe.unchangedOutputHashes[part.name])
            assert.deepEqual(result.hashes,recipe.unchangedOutputHashes[part.name],'all five original unchanged outputs');
        result.branchAssertion=true;
        result.negativeHashes=Object.hasOwn(recipe.unchangedOutputHashes,part.name);
        const throws=[...part.moves.matchAll(/t([a-z])>/g)];assert.ok(throws.length);
        const lastThrow=throws.at(-1),direction=lastThrow.index+2;
        const before=states.find(s=>s.step===direction),last=states.at(-1);
        assert.ok(before);const obj=before.held.find(o=>o.letter===lastThrow[1]);assert.ok(obj);
        assert.ok(!last.held.some(o=>o.id===obj.id)&&!last.floor.includes(obj.id),'actual thrown bottle is consumed');
        const vaporText=texts.slice(direction+1).join('\n');
        assert.match(vaporText,/shatters!/);assert.match(vaporText,/smell a peculiar odor/);
        if(!part.name.startsWith('invisibility-')) {
            const amount=part.name==='poly-healing'?1:part.name==='poly-extra-healing'?2:3;
            const type=amount===1?O.POT_HEALING:amount===2?O.POT_EXTRA_HEALING:O.POT_FULL_HEALING;
            assert.equal(obj.type,type);
            const poly=part.name!=='base-full-healing';
            assert.equal(before.form,poly?P.PM_HILL_GIANT:before.base);
            const pool=poly?'mh':'hp',cap=poly?'mhmax':'hpmax';
            if(part.name.endsWith('-cap')) assert.equal(before[pool],before[cap]);
            else {
                assert.ok(before[pool]<before[cap]);
                const injuryDirection=throws[0].index+2;
                const unhurt=states.find(s=>s.step===injuryDirection);
                assert.equal(unhurt.held.find(o=>o.letter===throws[0][1])?.type,O.POT_SICKNESS);
                assert.ok(states.some(s=>s.step>injuryDirection&&s.step<direction
                    &&s[pool]===unhurt[pool]-5),'real sickness vapor caused the injury');
            }
            // Unknown healing potions pause for naming after all healing arms,
            // before the caller completes the turn and regeneration can run.
            const naming=texts.findIndex((t,i)=>i>direction&&/^Call .*potion:/m.test(t));
            assert.ok(naming>direction,'real naming boundary after vapor');
            const after=states.find(s=>s.step===naming);assert.ok(after);
            result.reached={pool,before:before[pool],after:after[pool],cap:before[cap],amount};
            assert.equal(after[pool],Math.min(before[cap],before[pool]+amount));
            if(poly) assert.equal(after.hp,Math.min(before.hpmax,before.hp+amount));
            assert.equal(last.form,before.form);
        } else {
            assert.equal(obj.type,O.POT_INVISIBILITY);assert.equal(before.blind,false);
            if(part.name==='invisibility-timed') {
                assert.ok(before.HInvis&TIMEOUT);assert.equal(before.invisible,true);
            } else if(part.name==='invisibility-see-timed') {
                assert.ok(before.HSee_invisible&TIMEOUT);assert.equal(before.see,true);
            } else if(part.name==='invisibility-stalker') {
                assert.equal(before.form,P.PM_STALKER);assert.ok(before.HInvis&FROMFORM);
                assert.equal(before.invisible,true);
            } else if(part.name==='invisibility-form-see') {
                assert.equal(before.form,P.PM_WOODLAND_ELF);assert.ok(before.HSee_invisible&FROMFORM);
                assert.equal(before.see,true);
            } else if(part.name==='invisibility-ring-blocked') {
                assert.ok(before.EInvis);assert.ok(before.BInvis);assert.equal(before.invisible,false);
            } else {
                assert.equal(before.invisible,false);assert.equal(before.see,false);
            }
            const flash=!before.invisible;
            result.reached={invisible:before.invisible,see:before.see,flash,
                knownBefore:before.known,knownAfter:last.known};
            assert.equal(/For an instant/.test(vaporText),flash);
            if(flash) assert.ok(vaporText.includes(before.see?
                'could see right through yourself':"couldn't see yourself"));
            assert.equal(last.known,before.known||flash);
            assert.equal(last.HInvis&~TIMEOUT,before.HInvis&~TIMEOUT);
            assert.equal(last.HSee_invisible&~TIMEOUT,before.HSee_invisible&~TIMEOUT);
            assert.equal(last.HInvis&TIMEOUT,Math.max(0,(before.HInvis&TIMEOUT)-(last.turn-before.turn)));
            assert.equal(last.HSee_invisible&TIMEOUT,
                Math.max(0,(before.HSee_invisible&TIMEOUT)-(last.turn-before.turn)));
        }
        result.pass=true;
    } catch(error) {
        Object.assign(result,{pass:false,error:error.message.slice(0,450),
            location:error.stack?.split('\n').find(line=>line.includes('potion-breathing-input-gate.mjs:'))});
    }
    results.push(result);
}
clearTimeout(deadline);
const report={kind:'ordinary wizard command reach and observer/deferred neutrality; native parity is separate',
    recipeSHA256:createHash('sha256').update(bytes).digest('hex'),nativeSHA256,nativeIntegrity,
    inputSHA256:hash(parts.map(fields)),passed:results.filter(r=>r.pass).length,total:results.length,results};
if(process.argv[2]) writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,total:report.total,
    boundaries:results.reduce((n,r)=>n+(r.boundaries||0),0),calls:results.reduce((n,r)=>n+(r.calls||0),0),
    frames:results.reduce((n,r)=>n+(r.frames||0),0),failures:results.filter(r=>!r.pass).map(r=>({name:r.name,error:r.error}))}));
if(report.passed!==report.total) process.exitCode=1;
