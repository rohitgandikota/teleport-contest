// Constructed object flags are separate from the fourteen fixed ordinary inputs.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {test as nodeTest} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {set_fruit_name} from '../js/options.js';
import {mksobj} from '../js/mkobj.js';
import {xname,doname,the,fruit_from_name,obj_is_pname} from '../js/objnam.js';
import {artifact_name} from '../js/artifact.js';
import {CapitalMon} from '../js/rumors.js';
import {oname} from '../js/do_name.js';
import {fully_identify_obj} from '../js/invent.js';
import {getRngLog} from '../js/rng.js';
import {ONAMES as O} from '../js/objects_data.js';
import {ONAME_NO_FLAGS} from '../js/const.js';
const rc='OPTIONS=name:Fruit,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
    +'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist,!safe_wait,debug_mongen\nOPTIONS=symset:plain\n';
const deadline=setTimeout(()=>process.exit(1),55000);deadline.unref();
const results=[];
async function boot(){await runSegment({seed:19001,datetime:'20000112093000',nethackrc:rc,moves:' ',storage:new InMemoryStorage()});}
async function test(name,fn){await nodeTest(name,async()=>{
    try{await boot();await fn();results.push({name,pass:true});}
    catch(e){results.push({name,pass:false,error:e.message.slice(0,1100)});throw e;}
});}
function fruit(name,flags={}){
    set_fruit_name(name);const o=mksobj(O.SLIME_MOLD,true,false);
    Object.assign(o,flags);const node=fruit_from_name(game.svp.pl_fruit,true,null);
    assert.ok(node);assert.equal(node.fid,o.spe);assert.equal(o.oartifact||0,0);assert.ok(!o.oname);
    assert.equal(obj_is_pname(o),false);return o;
}
for(const [name,expected,canonical] of [
    ['Excalibur','Excalibur','Excalibur'],['Stormbringer','Stormbringer','Stormbringer'],
    ['Cleaver','Cleaver','Cleaver'],['EXCALIBUR','EXCALIBUR','Excalibur'],
    ['excalibur','excalibur','Excalibur'],['The Excalibur','Excalibur','Excalibur'],
    ['Orb of Fate','the Orb of Fate','The Orb of Fate'],
    ['The Orb of Fate','the Orb of Fate','The Orb of Fate'],
    ['Platinum Yendorian Express Card','the Platinum Yendorian Express Card','The Platinum Yendorian Express Card']
]){
    await test(`actual registered fruit artifact-name concession: ${name}`,()=>{
        const o=fruit(name),base=xname(o),rng=[...getRngLog()],type={v:-1};
        assert.equal(artifact_name(base,type,false),canonical);assert.ok(type.v!==O.SLIME_MOLD);
        assert.equal(CapitalMon(base),false);assert.equal(doname(o),expected);assert.deepEqual(getRngLog(),rng);
    });
}
await test('constructed partly-eaten proper-artifact fruit',()=>{
    const o=fruit('Excalibur',{oeaten:125});assert.equal(doname(o),'partly eaten Excalibur');
    assert.equal(the(xname(o)),'Excalibur');
});
await test('constructed known blessed and greased proper-artifact fruit',()=>{
    const o=fruit('Excalibur',{blessed:1,cursed:0,bknown:1,greased:1});assert.equal(doname(o),'blessed greased Excalibur');
});
await test('constructed quantity retains its precedence',()=>{
    const o=fruit('Excalibur',{quan:3});assert.equal(xname(o),'Excaliburs');
    assert.equal(artifact_name(xname(o),null,false),null);assert.equal(doname(o),'3 Excaliburs');
});
await test('constructed poison bit is stripped before fake-artifact lookup',()=>{
    const o=fruit('poisoned Excalibur',{opoisoned:1});assert.equal(xname(o),'poisoned Excalibur');
    assert.equal(doname(o),'Excalibur');
});
for(const [name,expected] of [['Zelda','a Zelda'],['mango','a mango'],['Storm-bringer','a Storm-bringer'],['poisoned Excalibur','a poisoned Excalibur']]){
    await test(`unaffected ordinary fruit name: ${name}`,()=>{
        const o=fruit(name);assert.equal(artifact_name(xname(o),null,false),null);assert.equal(doname(o),expected);
    });
}
await test('unaffected partly eaten ordinary fruit',()=>{
    const o=fruit('Zelda',{oeaten:125});assert.equal(doname(o),'a partly eaten Zelda');
});
await test('unaffected actual apple object',()=>{const o=mksobj(O.APPLE,false,false);assert.equal(doname(o),'an apple');});
await test('unaffected non-fruit with an artifact-like individual name',async()=>{
    const o=mksobj(O.DAGGER,false,false);await oname(o,'Excalibur',ONAME_NO_FLAGS);
    assert.equal(o.oartifact||0,0);assert.equal(doname(o),'a dagger named Excalibur');
});
await test('unaffected actual artifact with the real identification helper',async()=>{
    const o=mksobj(O.LONG_SWORD,false,false);await oname(o,'Excalibur',ONAME_NO_FLAGS);
    assert.ok(o.oartifact);fully_identify_obj(o);assert.equal(obj_is_pname(o),true);
    assert.equal(doname(o),'the +0 Excalibur');
});
clearTimeout(deadline);
const report={total:results.length,passed:results.filter(r=>r.pass).length,results};
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:report.total,passed:report.passed}));
