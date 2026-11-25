// Ordinary keys against the current runtime. Independent native parity is separate.
// Usage: node tools/half-damage-reader-input-gate.mjs [report.json]
// Inputs always come from the canonical recipe and native fixture below.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {observe,deferred,hash} from './half-damage-reader-observe.mjs';

const recipeURL=new URL('gen-sessions/recipes/half-damage-reader.json',import.meta.url);
const nativeURL=new URL('gen-sessions/generated/half-damage-reader.session.json',import.meta.url);
const recipeBytes=readFileSync(recipeURL),nativeBytes=readFileSync(nativeURL);
const recipe=JSON.parse(recipeBytes),native=JSON.parse(nativeBytes);
const fields=part=>['name','seed','datetime','nethackrc','moves'].map(field=>
    ({field,present:Object.hasOwn(part,field),value:part[field]}));
assert.equal(native.source,'c');
assert.equal(native.version,5);
assert.equal(recipe.segments.length,26);
assert.equal(native.segments.length,26);
assert.deepEqual(native.segments.map(fields),recipe.segments.map(fields),
    'canonical native fixture and recipe must have identical input fields');
for(const part of native.segments) {
    assert.ok(part.steps?.length,'canonical fixture must contain native recording steps');
    assert.deepEqual(part.steps.map(s=>s.key),[null,...part.moves],
        'native recording keys agree with the ordinary input');
}

// Exact branch-reach expressions from the sealed ordinary proposal.
const requirements={
    bottle:'crashes on your','acid-hit':'This burns','acid-drink':'This burns',
    ceiling:'hit your .* on the',wand:'vibrates violently and explodes',
    ring:'pulsates momentarily, then explodes',earth:'hit by .*boulder',
    'force-bolt':'bash yourself',rocktrap:'falls on your','spiked-pit':'sharp iron spikes',
    pit:'fall into .*pit',lava:'hit by molten lava',eel:'turn into a giant eel',
};
assert.deepEqual(recipe.segments.map(s=>s.name),Object.keys(requirements)
    .flatMap(owner=>[`${owner}/timed`,`${owner}/none`]));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const report={kind:'ordinary JS reach and observer/deferred neutrality; native parity is separate',
    recipeSHA256:digest(recipeBytes),nativeSHA256:digest(nativeBytes),
    inputSHA256:hash(recipe.segments.map(fields)),cases:[]};
function save() {
    if(process.argv[2]) writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
}
const deadline=setTimeout(()=>{
    report.timeout=true;save();console.error('55 second ordinary worker limit');process.exit(2);
},55000);
for(const part of recipe.segments) {
    const row={name:part.name,inputSHA256:hash(fields(part))};
    try {
        const after=await observe(part);
        const plain=await observe(part,false);
        assert.deepEqual(after.output,plain.output,'all five collections observer-neutral');
        assert.deepEqual(after.output,await deferred(part),'all five collections deferred-neutral');
        assert.match(after.texts.at(-1),/NetHack Version/,'the final command completes');
        assert.ok(after.states.every(s=>s.hp>0 && !s.mortality),
            'survives without debug resurrection');
        const requirement=requirements[part.name.split('/')[0]];
        const reached=after.texts.some(t=>new RegExp(requirement,'i').test(t));
        const source=part.name.endsWith('/timed')
            ? after.states.some(s=>s.intrinsic[0]>0||s.intrinsic[1]>0)
            : after.states.every(s=>s.intrinsic.every(n=>n===0));
        assert.ok(reached,'source branch reached');
        assert.ok(source,'timed source or absent-source negative established');
        Object.assign(row,{pass:true,reached,source,observerNeutral:true,deferredNeutral:true,
            boundaries:after.output.screens.length,calls:after.output.calls.length,
            frames:after.output.frames.flat().length,hashes:after.hashes});
    } catch(error) { Object.assign(row,{pass:false,error:error.message.slice(0,500)}); }
    report.cases.push(row);
}
clearTimeout(deadline);
report.passed=report.cases.filter(r=>r.pass).length;
report.total=report.cases.length;
save();
console.log(JSON.stringify({passed:report.passed,total:report.total,
    boundaries:report.cases.reduce((n,r)=>n+(r.boundaries||0),0),
    calls:report.cases.reduce((n,r)=>n+(r.calls||0),0),
    frames:report.cases.reduce((n,r)=>n+(r.frames||0),0),
    failures:report.cases.filter(r=>!r.pass)}));
if(report.cases.some(r=>!r.pass)) process.exitCode=1;
