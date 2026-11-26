// Locked ordinary keyboard inputs. The observer only reads state.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {ONAMES} from '../js/objects_data.js';
import {PMNAMES} from '../js/monst_data.js';
import {Blind} from '../js/youprop.js';
import {decodeScreen,renderCell} from '../frozen/screen-decode.mjs';
import {hash,hashes,outputs,deferred} from './half-damage-reader-observe.mjs';
assert.ok(process.argv.length<=3&&!process.argv[2]?.startsWith('--'));
const recipeBytes=readFileSync(new URL('../../recipes/corpse-xname-owner.json',import.meta.url));
const recipe=JSON.parse(recipeBytes),lock=JSON.parse(readFileSync(new URL('../../input-lock.json',import.meta.url)));
const fields=s=>['name','seed','datetime','nethackrc','moves'].map(field=>({field,present:Object.hasOwn(s,field),value:s[field]}));
assert.equal(createHash('sha256').update(recipeBytes).digest('hex'),lock.recipeSHA256);
assert.equal(hash(recipe.segments.map(fields)),lock.inputFieldsSHA256);
assert.equal(hash(recipe.branchRequirements),lock.branchRequirementsSHA256);
assert.equal(hash(recipe.unchangedOutputHashes),lock.negativeHashesSHA256);
assert.equal(hash(recipe.branchAssertions),lock.branchAssertionsSHA256);
for(const [i,part] of recipe.segments.entries())assert.deepEqual([...Buffer.from(part.moves)],lock.segments[i].keys);
const results=[];
for(const [i,part] of recipe.segments.entries()){
    const req=recipe.branchRequirements[i],r={name:part.name,inputSHA256:hash(fields(part))},states=[];
    const prior=Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot');
    try{
        let output;
        try{
            globalThis.__step_snapshot={step:'*',cb(g,step){
                if(!g.u||!g.level)return;
                const corpse=g.invent.find(o=>o.o_id===req.weaponID);
                const keeper=g.level.monsters.find(m=>m.m_id===97);
                const statue=g.level.objects.find(o=>o.otyp===ONAMES.STATUE&&o.oextra?.omonst?.m_id===97);
                states.push({step,turn:g.moves,hp:g.u.uhp,mortality:g.u.umortality||0,xy:[g.u.ux,g.u.uy],blind:!!Blind(),
                    weapon:g.u.uwep?.o_id,gloves:g.u.uarmg?.o_id,blindfold:g.u.ublindf?.o_id??null,
                    corpse:corpse?{id:corpse.o_id,type:corpse.otyp,species:corpse.corpsenm,quantity:corpse.quan,known:!!corpse.dknown,weight:corpse.owt}:null,
                    keeper:keeper?{hp:keeper.mhp,peaceful:!!keeper.mpeaceful,mapped:g.level.monAt.get(`${keeper.mx},${keeper.my}`)===keeper,
                        resident:g.level.rooms[keeper.eshk.shoproom-3]?.resident===keeper}:null,
                    statue:statue?{id:statue.o_id,species:statue.corpsenm,savedID:statue.oextra.omonst.m_id,savedHP:statue.oextra.omonst.mhp,
                        items:statue.cobj.map(o=>o.o_id).sort((a,b)=>a-b)}:null});
            }};
            output=outputs(await runSegment({...part,storage:new InMemoryStorage()}));
        }finally{if(prior)Object.defineProperty(globalThis,'__step_snapshot',prior);else delete globalThis.__step_snapshot;}
        assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__step_snapshot'),prior);
        Object.assign(r,{hashes:hashes(output),boundaries:output.screens.length,calls:output.calls.length,
            frames:output.frames.flat().length,stateSHA256:hash(states)});
        assert.deepEqual(output,outputs(await runSegment({...part,storage:new InMemoryStorage()})),'all-five observer neutrality');r.observerNeutral=true;
        assert.deepEqual(output,await deferred(part),'all-five deferred delivery and held EOF');r.deferredNeutral=true;
        assert.equal(output.screens.length,part.moves.length+1);assert.deepEqual(output.slices.flat(),output.calls);
        assert.equal(req.name,part.name);assert.ok(states.every(s=>s.hp>=req.minimumHP&&!s.mortality),'survival throughout');
        assert.ok(states.some(s=>s.keeper?.resident&&s.keeper.hp===46&&s.keeper.peaceful),'generated living keeper');
        assert.ok(states.some(s=>s.weapon===req.weaponID&&s.gloves===req.glovesID&&s.blind===req.blind
            &&s.corpse?.type===ONAMES.CORPSE&&s.corpse.species===PMNAMES.PM_COCKATRICE&&s.corpse.quantity===req.quantity
            &&s.corpse.known===!req.blind&&s.keeper?.hp===46),'actual equipped corpse before any contact');
        const last=states.at(-1);r.final=last;
        assert.equal(last.hp,req.finalHP,'exact final health after actual levelchange producer');
        assert.equal(last.blind,req.blind);assert.equal(last.weapon,req.weaponID);assert.equal(last.gloves,139);
        assert.equal(last.blindfold,req.blindfoldID);assert.equal(last.corpse.type,ONAMES.CORPSE);
        assert.equal(last.corpse.species,PMNAMES.PM_COCKATRICE);assert.equal(last.corpse.quantity,req.quantity);
        assert.equal(last.corpse.weight,req.quantity*30);assert.equal(last.corpse.known,req.knownAfter);
        if(req.contact){
            assert.ok(!last.keeper||last.keeper.hp===0,'landed petrifying impact');
            assert.equal(last.statue.id,req.statueID);assert.equal(last.statue.species,PMNAMES.PM_SHOPKEEPER);
            assert.equal(last.statue.savedID,97);assert.equal(last.statue.savedHP,0);
            assert.deepEqual(last.statue.items,[99,101,103,105]);
        }else{
            assert.equal(last.statue,null);assert.equal(last.keeper.hp,46);
            assert.ok(last.keeper.peaceful&&last.keeper.mapped&&last.keeper.resident);
        }
        if(i>0)assert.deepEqual(r.hashes,recipe.unchangedOutputHashes[part.name],'all five locked negative streams');
        const rows=output.screens.map(s=>decodeScreen(s).map(row=>row.map(renderCell).join('').trimEnd()));
        assert.ok(rows.some(screen=>screen.slice(2).some(row=>row.trim()===req.inventoryText)),'ordinary inventory quantity/type and wielding');
        const text=rows.map(screen=>screen.join('\n')).join('\n');
        for(const wanted of recipe.branchAssertions[i].screenIncludes)assert.ok(text.includes(wanted),`C branch includes: ${wanted}`);
        for(const unwanted of recipe.branchAssertions[i].screenExcludes||[])assert.ok(!text.includes(unwanted),`C branch excludes: ${unwanted}`);
        r.pass=true;
    }catch(e){r.pass=false;r.error=e.message.slice(0,500);}
    results.push(r);
}
const report={classification:'ordinary keyboard plural corpse naming with locked negative outputs',nativeParityClaimed:false,
    total:results.length,passed:results.filter(r=>r.pass).length,results};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:report.total,passed:report.passed,failed:results.filter(r=>!r.pass).map(r=>({name:r.name,error:r.error})),hash:hash(results)}));
if(report.passed!==report.total)process.exitCode=1;
