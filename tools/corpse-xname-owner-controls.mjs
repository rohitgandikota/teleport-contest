// Constructed source contracts on objects made by actual keyboard wishes.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game as g} from '../js/gstate.js'; // live binding across runSegment reset
import {ONAMES} from '../js/objects_data.js';
import {PMNAMES as PM} from '../js/monst_data.js';
import {corpse_xname,
    CXN_NORMAL as NORMAL,CXN_ARTICLE as ARTICLE,CXN_SINGULAR as SINGULAR,
    CXN_NO_PFX as NO_PFX,CXN_PFX_THE as THE,CXN_NOCORPSE as NOCORPSE} from '../js/objnam.js';
import {NON_PM,CORPSTAT_RANDOM,CORPSTAT_MALE,CORPSTAT_FEMALE,CORPSTAT_NEUTER} from '../js/const.js';
import {hash} from './half-damage-reader-observe.mjs';
assert.ok(process.argv.length<=3&&!process.argv[2]?.startsWith('--'));
const setup=JSON.parse(readFileSync(new URL('gen-sessions/evidence/corpse-xname-owner/source-setup.json',import.meta.url)));
const run=await runSegment({...setup.segments[0],storage:new InMemoryStorage()});
const corpse=g.invent.find(o=>o.otyp===ONAMES.CORPSE),glob=g.invent.find(o=>o.otyp===ONAMES.GLOB_OF_GRAY_OOZE);
assert.equal(corpse,g.u.uwep);assert.equal(corpse.corpsenm,PM.PM_COCKATRICE);
assert.ok(glob.globby);assert.equal(glob.quan,1);assert.equal(glob.owt,20);
const results=[];
function check(name,obj,fields,adjective,flags,expected,owner=corpse_xname){
    const saved=structuredClone(obj),rng=hash(run.getRngLog());
    Object.assign(obj,fields);
    const before=structuredClone(obj),typeBefore=structuredClone(g.objects[obj.otyp]);
    const row={name,expected};
    try{
        row.actual=owner(obj,adjective,flags);
        assert.deepEqual(obj,before,'naming preserves the produced object');
        assert.deepEqual(g.objects[obj.otyp],typeBefore,'naming restores type discovery');
        assert.equal(hash(run.getRngLog()),rng,'naming consumes no RNG');
        assert.equal(row.actual,expected);row.pass=true;
    }catch(e){row.pass=false;row.error=e.message.slice(0,400);}
    finally{for(const key of Object.keys(obj))if(!Object.hasOwn(saved,key))delete obj[key];Object.assign(obj,saved);}
    results.push(row);
}
// include/hack.h:59-66; src/objnam.c:1824-1920. Quantity and flags are independent.
for(const [name,fields,adj,flags,expected] of [
    ['ordinary singular',{},null,NORMAL,'cockatrice corpse'],
    ['singular indefinite',{},null,ARTICLE,'a cockatrice corpse'],
    ['unknown plural indefinite',{quan:2,dknown:0},null,ARTICLE,'cockatrice corpses'],
    ['known plural indefinite',{quan:2,dknown:1},null,ARTICLE,'cockatrice corpses'],
    ['plural definite',{quan:2},null,THE,'the cockatrice corpses'],
    ['singular override',{quan:2},null,ARTICLE|SINGULAR,'a cockatrice corpse'],
    ['no-prefix wins over both',{},null,NO_PFX|THE|ARTICLE,'cockatrice corpse'],
    ['definite wins over indefinite',{},null,THE|ARTICLE,'the cockatrice corpse'],
    ['omit suffix preserves article even for plural',{quan:2},null,NOCORPSE|ARTICLE,'a cockatrice'],
    ['quantity zero is not plural',{quan:0},null,ARTICLE,'a cockatrice corpse'],
    ['numeric adjective',{},'2 ',ARTICLE,'2 cockatrice corpse'],
    ['raw leading space is not digit',{},' 2 ',ARTICLE,'a 2 cockatrice corpse'],
    ['raw leading tab is not digit',{},'\t2 ',ARTICLE,'a 2 cockatrice corpse'],
    ['collapse all adjective spaces',{},' partly\t  eaten ',ARTICLE,'a partly eaten cockatrice corpse'],
    ['spaces-only adjective',{},'   ',ARTICLE,'a cockatrice corpse'],
    ['empty adjective',{},'',ARTICLE,'a cockatrice corpse'],
    ['newline truncates assembled name',{},'old\nignored',ARTICLE,'an old corpse'],
    ['proper possessive ignores prefixes',{corpsenm:PM.PM_MEDUSA},null,THE|ARTICLE,"Medusa's corpse"],
    ['proper adjective follows possessive',{corpsenm:PM.PM_MEDUSA},' partly\t eaten ',ARTICLE,"Medusa's partly eaten corpse"],
    ['unique gets definite',{corpsenm:PM.PM_ORACLE},null,ARTICLE,"the Oracle's corpse"],
    ['unique explicit no-prefix',{corpsenm:PM.PM_ORACLE},null,NO_PFX|ARTICLE,"Oracle's corpse"],
    ['unique plural',{corpsenm:PM.PM_ORACLE,quan:2},null,ARTICLE,"the Oracle's corpses"],
    ['Wizard unique',{corpsenm:PM.PM_WIZARD_OF_YENDOR},null,ARTICLE,"the Wizard of Yendor's corpse"],
    ['high cleric is not article-unique',{corpsenm:PM.PM_HIGH_CLERIC,spe:CORPSTAT_RANDOM},null,ARTICLE,'a high cleric corpse'],
    ['aligned cleric random uses role name',{corpsenm:PM.PM_ALIGNED_CLERIC,spe:CORPSTAT_RANDOM},null,ARTICLE,'a cleric corpse'],
    ['aligned cleric male',{corpsenm:PM.PM_ALIGNED_CLERIC,spe:CORPSTAT_MALE},null,ARTICLE,'a priest corpse'],
    ['aligned cleric female',{corpsenm:PM.PM_ALIGNED_CLERIC,spe:CORPSTAT_FEMALE},null,ARTICLE,'a priestess corpse'],
    ['explicit neuter keeps aligned name',{corpsenm:PM.PM_ALIGNED_CLERIC,spe:CORPSTAT_NEUTER},null,ARTICLE,'an aligned cleric corpse'],
    ['gender mask ignores historic bit',{corpsenm:PM.PM_ALIGNED_CLERIC,spe:4|CORPSTAT_FEMALE},null,ARTICLE,'a priestess corpse'],
    ['NON_PM paranoia',{corpsenm:NON_PM},null,ARTICLE,'a thing corpse'],
    ['NON_PM plural',{corpsenm:NON_PM,quan:2},null,ARTICLE,'thing corpses'],
    ['CORPSE type excludes glob branch',{globby:1},null,ARTICLE,'a cockatrice corpse'],
])check(name,corpse,fields,adj,flags,expected);
// Actual wished glob, with constructed contradictory fields to test branch precedence.
for(const [name,fields,adj,flags,expected] of [
    ['glob actual producer',{},null,NORMAL,'glob of gray ooze'],
    ['glob indefinite',{},null,ARTICLE,'a glob of gray ooze'],
    ['glob definite',{},null,THE,'the glob of gray ooze'],
    ['glob has no corpse suffix',{},null,NOCORPSE|ARTICLE,'a glob of gray ooze'],
    ['glob ignores constructed quantity',{quan:2},null,ARTICLE,'a glob of gray ooze'],
    ['glob ignores corpse species',{corpsenm:PM.PM_MEDUSA},null,ARTICLE,'a glob of gray ooze'],
    ['glob adjective mungspaces',{},' large\t  partly eaten ',ARTICLE,'a large partly eaten glob of gray ooze'],
    ['glob numeric adjective',{},'2 ',ARTICLE,'2 glob of gray ooze'],
])check(name,glob,fields,adj,flags,expected);
const report={classification:'constructed source contracts on real keyboard objects; no native claim',total:results.length,passed:results.filter(r=>r.pass).length,results};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:report.total,passed:report.passed,failed:results.filter(r=>!r.pass).map(({name,actual,expected,error})=>({name,actual,expected,error}))}));
if(report.passed!==report.total)process.exitCode=1;
