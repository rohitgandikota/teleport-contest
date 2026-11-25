// Constructed naming boundaries use real producers, helpers, objects and RNG.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {test as nodeTest} from 'node:test';
import {setImmediate} from 'node:timers/promises';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {the,The,fruit_from_name,xname,Tobjnam,thesimpleoname,
    singular,makesingular,makeplural} from '../js/objnam.js';
import {artifact_name} from '../js/artifact.js';
import {lookup_novel} from '../js/do_name.js';
import {set_fruit_name,fruitadd} from '../js/options.js';
import {mksobj} from '../js/mkobj.js';
import {getRngLog} from '../js/rng.js';
import {ONAMES as O} from '../js/objects_data.js';
import {BUFSZ} from '../js/const.js';

const rc='OPTIONS=name:Article,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
 +'OPTIONS=!autopickup,!legacy,!tutorial,!tips,pettype:none,pauper,nudist,!safe_wait,debug_mongen\nOPTIONS=symset:plain\n';
const results=[];
const deadline=setTimeout(()=>{console.error('55 second article state limit');process.exit(1);},55000);deadline.unref();
async function test(name,fn){await nodeTest(name,async()=>{
 try{await fn();results.push({name,pass:true});}
 catch(e){results.push({name,pass:false,error:e.message.slice(0,1200)});throw e;}
});}
async function boot(){return runSegment({seed:19001,datetime:'20000112093000',nethackrc:rc,moves:' ',storage:new InMemoryStorage()});}

for(const [input,expected] of [
 ['sword','the sword'],['Excalibur','Excalibur'],['THE Sword','tHE Sword'],
 ['the Sword','the Sword'],['The Sword','the Sword'],['Norn','the Norn'],
 ["Norn's corpse","the Norn's corpse"],["Medusa's corpse","Medusa's corpse"],
 ['Luggage','the Luggage'],['Luggageish','Luggageish'],['Mordor orc','the Mordor orc'],
 ['Book of Power','the Book of Power'],['Book OF Power','the Book OF Power'],
 ['Book oF Power','the Book oF Power'],
 ['Robe NAMED Staff of Power','Robe NAMED Staff of Power'],
 ['Robe CALLED Staff of Power','Robe CALLED Staff of Power'],
 ['Robe of Power NAMED Glory','the Robe of Power NAMED Glory'],
 ['Robe CALLED Glory named Staff of Power','Robe CALLED Glory named Staff of Power'],
 ['Book named lowercase','the Book named lowercase'],
 ['Platinum Yendorian Express Card','the Platinum Yendorian Express Card'],
 ['Fake Platinum Yendorian Express Card','the Fake Platinum Yendorian Express Card'],
 ['Robe named Platinum Yendorian Express Card','Robe named Platinum Yendorian Express Card'],
 ['Platinum Yendorian Express CARD','Platinum Yendorian Express CARD'],
 ['Long Sword-blade','Long Sword-blade'],['Sword-blade','the Sword-blade'],
 ['Wizard ','the Wizard '],['Wizard-','the Wizard-'],["Wizard's ","Wizard's "]
]){
 await test(`article decision: ${JSON.stringify(input)}`,async()=>{
  await boot();const rng=[...getRngLog()];assert.equal(the(input),expected);
  assert.equal(The(input),expected[0].toUpperCase()+expected.slice(1));
  assert.equal(the(expected),expected);assert.deepEqual(getRngLog(),rng);
 });
}

