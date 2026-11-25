// Current repository ordinary controls. Native parity is a separate check.
// Usage: node tools/potion-impact-input-gate.mjs [compact-report.json]
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import {decodeScreen,renderCell} from '../frozen/screen-decode.mjs';
import {hash,outputs,hashes,deferred} from './half-damage-reader-observe.mjs';
import {branchAssertionErrors,recordingIntegrityErrors} from './gen-sessions/assertions.mjs';

const recipeURL=new URL('gen-sessions/recipes/potion-impact-owner.json',import.meta.url);
const nativeURL=new URL('gen-sessions/generated/potion-impact-owner.session.json',import.meta.url);
const bytes=readFileSync(recipeURL),recipe=JSON.parse(bytes),parts=recipe.segments;
const fields=p=>['name','seed','datetime','nethackrc','moves'].map(field=>
    ({field,present:Object.hasOwn(p,field),value:p[field]}));
assert.deepEqual(parts.map(s=>s.name),['unpaid-self','paid-self','hero-acid-newt','hero-acid-resistant']);
const raw=readFileSync(nativeURL),native=JSON.parse(raw);
assert.equal(native.source,'c');assert.equal(native.version,5);
assert.deepEqual(recordingIntegrityErrors(native),[]);
assert.deepEqual(branchAssertionErrors(recipe,native),[]);
assert.deepEqual(native.segments.map(fields),parts.map(fields));
for(const part of native.segments) {
    assert.ok(part.steps?.length);
    assert.deepEqual(part.steps.map(s=>s.key),[null,...part.moves]);
}
const nativeSHA256=createHash('sha256').update(raw).digest('hex');
const results=[];
const deadline=setTimeout(()=>{console.error('55 second ordinary worker limit');process.exit(2);},55000);
for(const part of parts) {
    const states=[],prior=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');
    let output;
    const result={name:part.name,inputSHA256:hash(fields(part))};
    try {
        try {
            globalThis.__step_snapshot={step:'*',cb(g,step){
                if(!g.u||!g.level) return;
                const eshk=g.level.monsters.find(m=>m.isshk)?.eshk;
                states.push({step,hp:g.u.uhp,mortality:g.u.umortality||0,
                    kills:g.u.uconduct?.killer||0,xp:g.u.uexp||0,
                    held:(g.invent||[]).filter(o=>o.otyp===O.POT_LEVITATION)
                        .map(o=>({id:o.o_id,quantity:o.quan,unpaid:!!o.unpaid})),
                    bill:eshk?{debit:eshk.debit||0,credit:eshk.credit||0,robbed:eshk.robbed||0,
                        entries:(eshk.bill_p||[]).map(b=>({id:b.bo_id,quantity:b.bquan,price:b.price,useup:!!b.useup})),
                        copies:(g.billobjs||[]).length}:null,
                    targets:g.level.monsters.filter(m=>m.mhp>0&&[P.PM_NEWT,P.PM_ACID_BLOB].includes(m.mnum))
                        .map(m=>({id:m.m_id,type:m.mnum,hp:m.mhp})),
                    died:[g.mvitals[P.PM_NEWT]?.died||0,g.mvitals[P.PM_ACID_BLOB]?.died||0]});
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
        assert.ok(states.every(s=>s.hp>0&&!s.mortality),'no death or debug resurrection');
        Object.assign(result,{observerNeutral:true,deferredNeutral:true,
            boundaries:output.screens.length,calls:output.calls.length,frames:output.frames.flat().length,
            hashes:hashes(output)});
        if(recipe.unchangedOutputHashes[part.name])
            assert.deepEqual(result.hashes,recipe.unchangedOutputHashes[part.name]);
        const last=states.at(-1);
        if(part.name.endsWith('self')) {
            assert.ok(texts.some(t=>/crashes on your/.test(t)),'potionhit reached, not ceiling breakage');
            assert.equal(last.held.length,0,'the actual target potion is consumed');
            const unpaid=part.name==='unpaid-self';
            const acquired=states.find(s=>s.held.some(o=>o.unpaid===unpaid));
            assert.ok(acquired,'matching paid/unpaid inventory exists before impact');
            const obj=acquired.held.find(o=>o.unpaid===unpaid);
            const bp=acquired.bill.entries.find(b=>b.id===obj.id);
            assert.equal(!!bp,unpaid);
            assert.deepEqual(last.bill.entries,[]);assert.equal(last.bill.copies,0);
            assert.equal(last.bill.debit,unpaid?bp.price*bp.quantity:0);
            assert.equal(last.bill.credit,0);assert.equal(last.bill.robbed,0);
            assert.equal(last.kills,0);
        } else if(part.name==='hero-acid-newt') {
            assert.ok(texts.some(t=>/crashes on the newt/.test(t)));
            assert.ok(texts.some(t=>/You kill the newt!/.test(t)));
            const before=states.find(s=>s.targets.some(m=>m.type===P.PM_NEWT));
            assert.ok(before);assert.equal(last.died[0],1);assert.equal(last.kills,1);
            assert.ok(last.xp>before.xp);
            assert.ok(!last.targets.some(m=>m.type===P.PM_NEWT));
        } else {
            assert.ok(texts.some(t=>/crashes on the acid blob/.test(t)));
            assert.ok(last.targets.some(m=>m.type===P.PM_ACID_BLOB));
            assert.equal(last.died[1],0);assert.equal(last.kills,0);
            assert.ok(!texts.some(t=>/in pain!/.test(t)));
        }
        result.pass=true;
    } catch(error) {
        Object.assign(result,{pass:false,error:error.message.slice(0,450),final:states.at(-1)});
    }
    results.push(result);
}
clearTimeout(deadline);
const report={kind:'ordinary reach, current-runtime assertions and observer/deferred neutrality',
    recipeSHA256:createHash('sha256').update(bytes).digest('hex'),nativeSHA256,
    inputSHA256:hash(parts.map(fields)),passed:results.filter(r=>r.pass).length,total:results.length,results};
if(process.argv[2]) writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,total:report.total,
    boundaries:results.reduce((n,r)=>n+(r.boundaries||0),0),calls:results.reduce((n,r)=>n+(r.calls||0),0),
    frames:results.reduce((n,r)=>n+(r.frames||0),0),failures:results.filter(r=>!r.pass).map(r=>({name:r.name,error:r.error}))}));
if(report.passed!==report.total) process.exitCode=1;
