import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
const [path,receipt]=process.argv.slice(2);
assert.ok(path && receipt);
const source=JSON.parse(readFileSync(path)),results=[],storage=new InMemoryStorage();
const plainStorage=new InMemoryStorage();
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const saved=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');
try {
    for(const [segment,part] of source.segments.entries()) {
        const rows=[];
        Object.defineProperty(globalThis,'__step_snapshot',{configurable:true,writable:true,value:{step:'*',cb:(g,step)=>{
            rows.push({step,key:step?part.moves[step-1]:null,
                top:g.nhDisplay.grid[0].map(c=>c.ch).join('').trim(),
                text:g.nhDisplay.grid.map(row=>row.map(c=>c.ch).join('').trimEnd()).join('\n'),
                pickup_types:g.flags.pickup_types,weapon:g.u.uwep?.o_id,
                inventory:g.invent.map(o=>({id:o.o_id,invlet:o.invlet,otyp:o.otyp,quan:o.quan,owornmask:o.owornmask}))});
        }}});
        const run=await runSegment({...part,storage});
        const output={screens:run.getScreens(),cursors:run.getCursors(),rng:run.getRngLog(),
            slices:run.getRngSlices(),frames:run.getAnimationFramesByStep()};
        const hashes=Object.fromEntries(Object.entries(output).map(([k,v])=>[k,hash(v)]));
        delete globalThis.__step_snapshot;
        const plain=await runSegment({...part,storage:plainStorage});
        const neutral={screens:plain.getScreens(),cursors:plain.getCursors(),rng:plain.getRngLog(),
            slices:plain.getRngSlices(),frames:plain.getAnimationFramesByStep()};
        const plainHashes=Object.fromEntries(Object.entries(neutral).map(([k,v])=>[k,hash(v)]));
        assert.deepEqual(hashes,plainHashes,'observer-neutral all five collections');
        results.push({segment,name:part.name,rows,boundaries:output.screens.length,calls:output.rng.length,
            frames:output.frames.flat().length,hashes,plainHashes,observerNeutral:true});
        console.log(JSON.stringify({segment,name:part.name,boundaries:output.screens.length,
            calls:output.rng.length,rows:rows.map(r=>[r.step,r.key,r.top,r.pickup_types])}));
    }
} finally {
    if(saved)Object.defineProperty(globalThis,'__step_snapshot',saved);
    else delete globalThis.__step_snapshot;
    writeFileSync(receipt,JSON.stringify(results,null,2)+'\n');
}
const checks=[];
function check(name,fn) {
    try {fn();checks.push({name,pass:true});}
    catch(error){checks.push({name,pass:false,error:error.message});}
}
const find=name=>results.find(r=>r.name===name);
const row=(name,step)=>find(name).rows[step];
for(const part of source.segments) check(part.name+' consumes every ordinary key',()=>{
    const r=find(part.name);assert.equal(r.boundaries,Array.from(part.moves).length+1);
    assert.deepEqual(r.rows.map(s=>s.key),[null,...Array.from(part.moves)]);
});
check('pickup Escape restores the configured restriction',()=>{
    assert.equal(row('pickup-cancel',0).pickup_types,'$');
    assert.equal(row('pickup-cancel',15).top,'Autopickup what?');
    assert.equal(row('pickup-cancel',16).pickup_types,'$');
    assert.equal(row('pickup-cancel',18).top,'Autopickup: ON, for $ objects.');
});
check('wield Escape returns to normal inventory command',()=>{
    assert.match(row('wield-cancel',1).top,/What do you want to wield/);
    assert.match(row('wield-cancel',2).text,/quarterstaff/);
    assert.equal(row('wield-cancel',4).top,'Weapons');
    assert.equal(row('wield-cancel',5).weapon,row('wield-cancel',0).weapon);
});
check('adjust Escape finishes without moving the object',()=>{
    assert.equal(row('adjust-cancel',10).top,'Inventory letters used:');
    assert.equal(row('adjust-cancel',11).top,'Never mind.');
    assert.equal(row('adjust-cancel',12).top,'Weapons');
    assert.deepEqual(row('adjust-cancel',13).inventory,row('adjust-cancel',0).inventory);
});
check('Ranger split is real, omitted from destination list, then merged on Escape',()=>{
    const initial=row('split-cancel',0).inventory;
    assert.ok(initial.find(o=>o.invlet==='c').quan>1);
    assert.equal(row('split-cancel',10).inventory.filter(o=>o.invlet==='c').length,2);
    assert.equal(row('split-cancel',11).top,'Inventory letters used:');
    assert.doesNotMatch(row('split-cancel',11).text,/\bc - /);
    assert.equal(row('split-cancel',12).top,'Never mind.');
    assert.deepEqual(row('split-cancel',12).inventory,initial);
    assert.equal(row('split-cancel',13).top,'Weapons');
});
check('explicit clear intentionally removes pickup restriction',()=>{
    assert.equal(row('pickup-clear',15).top,'Autopickup what?');
    assert.equal(row('pickup-clear',17).pickup_types,'');
    assert.equal(row('pickup-clear',19).top,'Autopickup: ON, for all objects.');
});
check('empty wield menu retries before explicit prompt cancellation',()=>{
    assert.match(row('wield-empty',3).top,/What do you want to wield/);
    assert.equal(row('wield-empty',5).top,'Weapons');
    assert.equal(row('wield-empty',6).weapon,row('wield-empty',0).weapon);
});
check('empty adjust menu retries before explicit prompt cancellation',()=>{
    assert.match(row('adjust-empty',11).top,/Adjust letter to what/);
    assert.equal(row('adjust-empty',12).top,'Never mind.');
    assert.deepEqual(row('adjust-empty',14).inventory,row('adjust-empty',0).inventory);
});
check('accepted used letter still swaps both inventory slots',()=>{
    assert.match(row('adjust-select',11).top,/Swapping: b -/);
    for(const slot of ['a','b']) {
        const old=row('adjust-select',0).inventory.find(o=>o.invlet===slot);
        assert.equal(row('adjust-select',11).inventory.find(o=>o.id===old.id).invlet,slot==='a'?'b':'a');
    }
});
check('inventory action caller treats both no selection and Escape as no action',()=>{
    assert.equal(row('inventory-cancel',1).top,'Weapons');
    assert.equal(row('inventory-cancel',2).top,'');
    assert.deepEqual(row('inventory-cancel',2).inventory,row('inventory-cancel',0).inventory);
});
check('traditional drop category inspection honors inventory Escape',()=>{
    assert.match(row('drop-category-cancel',1).top,/What kinds of thing do you want to drop/);
    assert.equal(row('drop-category-cancel',3).top,'Weapons');
    assert.equal(row('drop-category-cancel',5).top,'Weapons');
    assert.deepEqual(row('drop-category-cancel',6).inventory,row('drop-category-cancel',0).inventory);
});
writeFileSync(receipt,JSON.stringify({results,checks},null,2)+'\n');
console.log(JSON.stringify({checks:checks.length,passed:checks.filter(c=>c.pass).length,failures:checks.filter(c=>!c.pass)}));
if(checks.some(c=>!c.pass))process.exitCode=1;
