// Complete xname branch contract; constructed controls, actual producers.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),mod=n=>import(new URL('js/'+n+'.js',root));
assert.ok(process.argv.length<=3&&!process.argv[2]?.startsWith('--'));
const {setup,seed,clearMessages,messages}=await import(new URL('tools/status-followup-test-setup.mjs',root));
const G=await mod('gstate'),N=await mod('objnam'),{ONAMES:O}=await mod('objects_data');
const {mksobj,place_object}=await mod('mkobj'),{addinv}=await mod('invent');
const {moverock}=await mod('hack'),{set_itimeout}=await mod('potion'),{getRngLog}=await mod('rng');
const reports=[],deadline=setTimeout(()=>{console.error('30 second bound');process.exit(2);},30000);
async function check(name,fn){const r={name};try{await setup();await fn(r);r.pass=true;}catch(e){r.pass=false;r.error=e.message;process.exitCode=1;}reports.push(r);console.log(r.pass?'PASS':'FAIL',name,r.error||'');}
for(const flag of [-1,0,1,2])for(const quantity of [1,2])await check(`numeric flag ${flag} quantity ${quantity}`,async r=>{
    const o=mksobj(O.BOULDER,false,false);o.quan=quantity;o.next_boulder=flag;seed(2);
    r.first=N.xname(o);r.second=N.xname(o);r.flag=o.next_boulder;
    assert.equal(r.first,(flag===1?'next ':'')+(quantity===1?'boulder':'boulders'));
    assert.equal(r.second,quantity===1?'boulder':'boulders');assert.equal(r.flag,flag===1?0:flag);assert.deepEqual(getRngLog(),[]);
});
await check('fresh producer has no next prefix',async r=>{
    const o=mksobj(O.BOULDER,false,false);assert.equal(o.next_boulder,0);r.name=N.xname(o);assert.equal(r.name,'boulder');
});
await check('named object suffix follows one-shot prefix',async r=>{
    const o=mksobj(O.BOULDER,false,false);o.oname='Pebble';o.next_boulder=1;seed(2);
    r.first=N.xname(o);r.second=N.xname(o);assert.equal(r.first,'next boulder named Pebble');assert.equal(r.second,'boulder named Pebble');assert.deepEqual(getRngLog(),[]);
});
await check('blind unseen object still consumes next flag',async r=>{
    const o=mksobj(O.BOULDER,false,false);o.oname='Pebble';o.dknown=0;o.next_boulder=1;set_itimeout('HBlinded',20);seed(2);
    r.first=N.xname(o);assert.equal(r.first,'next boulder');assert.equal(o.next_boulder,0);assert.equal(o.dknown,0);assert.deepEqual(getRngLog(),[]);
});
await check('distant naming preserves observation but consumes flag',async r=>{
    const o=mksobj(O.BOULDER,false,false);place_object(o,60,10);o.dknown=0;o.next_boulder=1;seed(2);
    r.first=N.distant_name(o,N.xname);assert.equal(r.first,'next boulder');assert.equal(o.next_boulder,0);assert.equal(o.dknown,0);assert.deepEqual(getRngLog(),[]);
});
await check('singular flag preserves quantity and consumes next',async r=>{
    const o=mksobj(O.BOULDER,false,false);o.quan=3;o.next_boulder=1;seed(2);
    r.first=N.cxname_singular(o);assert.equal(r.first,'next boulder');assert.equal(o.quan,3);assert.equal(o.next_boulder,0);assert.equal(N.xname(o),'boulders');assert.deepEqual(getRngLog(),[]);
});
await check('Tobjnam consumes once before verb agreement',async r=>{
    const o=mksobj(O.BOULDER,false,false);o.next_boulder=1;seed(2);
    r.first=N.Tobjnam(o,'roll');assert.equal(r.first,'The next boulder rolls');assert.equal(o.next_boulder,0);assert.equal(N.Tobjnam(o,'roll'),'The boulder rolls');assert.deepEqual(getRngLog(),[]);
});
await check('minimal name preserves original flag',async r=>{
    const o=mksobj(O.BOULDER,false,false);o.next_boulder=1;seed(2);
    r.first=N.minimal_xname(o);assert.equal(r.first,'boulder');assert.equal(o.next_boulder,1);assert.equal(N.xname(o),'next boulder');assert.equal(o.next_boulder,0);assert.deepEqual(getRngLog(),[]);
});
await check('non-boulder numerical flag negative',async r=>{
    const o=mksobj(O.ROCK,false,false);o.quan=1;o.next_boulder=1;seed(2);
    r.first=N.xname(o);assert.equal(r.first,'rock');assert.equal(o.next_boulder,1);assert.deepEqual(getRngLog(),[]);
});
await check('actual pile producer names second boulder once then cleans up',async r=>{
    const g=G.game;g.u.dx=1;g.u.dy=0;addinv(mksobj(O.PLATE_MAIL,false,false));
    const a=mksobj(O.BOULDER,false,false),b=mksobj(O.BOULDER,false,false);place_object(a,32,10);place_object(b,32,10);
    clearMessages();seed(2);r.result=await moverock();r.text=messages();
    assert.equal(r.result,-1);assert.equal(a.ox,32);assert.equal(b.ox,33);
    assert.equal((r.text.match(/next boulder/g)||[]).length,1);assert.equal(a.next_boulder,0);assert.equal(b.next_boulder,0);
    assert.equal(N.xname(a),'boulder');assert.equal(N.xname(b),'boulder');
});
clearTimeout(deadline);assert.equal(reports.length,17);
const report={evidence:'C-source constructed xname contract, including actual moverock producer; no native claim',passed:reports.filter(r=>r.pass).length,total:reports.length,reports};
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,total:report.total}));
