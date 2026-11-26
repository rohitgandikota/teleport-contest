// Locked keyboard inputs. No constructed runtime state or native-parity claim.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {runSegment} from '../../js/jsmain.js';
import {InMemoryStorage} from '../../js/storage.js';
import {ONAMES} from '../../js/objects_data.js';
import {PMNAMES} from '../../js/monst_data.js';
import {hash,hashes,outputs,deferred} from '../half-damage-reader-observe.mjs';
assert.ok(process.argv.length<=3&&!process.argv[2]?.startsWith('--'));
const recipe=JSON.parse(readFileSync(new URL('../gen-sessions/recipes/saved-monster-traits-owner.json',import.meta.url)));
const fields=s=>['name','seed','datetime','nethackrc','moves'].map(field=>({field,present:Object.hasOwn(s,field),value:s[field]}));
assert.equal(hash(recipe.segments.map(fields)),'41d53500476c05c4f76cd40ccb3fbe690d5343a76ae2786a58c138079ab31463');
assert.equal(hash(recipe.branchRequirements),'4e238072efbf61215ac06bd287e9610d1d72e4f3e5e16db624bb320c45f6d7c1');
assert.equal(hash(recipe.unchangedOutputHashes),'e126e5195b29a6f1f021171bd8781d1294cbae6aa40bf79ad929d68973d23065');
const results=[],timer=setTimeout(()=>{console.error('55s ordinary bound');process.exit(2);},55000);
for(const [i,part] of recipe.segments.entries()){
    const req=recipe.branchRequirements[i],r={name:part.name,inputSHA256:hash(fields(part))},states=[];
    const prior=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');
    try{
        let output;
        try{
            globalThis.__step_snapshot={step:'*',cb(g,step){
                if(!g.u||!g.level)return;
                const mon=m=>({id:m.m_id,species:m.mnum,hp:m.mhp,peaceful:!!m.mpeaceful,
                    revived:!!m.mrevived,shk:!!m.isshk,xy:[m.mx,m.my],
                    resident:m.isshk?g.level.rooms[m.eshk.shoproom-3]?.resident===m:false,
                    billct:m.eshk?.billct,activeBill:m.eshk?m.eshk.bill_p===m.eshk.bill:false});
                states.push({step,turn:g.moves,hp:g.u.uhp,mortality:g.u.umortality||0,xy:[g.u.ux,g.u.uy],shops:g.u.ushops,
                    mons:g.level.monsters.filter(m=>m.isshk||m.mrevived).map(mon),
                    corpses:[...g.level.objects,...g.invent].filter(o=>o.otyp===ONAMES.CORPSE)
                        .map(o=>({id:o.o_id,species:o.corpsenm,saved:!!o.oextra?.omonst,
                            savedShk:!!o.oextra?.omonst?.isshk,where:o.where})),
                    stock:g.invent.filter(o=>o.o_id===114).map(o=>({id:o.o_id,unpaid:!!o.unpaid,quantity:o.quan}))});
            }};
            output=outputs(await runSegment({...part,storage:new InMemoryStorage()}));
        }finally{if(prior)Object.defineProperty(globalThis,'__step_snapshot',prior);else delete globalThis.__step_snapshot;}
        assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),prior);
        Object.assign(r,{hashes:hashes(output),boundaries:output.screens.length,calls:output.calls.length,
            frames:output.frames.flat().length,stateSHA256:hash(states)});
        assert.deepEqual(output,outputs(await runSegment({...part,storage:new InMemoryStorage()})),'all-five observer neutrality');r.observerNeutral=true;
        assert.deepEqual(output,await deferred(part),'all-five deferred delivery and held EOF');r.deferredNeutral=true;
        assert.equal(output.screens.length,part.moves.length+1);assert.deepEqual(output.slices.flat(),output.calls);
        assert.equal(req.name,part.name);assert.ok(states.every(s=>s.hp>=req.minimumHP&&!s.mortality),'survival at every boundary');
        const last=states.at(-1);r.final=last;
        if(req.branch!=='revived-resident-stock')assert.deepEqual(r.hashes,recipe.unchangedOutputHashes[part.name],'all-five fixed negative hashes');
        if(req.branch==='revived-resident-stock'){
            assert.ok(states.some(s=>s.mons.some(m=>m.id===97&&m.shk&&m.resident&&!m.revived)),'real generated resident');
            assert.ok(states.some(s=>s.corpses.some(o=>o.savedShk)&&!s.mons.some(m=>m.hp>0&&m.shk)),'real dead keeper with saved corpse');
            assert.ok(!last.corpses.some(o=>o.savedShk),'revival consumes saved keeper corpse');
            const keeper=last.mons.find(m=>m.shk&&m.revived);assert.ok(keeper&&keeper.hp>0&&keeper.peaceful);
            assert.ok(keeper.resident,'C replmon/replshk restores revived room resident');
            assert.equal(last.shops,'\n');assert.equal(keeper.billct,1);assert.ok(keeper.activeBill);
            assert.deepEqual(last.stock,[{id:114,unpaid:true,quantity:1}]);
        }else if(req.branch==='dead-resident-no-revival'){
            assert.ok(last.corpses.some(o=>o.savedShk));assert.ok(!last.mons.some(m=>m.hp>0&&m.shk));
            assert.equal(last.shops,'');assert.deepEqual(last.stock,[{id:114,unpaid:false,quantity:1}]);
        }else if(req.branch==='saved-cyclops-revival'){
            assert.ok(states.some(s=>s.corpses.some(o=>o.species===PMNAMES.PM_CYCLOPS&&o.saved&&!o.savedShk)));
            assert.ok(last.mons.some(m=>m.species===PMNAMES.PM_CYCLOPS&&m.revived&&m.peaceful&&m.hp>0));
            assert.ok(!last.corpses.some(o=>o.species===PMNAMES.PM_CYCLOPS));
        }else{
            assert.equal(req.branch,'unsaved-newt-revival');
            assert.ok(states.some(s=>s.corpses.some(o=>o.species===PMNAMES.PM_NEWT&&!o.saved)));
            assert.equal(last.mons.filter(m=>m.species===PMNAMES.PM_NEWT&&m.revived&&m.hp>0).length,2);
            assert.ok(!last.corpses.some(o=>o.species===PMNAMES.PM_NEWT));
        }
        r.pass=true;
    }catch(e){r.pass=false;r.error=e.message.slice(0,450);}
    results.push(r);
}
clearTimeout(timer);
const report={classification:'ordinary keyboard corpse producers and revival, no injected state',nativeParityClaimed:false,
    total:results.length,passed:results.filter(r=>r.pass).length,results};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:report.total,passed:report.passed,failed:results.filter(r=>!r.pass).map(r=>({name:r.name,error:r.error})),hash:hash(results)}));
if(report.passed!==report.total)process.exitCode=1;
