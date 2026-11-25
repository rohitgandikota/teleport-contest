import assert from 'node:assert/strict';
import {test, after} from 'node:test';
import {writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runSegment} from '../js/jsmain.js';
import {game} from '../js/gstate.js';
import {InMemoryStorage} from '../js/storage.js';
import {resetInputState} from '../js/input.js';
import {display_nhwindow_message} from '../js/display.js';
import {choose_classes_menu} from '../js/windows.js';
import {display_pickinv, display_inventory, doorganize, ggetobj, identify} from '../js/invent.js';
import {dowield} from '../js/wield.js';
import {drop} from '../js/do.js';
import {wiz_identify} from '../js/wizcmds.js';
import {doset_simple} from '../js/options.js';
import {tty_get_nhwindow} from '../js/tty/wintty.js';
import {ECMD_CANCEL, ECMD_OK} from '../js/const.js';

const observations = [], receipt = process.argv[2];
const boot = {seed:9770,datetime:'20000112093000',moves:'',nethackrc:
    'OPTIONS=name:wizard,role:Wizard,race:human,gender:male,align:neutral,playmode:debug\n'
    + 'OPTIONS=!autopickup,!legacy,!tutorial,!tips,!verbose,pettype:none\n'
    + 'OPTIONS=suppress_alert:3.4.3,symset:plain,menustyle:full,pickup_types:$\n'};
async function ready(role = 'Wizard') {
    const run = await runSegment({...boot,nethackrc:boot.nethackrc.replace('role:Wizard','role:'+role),
        storage:new InMemoryStorage()});
    resetInputState();
    run._display.onEmptyQueue = () => 32;
    await display_nhwindow_message();
    return run;
}
function inventory() {
    return game.invent.map(o=>({id:o.o_id,invlet:o.invlet,quan:o.quan,otyp:o.otyp,
        known:o.known,bknown:o.bknown,where:o.where,owornmask:o.owornmask}));
}
function observe() {
    return {top:game.nhDisplay.grid[0].map(c=>c.ch).join('').trim(),
        pickup_types:game.flags.pickup_types,weapon:game.u.uwep?.o_id,
        inventory:inventory(),active:tty_get_nhwindow(game.ttyDisplay?.lastwin)?.active};
}
function hashes(run) {
    return Object.fromEntries(Object.entries({screens:run.getScreens(),cursors:run.getCursors(),
        rng:run.getRngLog(),slices:run.getRngSlices(),frames:run.getAnimationFramesByStep()})
        .map(([k,v])=>[k,createHash('sha256').update(JSON.stringify(v)).digest('hex')]));
}
async function exercise(name, keys, owner, {role='Wizard',setup,observed=true}={}) {
    const run=await ready(role);
    if(setup)setup();
    const before=observe(),reads=[];
    let used=0;
    run._display.onEmptyQueue=()=>{
        assert.ok(used<keys.length+4,'bounded input: '+name);
        if(observed)reads.push(observe());
        return (keys[used++] || '\x1b').charCodeAt(0);
    };
    const result=await owner();
    const out={name,result,used,before,after:observe(),reads,hashes:hashes(run)};
    observations.push(out);
    return out;
}

for(const [name,initial,keys,count,selection] of [
    ['class-cancel','$','\x1b',-1,'$'],
    ['class-cancel-after-toggle','$','b\x1b',-1,'$'],
    ['class-empty-cancel','','\x1b',-1,''],
    ['class-commit-preselection','$','\n',1,'$'],
    ['class-empty-commit','$','-\n',0,''],
    ['class-select-other','','b\n',1,')'],
    ['class-all','$','A\n',1,' '],
]) test(name,async()=>{
    let box={s:initial};
    const out=await exercise(name,keys,()=>choose_classes_menu('Autopickup what?',1,true,'$)%',box));
    assert.equal(out.result,count);assert.equal(box.s,selection);assert.equal(out.used,keys.length);
});

for(const [name,key,want,expected] of [
    ['inventory-cancel','\x1b',true,'\x1b'],
    ['inventory-display-only-cancel','\x1b',false,'\x1b'],
    ['inventory-empty-commit','\n',true,0],
    ['inventory-selection','a',true,'a'],
]) test(name,async()=>{
    const out=await exercise(name,key,()=>display_pickinv(null,null,null,false,want));
    assert.equal(out.result,expected);assert.equal(out.used,1);
    assert.equal(out.after.weapon,out.before.weapon);
});

test('inventory wrapper propagates Escape',async()=>{
    const out=await exercise('inventory-wrapper-cancel','\x1b',()=>display_inventory(null,true));
    assert.equal(out.result,'\x1b');assert.equal(out.used,1);
});
test('single-object message menu retains its Escape return',async()=>{
    const out=await exercise('single-object-cancel','\x1b',()=>display_pickinv('a',null,null,false,true));
    assert.equal(out.result,'\x1b');assert.equal(out.used,1);
    assert.match(out.reads[0].top,/--More--/);
});
test('wizard identification cancellation does not identify or retain override',async()=>{
    const out=await exercise('wizard-cancel','\x1b',()=>wiz_identify());
    assert.equal(out.result,ECMD_OK);assert.equal(out.used,1);
    assert.deepEqual(out.after.inventory,out.before.inventory);assert.equal(game.iflags.override_ID,0);
});

