// Locked keyboard producers, no constructed runtime state.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {ONAMES} from '../js/objects_data.js';
import {PMNAMES} from '../js/monst_data.js';
import {decodeScreen,renderCell} from '../frozen/screen-decode.mjs';
import {hash,hashes,outputs,deferred} from './half-damage-reader-observe.mjs';
assert.ok(process.argv.length<=3&&!process.argv[2]?.startsWith('--'));
const recipe=JSON.parse(readFileSync(new URL('./gen-sessions/recipes/corpse-impact-owner.json',import.meta.url)));
const fields=s=>['name','seed','datetime','nethackrc','moves'].map(field=>({field,present:Object.hasOwn(s,field),value:s[field]}));
assert.equal(hash(recipe.segments.map(fields)),'998c1a60245582ad7450fbc72bc8a8555190ee093fe7e20c8140401ed26ec74d');
assert.equal(hash(recipe.branchRequirements),'d76479cd807d593541ea559bca45735917183fe8d867b52c2e9dbf9c582cefcd');
assert.equal(hash(recipe.unchangedOutputHashes),'b4e55eea2408ea7740913b5b777be65b47f23a8d995f82440b7e1fc4adad83eb');
const results=[],timer=setTimeout(()=>{console.error('55s ordinary bound');process.exit(2);},55000);
for(const [i,part] of recipe.segments.entries()){
    const req=recipe.branchRequirements[i],r={name:part.name,inputSHA256:hash(fields(part))},states=[];
    const prior=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');
    try{
        let output;
        try{
            globalThis.__step_snapshot={step:'*',cb(g,step){
                if(!g.u||!g.level)return;
                const keeper=g.level.monsters.find(m=>m.m_id===97);
                const obj=g.level.objects.find(o=>o.otyp===ONAMES.STATUE&&o.oextra?.omonst?.m_id===97);
                const inventory=g.invent.find(o=>o.o_id===141);
                states.push({step,turn:g.moves,hp:g.u.uhp,mortality:g.u.umortality||0,xy:[g.u.ux,g.u.uy],
                    keeper:keeper?{id:keeper.m_id,hp:keeper.mhp,peaceful:!!keeper.mpeaceful,
                        mapped:g.level.monAt.get(`${keeper.mx},${keeper.my}`)===keeper,
                        resident:g.level.rooms[keeper.eshk.shoproom-3]?.resident===keeper,
                        items:(keeper.minvent||[]).map(o=>o.o_id).sort((a,b)=>a-b)}:null,
                    statue:obj?{id:obj.o_id,species:obj.corpsenm,savedID:obj.oextra.omonst.m_id,
                        savedHP:obj.oextra.omonst.mhp,items:obj.cobj.map(o=>o.o_id).sort((a,b)=>a-b)}:null,
                    weapon:g.u.uwep?.o_id,gloves:g.u.uarmg?.o_id,
                    corpse:inventory?{id:inventory.o_id,type:inventory.otyp,species:inventory.corpsenm,quantity:inventory.quan}:null});
            }};
            output=outputs(await runSegment({...part,storage:new InMemoryStorage()}));
        }finally{if(prior)Object.defineProperty(globalThis,'__step_snapshot',prior);else delete globalThis.__step_snapshot;}
        assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),prior);
        Object.assign(r,{hashes:hashes(output),boundaries:output.screens.length,calls:output.calls.length,
            frames:output.frames.flat().length,stateSHA256:hash(states)});
        assert.deepEqual(output,outputs(await runSegment({...part,storage:new InMemoryStorage()})),'all-five observer neutrality');r.observerNeutral=true;
        assert.deepEqual(output,await deferred(part),'all-five deferred input and held EOF');r.deferredNeutral=true;
        assert.equal(output.screens.length,part.moves.length+1);assert.deepEqual(output.slices.flat(),output.calls);
        assert.equal(req.name,part.name);assert.ok(states.every(s=>s.hp>=req.minimumHP&&!s.mortality),'survival at every boundary');
        assert.ok(states.some(s=>s.keeper?.resident&&s.keeper.hp===46&&s.keeper.peaceful),'real generated living keeper');
        const last=states.at(-1);r.final=last;
        if(i>0)assert.deepEqual(r.hashes,recipe.unchangedOutputHashes[part.name],'all-five locked negative hashes');
        if(req.branch==='petrifying-corpse-contact'){
            assert.ok(states.some(s=>s.weapon===141&&s.gloves===139&&s.corpse?.species===PMNAMES.PM_COCKATRICE&&s.keeper?.hp===46));
            assert.ok(!last.keeper||last.keeper.hp===0,'original keeper died');
            assert.ok(last.statue,'saved statue belongs to original keeper');
            assert.equal(last.statue.savedID,97);assert.equal(last.statue.savedHP,0);
            assert.deepEqual(last.statue.items,[99,101,103,105]);assert.equal(last.weapon,141);assert.equal(last.corpse.quantity,1);
            const tops=output.screens.map(s=>decodeScreen(s)[0].map(renderCell).join(''));
            assert.ok(tops.some(s=>s.includes('You hit Inuvik with the cockatrice corpse.')));
            assert.ok(tops.some(s=>s.includes('Inuvik turns to stone.')));
        }else if(req.branch==='corpse-held-no-impact'){
            assert.equal(last.keeper.hp,46);assert.ok(last.keeper.peaceful&&last.keeper.mapped&&last.keeper.resident);
            assert.equal(last.statue,null);assert.equal(last.weapon,141);assert.equal(last.corpse.species,PMNAMES.PM_COCKATRICE);
        }else if(req.branch==='nonpetrifying-corpse-contact'){
            assert.equal(last.keeper.hp,45);assert.equal(last.keeper.peaceful,false);assert.ok(last.keeper.mapped);
            assert.equal(last.statue,null);assert.equal(last.weapon,141);assert.equal(last.corpse.species,PMNAMES.PM_NEWT);
        }else{
            assert.equal(req.branch,'thrown-corpse-no-melee');assert.equal(last.keeper.hp,46);assert.ok(last.keeper.peaceful);
            assert.equal(last.statue,null);assert.equal(last.weapon,undefined);assert.equal(last.corpse,null);
        }
        r.pass=true;
    }catch(e){r.pass=false;r.error=e.message.slice(0,500);}
    results.push(r);
}
clearTimeout(timer);
const report={classification:'ordinary keyboard corpse impact with fixed negative outputs',nativeParityClaimed:false,
    total:results.length,passed:results.filter(r=>r.pass).length,results};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:report.total,passed:report.passed,failed:results.filter(r=>!r.pass).map(r=>({name:r.name,error:r.error})),hash:hash(results)}));
if(report.passed!==report.total)process.exitCode=1;