await test('actual option producer changes a capitalized fruit from proper to common',async()=>{
 await boot();assert.equal(the('Zelda'),'Zelda');set_fruit_name('Zelda');
 const node=fruit_from_name('Zelda',true,null),rng=[...getRngLog()];assert.ok(node);assert.equal(node.fname,'Zelda');
 assert.equal(the('Zelda'),'the Zelda');assert.equal(the('Zeldas'),'the Zeldas');
 assert.equal(fruit_from_name('Zelda',true,null),node);assert.deepEqual(getRngLog(),rng);
});
await test('actual option producer and object naming reach the shared article',async()=>{
 await boot();set_fruit_name('Ruby');const o=mksobj(O.SLIME_MOLD,true,false);
 assert.equal(o.spe,game.context.current_fruit);assert.equal(xname(o),'Ruby');
 assert.equal(Tobjnam(o,'fall'),'The Ruby falls');assert.equal(thesimpleoname(o),'the Ruby');
 o.quan=3;assert.equal(xname(o),'Rubies');assert.equal(Tobjnam(o,'fall'),'The Rubies fall');
 assert.equal(singular(o,xname),'Ruby');assert.equal(o.quan,3);
});
for(const name of ['Excalibur','Stormbringer','Cleaver']){
 await test(`registered fruit matching proper artifact: ${name}`,async()=>{
  await boot();set_fruit_name(name);assert.ok(fruit_from_name(name,true,null));
  assert.equal(artifact_name(name,null,false),name);assert.equal(the(name),name);
 });
}
await test('registered fruit matching an artifact with its own article',async()=>{
 await boot();set_fruit_name('Platinum Yendorian Express Card');
 assert.ok(fruit_from_name('Platinum Yendorian Express Card',true,null));
 assert.equal(artifact_name('Platinum Yendorian Express Card',null,false),'The Platinum Yendorian Express Card');
 assert.equal(the('Platinum Yendorian Express Card'),'the Platinum Yendorian Express Card');
});
await test('fruit and artifact matching use their distinct case rules',async()=>{
 await boot();set_fruit_name('EXCALIBUR');assert.ok(fruit_from_name('EXCALIBUR',true,null));
 assert.equal(fruit_from_name('Excalibur',true,null),null);
 assert.equal(artifact_name('EXCALIBUR',null,false),'Excalibur');assert.equal(the('EXCALIBUR'),'EXCALIBUR');
 assert.equal(the('excalibur'),'the excalibur');
});
await test('artifact lookup preserves optional output on failure and distinguishes fuzzy mode',async()=>{
 await boot();const out={v:-7};assert.equal(artifact_name('tHe EXCALIBUR',out,false),'Excalibur');assert.equal(out.v,O.LONG_SWORD);
 out.v=-7;assert.equal(artifact_name('Storm-bringer',out,false),null);assert.equal(out.v,-7);
 assert.equal(artifact_name('Storm-bringer',out,true),'Stormbringer');assert.ok(out.v>0);
});
await test('actual fruit list exact, longest prefix and singular fallback contracts',async()=>{
 await boot();fruitadd('Mango Golden',null);fruitadd('Mango',null);
 const long=fruit_from_name('Mango Golden',true,null),short=fruit_from_name('Mango',true,null);assert.ok(long&&short);assert.notEqual(long,short);
 assert.equal(fruit_from_name('Mango Golden sliced',false,null),long);
 assert.equal(fruit_from_name('Mango Golden sliced',true,null),null);
 assert.equal(fruit_from_name('Mangos',true,null),short);
 assert.equal(fruit_from_name('mango',true,null),null);
 const out={v:-1};assert.equal(fruit_from_name('Mango',true,out),short);assert.equal(out.v,0);
 assert.equal(fruit_from_name('No Such Fruit',true,out),null);assert.equal(out.v,short.fid);
});
await test('inflector suffix behavior is preserved by the real fruit producer',async()=>{
 await boot();assert.equal(makesingular('Alice'),'Alouse');assert.equal(makeplural('Ruby'),'Rubies');
 set_fruit_name('Alice');assert.equal(game.svp.pl_fruit,'Alouse');
 assert.ok(fruit_from_name('Alice',true,null));assert.equal(the('Alice'),'the Alice');
});
await test('novel caller recognizes uppercase OF through the shared article',async()=>{
 await boot();const idx={idx:-1};assert.equal(lookup_novel('Color OF Magic',idx),'The Colour of Magic');assert.equal(idx.idx,0);
});
await test('novel caller unchanged exact title and unresolved fallback',async()=>{
 await boot();assert.equal(lookup_novel('Sourcery',{idx:-1}),'Sourcery');
 assert.equal(lookup_novel('Unlisted Title',{idx:-1}),null);
 assert.equal(lookup_novel('Unlisted Title',{idx:0}),'The Colour of Magic');
});
for(const [name,input,expected] of [
 ['lowercase with added prefix','x'.repeat(255),'the '+'x'.repeat(251)],
 ['proper name without prefix','X'.repeat(255),'X'.repeat(255)],
 ['CapitalMon prefix',"Norn "+'X'.repeat(250),'the '+'Norn '+'X'.repeat(246)],
 ['already prefixed early return','The '+'X'.repeat(251),'the '+'X'.repeat(251)]
]){
 await test(`constructed BUFSZ boundary: ${name}`,async()=>{await boot();assert.equal(input.length,BUFSZ-1);assert.equal(the(input),expected);assert.equal(the(input).length,BUFSZ-1);});
}
for(const input of [null,'']){
 await test(`constructed invalid subject diagnostic: ${JSON.stringify(input)}`,async()=>{
  const run=await boot(),seen=[];let reads=0;
  run._display.onEmptyQueue=async()=>{await setImmediate();assert.ok(reads++<32);seen.push(game._pending_message,game._toplines);return 32;};
  const rng=[...getRngLog()];assert.equal(the(input),'the []');
  const message=`Alphabet soup: 'the(${input===null?'<null>':'""'})'.`;
  assert.ok(game.impossible_log?.includes(message));
  for(let i=0;i<32&&game.program_state.in_impossible;i++)await setImmediate();
  assert.equal(game.program_state.in_impossible,0);assert.ok(seen.some(s=>s?.includes('Program in disorder!')));
  assert.deepEqual(getRngLog(),rng);
 });
}
clearTimeout(deadline);
const report={total:results.length,passed:results.filter(r=>r.pass).length,results};
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:report.total,passed:report.passed}));
