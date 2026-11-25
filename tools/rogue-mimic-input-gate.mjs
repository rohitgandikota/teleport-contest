// Locked original-C inputs, real figurines, and unchanged control outputs.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {branchAssertionErrors, recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
const root = new URL('../',import.meta.url);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = (path,expected) => {
    const bytes=readFileSync(new URL(path,root)); assert.equal(sha(bytes),expected,path);
    return JSON.parse(bytes);
};
assert.ok(process.argv.length<=3);
const recipe=read('tools/gen-sessions/recipes/rogue-mimic-wall.json','13af7a2485353e500dd5570a7f7023326fb7eb6c86c4d79b75f863b56abfbca4');
const native=read('tools/gen-sessions/generated/rogue-mimic-wall.session.json','4f44eccdfac62b3ef3f4966033478916731dbcfe79145e69dfe7933b9c6e22c3');
const negative=read('tools/gen-sessions/evidence/rogue-mimic-wall/negative-hashes.json','1a06a7f0d421ef4ecb89eab3299c8fe550c2105f50b160ead1f9ea76d9496ba0');
assert.equal(native.source,'c');assert.equal(native.version,5);
assert.equal(recipe.segments.length,5);assert.equal(native.segments.length,5);
assert.equal(recipe.requireBranchAssertions,true);assert.equal(recipe.branchAssertions.length,5);
assert.deepEqual(branchAssertionErrors(recipe,native),[]);assert.deepEqual(recordingIntegrityErrors(native),[]);
for(const [i,part] of recipe.segments.entries()) {
    for(const key of ['name','seed','datetime','nethackrc','moves']) {
        assert.ok(Object.hasOwn(part,key));assert.ok(Object.hasOwn(native.segments[i],key));
        assert.deepEqual(native.segments[i][key],part[key]);
    }
    assert.deepEqual(native.segments[i].steps.map(s=>s.key),[null,...part.moves]);
}
assert.equal(native.segments.reduce((n,s)=>n+s.steps.length,0),356);
assert.equal(recipe.segments.reduce((n,s)=>n+s.moves.length,0),351);
const {runSegment}=await import('../js/jsmain.js');
const {InMemoryStorage}=await import('../js/storage.js');
const {PMNAMES,MONSYMS}=await import('../js/monst_data.js');
const {Is_rogue_level,DOOR,M_AP_FURNITURE,M_AP_OBJECT,HWALL}=await import('../js/const.js');
const {outputs,hashes,deferred}=await import('./half-damage-reader-observe.mjs');
const results=[],limit=setTimeout(()=>{console.error('45 second input limit');process.exit(2);},45000);
for(const [i,part] of recipe.segments.entries()) {
    const row={name:part.name},states=[];
    try {
        const prior=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');let output;
        try {
            globalThis.__step_snapshot={step:'*',cb(g,step){
                states.push({step,rogue:!!Is_rogue_level(g.u.uz),text:g._toplines||'',
                    mimics:g.level.monsters.filter(m=>m.mnum===PMNAMES.PM_SMALL_MIMIC)
                        .map(m=>({x:m.mx,y:m.my,type:m.m_ap_type,appearance:m.mappearance,
                            terrain:g.level.at(m.mx,m.my).typ,left:g.level.at(m.mx-1,m.my).typ}))});
            }};
            output=outputs(await runSegment({...part,storage:new InMemoryStorage()}));
        } finally {
            if(prior)Object.defineProperty(globalThis,'__step_snapshot',prior);
            else delete globalThis.__step_snapshot;
        }
        assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),prior);
        assert.equal(states.length,part.moves.length+1);
        assert.deepEqual(output,outputs(await runSegment({...part,storage:new InMemoryStorage()})));
        assert.deepEqual(output,await deferred(part));
        for(const key of ['screens','cursors','slices','frames'])assert.equal(output[key].length,part.moves.length+1);
        assert.deepEqual(output.slices.flat(),output.calls);
        const first=states.find(s=>s.mimics.length);assert.ok(first);assert.equal(first.mimics.length,1);
        const mon=first.mimics[0];assert.equal(first.rogue,i<2||i===4);
        assert.ok(states.some(s=>s.text.includes('You set the figurine beside you and it transforms.')));
        if(i<4) {
            assert.equal(mon.terrain,DOOR);assert.equal(mon.type,M_AP_FURNITURE);
            assert.equal(mon.appearance,[MONSYMS.S_vwall,MONSYMS.S_hwall,MONSYMS.S_vcdoor,MONSYMS.S_hcdoor][i]);
            assert.equal(mon.left===HWALL,i===1||i===3);
        } else assert.equal(mon.type,M_AP_OBJECT);
        const assertion={...recipe.branchAssertions[i],segment:0};
        assert.deepEqual(branchAssertionErrors({branches:[assertion.branch],requireBranchAssertions:true,branchAssertions:[assertion]},
            {segments:[{steps:output.screens.map(screen=>({screen}))}]}),[]);
        row.hashes=hashes(output);if(negative[part.name])assert.deepEqual(row.hashes,negative[part.name]);
        row.first=first;row.boundaries=output.screens.length;row.calls=output.calls.length;row.frames=output.frames.flat().length;row.pass=true;
    } catch(error) {row.pass=false;row.error=error.message;process.exitCode=1;}
    results.push(row);console.log(`${row.pass?'PASS':'FAIL'} ${part.name}`);
}
clearTimeout(limit);
const report={passed:results.filter(r=>r.pass).length,total:5,results};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,total:report.total}));