test('real wield caller finishes after Escape without another prompt',async()=>{
    const out=await exercise('wield-cancel','?\x1b',()=>dowield());
    assert.equal(out.result,ECMD_CANCEL);assert.equal(out.used,2);
    assert.equal(out.after.weapon,out.before.weapon);
});
test('real wield caller retries ordinary empty selection',async()=>{
    const out=await exercise('wield-empty','?\n\x1b',()=>dowield());
    assert.equal(out.result,ECMD_CANCEL);assert.equal(out.used,3);
    assert.match(out.reads[2].top,/What do you want to wield/);
});
test('real options handler preserves the old pickup classes after Escape',async()=>{
    const keys=':pickup_types\n\x1b\x1b';
    const out=await exercise('options-cancel',keys,()=>doset_simple());
    assert.equal(out.used,keys.length);assert.equal(out.before.pickup_types,'$');
    assert.equal(out.after.pickup_types,'$');
    assert.ok(out.reads.some(r=>r.top==='Autopickup what?'));
});
test('real options handler accepts deliberately cleared classes',async()=>{
    const keys=':pickup_types\n-\n\x1b';
    const out=await exercise('options-empty',keys,()=>doset_simple());
    assert.equal(out.used,keys.length);assert.equal(out.after.pickup_types,'');
});
test('real adjust caller cancels destination without another prompt',async()=>{
    const out=await exercise('adjust-cancel','a?\x1b',()=>doorganize());
    assert.equal(out.used,3);assert.equal(out.result,ECMD_OK);
    assert.deepEqual(out.after.inventory,out.before.inventory);
    assert.equal(out.after.top,'Never mind.');
});
test('real adjust caller retries ordinary empty selection',async()=>{
    const out=await exercise('adjust-empty','a?\n\x1b',()=>doorganize());
    assert.equal(out.used,4);assert.equal(out.result,ECMD_OK);
    assert.deepEqual(out.after.inventory,out.before.inventory);
    assert.match(out.reads[3].top,/Adjust letter to what/);
});
test('real adjust caller uses accepted destination and swaps occupied slots',async()=>{
    const out=await exercise('adjust-select','a?b',()=>doorganize());
    assert.equal(out.used,3);assert.equal(out.result,ECMD_OK);
    for(const slot of ['a','b']) {
        const old=out.before.inventory.find(o=>o.invlet===slot);
        assert.equal(out.after.inventory.find(o=>o.id===old.id).invlet,slot==='a'?'b':'a');
    }
});
test('real split cancellation merges the starting Ranger arrow stack',async()=>{
    const out=await exercise('split-cancel','1c?\x1b',()=>doorganize(),{role:'Ranger'});
    assert.ok(out.before.inventory.find(o=>o.invlet==='c').quan>1);
    assert.ok(out.reads.some(r=>r.inventory.filter(o=>o.invlet==='c').length===2));
    assert.equal(out.used,4);assert.deepEqual(out.after.inventory,out.before.inventory);
});
test('ggetobj drop inspection honors Escape',async()=>{
    const out=await exercise('ggetobj-cancel','i\n\x1b',()=>ggetobj('drop',drop,0,false,null));
    assert.equal(out.result,0);assert.equal(out.used,3);
    assert.deepEqual(out.after.inventory,out.before.inventory);
});

test('fully identified starting inventory needs no identification prompt',async()=>{
    const out=await exercise('ggetobj-all-known','',()=>ggetobj('identify',identify,1,false,null));
    assert.equal(out.result,-1);assert.equal(out.used,0);
});

for(const owner of ['classes','inventory','adjust']) test(owner+' awaits real input then propagates cancellation',async()=>{
    const run=await ready();
    let reached,release,done=false,used=0;
    const atInput=new Promise(resolve=>{reached=resolve;});
    const target=owner==='adjust'?3:1;
    run._display.onEmptyQueue=()=>{
        assert.ok(++used<=6);
        if(used===target){reached();return new Promise(resolve=>{release=resolve;});}
        return (owner==='adjust'&&used===1?'a':owner==='adjust'&&used===2?'?':'\x1b').charCodeAt(0);
    };
    const box={s:'$'};
    const pending=(owner==='classes'?choose_classes_menu('Autopickup what?',1,true,'$)%',box):
        owner==='inventory'?display_inventory(null,true):doorganize()).then(result=>{done=true;return result;});
    await atInput;const during={done,...observe()};release(27);
    const result=await pending;
    assert.equal(during.done,false);assert.equal(during.active,1);
    assert.equal(done,true);assert.equal(used,target);
    if(owner==='classes'){assert.equal(result,-1);assert.equal(box.s,'$');}
    if(owner==='inventory')assert.equal(result,'\x1b');
});
test('read-only source observations preserve all five output collections',async()=>{
    const observed=await exercise('observer-on','a?b',()=>doorganize());
    const plain=await exercise('observer-off','a?b',()=>doorganize(),{observed:false});
    assert.deepEqual(observed.hashes,plain.hashes);assert.equal(observed.used,plain.used);
});
after(()=>{if(receipt)writeFileSync(receipt,JSON.stringify(observations,null,2)+'\n');});
