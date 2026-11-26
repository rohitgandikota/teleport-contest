// Constructed macro boundaries and a guarded public caller, not ordinary reach.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {ismnum,LOW_PM,NON_PM} from '../js/const.js';
import {mons,NUMMONS,PMNAMES,LIMITS} from '../js/monst_data.js';
import {obj_pmname} from '../js/do_name.js';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {ONAMES} from '../js/objects_data.js';
import {hash} from './half-damage-reader-observe.mjs';

assert.ok(process.argv.length<=3&&!process.argv[2]?.startsWith('--'));
const lock=JSON.parse(readFileSync(new URL('./gen-sessions/evidence/ismnum-upper-bound/boundary-lock.json',import.meta.url)));
const recipe=JSON.parse(readFileSync(new URL('./gen-sessions/recipes/corpse-impact-owner.json',import.meta.url)));
const results=[];
function check(name,kind,body){
    const row={name,kind};
    try{body();row.pass=true;}catch(error){row.pass=false;row.error=error.message.slice(0,400);}
    results.push(row);
}
const special={negativeZero:-0,NaN:NaN,Infinity:Infinity,negativeInfinity:-Infinity,undefined:undefined};
for(const row of lock.boundaries){
    const value=Object.hasOwn(row,'special')?special[row.special]:row.value;
    check(row.name,row.kind,()=>assert.equal(ismnum(value),row.expected));
}
check('enum and addressable sentinel','table contract',()=>{
    assert.equal(LOW_PM,0);assert.equal(NON_PM,-1);
    assert.equal(NUMMONS,383);assert.equal(PMNAMES.NUMMONS,NUMMONS);assert.equal(LIMITS.NUMMONS,NUMMONS);
    assert.equal(PMNAMES.HIGH_PM,382);assert.equal(PMNAMES.SPECIAL_PM,330);
    assert.equal(mons.length,384);assert.ok(mons[NUMMONS]);
    assert.ok(!mons[NUMMONS].pmnames.some(name=>name));
    // No assertion that the generated sentinel's other fields match C.
});
check('all 383 real species remain valid','macro contract',()=>{
    for(let index=0;index<383;index++){
        assert.equal(mons[index].pmidx,index);
        assert.equal(ismnum(index),true,`species ${index}`);
    }
});

const timer=setTimeout(()=>{console.error('20s constructed caller bound');process.exit(2);},20000);
const run=await runSegment({...recipe.segments[1],storage:new InMemoryStorage()});
const corpse=game.invent.find(obj=>obj.o_id===141);
check('keyboard-produced wielded corpse','producer',()=>{
    assert.equal(corpse?.otyp,ONAMES.CORPSE);assert.equal(corpse?.corpsenm,PMNAMES.PM_COCKATRICE);
    assert.equal(game.u.uwep,corpse);assert.equal(game.u.uarmg?.o_id,139);
});
const original=corpse?.corpsenm;
for(const row of lock.caller){
    check(row.name,'constructed obj_pmname return contract',()=>{
        const before=run.getRngLog().length;
        try{
            corpse.corpsenm=row.species;
            assert.equal(obj_pmname(corpse),row.expected);
        }finally{corpse.corpsenm=original;}
        assert.equal(run.getRngLog().length,before,'name lookup must not consume RNG');
    });
}
clearTimeout(timer);
const report={classification:'constructed integer/type boundaries; constructed species field on a real wished corpse',
    nativeParityClaimed:false,ordinaryInvalidSpeciesClaimed:false,
    total:results.length,passed:results.filter(row=>row.pass).length,results};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:report.total,passed:report.passed,
    failed:results.filter(row=>!row.pass).map(({name,error})=>({name,error})),hash:hash(results)}));
if(report.passed!==report.total)process.exitCode=1;
