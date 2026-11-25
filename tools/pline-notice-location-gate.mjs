// C pline.c vpline location ordering, with actual notice_mon/vision producers.
// Constructed quiet level; no helper bodies, RNG, queue entries or outputs are mocked.
// Usage: node tools/pline-notice-location-gate.mjs [compact-report.json]
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {setImmediate} from 'node:timers/promises';
import {setup,seed,clearMessages,messages,x,y} from './half-damage-intrinsic-setup.mjs';
import {hash} from './half-damage-reader-observe.mjs';
import {game} from '../js/gstate.js';
import {makemon} from '../js/makemon.js';
import {notice_mon,notice_all_mons,notice_all_mons_flush,notice_mon_off,notice_mon_on} from '../js/hack.js';
import {vision_recalc} from '../js/vision.js';
import {pline,pline_nohistory,pline_nohistory_no_cursor,urgent_pline} from '../js/display.js';
import {pline_mon,pline_xy,pline_dir,set_msg_xy,You,Your,You_feel,You_cant,You_hear,You_see,There,pline_The,Norep,verbalize} from '../js/pline.js';
import {xytodir} from '../js/cmd.js';
import {msgtype_parse_add} from '../js/options.js';
import {potionhit,make_blinded} from '../js/potion.js';
import {mcureblindness,m_consume_obj} from '../js/mon.js';
import {find_defensive,use_defensive} from '../js/muse.js';
import {mpickobj} from '../js/steal.js';
import {mksobj} from '../js/mkobj.js';
import {makeknown} from '../js/o_init.js';
import {getRngLog} from '../js/rng.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {ONAMES as O} from '../js/objects_data.js';
import {NO_MINVENT,POTHIT_HERO_THROW,BUFSZ} from '../js/const.js';

const tests=[],results=[];
let notes={};
const check=(name,fn)=>tests.push([name,fn]);
async function fresh(options='OPTIONS=accessiblemsg,whatis_coord:map,spot_monsters\n') {
    const run=await setup('Wizard',options);
    let reads=0;
    run._display.onEmptyQueue=async()=>{
        await setImmediate();
        assert.ok(++reads<100,'bounded real input transport');
        return /Call .*:/.test(game._pending_message||game._toplines)?27:32;
    };
    notes={};
    return run;
}
async function spawn(type,dx,dy=0) {
    const mon=await makemon(game.mons[type],x+dx,y+dy,NO_MINVENT);
    assert.ok(mon);return mon;
}
async function queue(dx=-2) {
    const mon=await spawn(P.PM_NEWT,dx);
    notice_mon(mon);
    assert.ok(game.a11y.notices?.some(n=>n.x===mon.mx&&n.y===mon.my),'actual notice producer');
    return mon;
}
function begin() {clearMessages();seed(7);}
function textIsLocated(line,prefix='<33,10>: ') {
    assert.ok(messages().includes(prefix+line),messages());
    assert.deepEqual(game.a11y.msg_loc,{x:0,y:0});
    assert.equal(game.a11y.notices?.length||0,0);
}
function priorNotice(line) {
    const text=messages();
    assert.match(text,/<29,10>: You see a newt\./);
    assert.ok(text.indexOf('You see a newt.')<text.indexOf(line),text);
}
async function target() {
    const m=await spawn(P.PM_HILL_GIANT,2);
    makeknown(O.POT_BLINDNESS);
    await potionhit(m,mksobj(O.POT_BLINDNESS,false,false),POTHIT_HERO_THROW);
    assert.equal(m.mcansee,0);assert.ok(m.mblinded>0);
    await notice_all_mons_flush();
    return m;
}

for(const pending of [false,true]) {
    for(const [mode,prefix] of [['map','<33,10>: '],['screen','[12,33]: '],['compass','(2e): '],['full','(2east): '],['none','(2east): ']]) {
        check(`coordinates/${mode}/queued-${pending}`,async()=>{
            await fresh(`OPTIONS=accessiblemsg,whatis_coord:${mode},spot_monsters\n`);
            if(pending)await queue();
            begin();await pline_xy(33,10,'The distant sound stops.');
            textIsLocated('The distant sound stops.',prefix);
            if(pending)assert.ok(messages().indexOf('You see a newt.')<messages().indexOf('The distant sound stops.'));
            assert.deepEqual(getRngLog(),[]);
        });
    }
}
for(const [name,action,line,prefix] of [
    ['plain',()=>{set_msg_xy(33,10);return pline('A bell rings.');},'A bell rings.','<33,10>: '],
    ['xy',()=>pline_xy(33,10,'A bell rings.'),'A bell rings.','<33,10>: '],
    ['direction',()=>pline_dir(xytodir(1,0),'A bell rings.'),'A bell rings.','<32,10>: '],
    ['You',()=>You('notice the bell.'),'You notice the bell.','<33,10>: '],
    ['Your',()=>Your('pack rattles.'),'Your pack rattles.','<33,10>: '],
    ['You_feel',()=>You_feel('a breeze.'),'You feel a breeze.','<33,10>: '],
    ['You_cant',()=>You_cant('reach it.'),"You can't reach it.",'<33,10>: '],
    ['You_hear',()=>You_hear('a bell.'),'You hear a bell.','<33,10>: '],
    ['You_see',()=>You_see('a glimmer.'),'You see a glimmer.','<33,10>: '],
    ['There',()=>There('is a breeze.'),'There is a breeze.','<33,10>: '],
    ['The',()=>pline_The('bell rings.'),'The bell rings.','<33,10>: '],
    ['Norep',()=>Norep('A bell rings.'),'A bell rings.','<33,10>: '],
    ['verbalize',()=>verbalize('Hello.'),'"Hello."','<33,10>: ']
]) check(`wrapper/${name}`,async()=>{
    await fresh();await queue();begin();set_msg_xy(33,10);
    await action();textIsLocated(line,prefix);priorNotice(line);
    assert.equal(game.pline_flags||0,0);assert.deepEqual(getRngLog(),[]);
});
check('wrapper/monster',async()=>{
    await fresh();const m=await target();await queue();begin();
    await pline_mon(m,'The hill giant waits.');textIsLocated('The hill giant waits.');priorNotice('The hill giant waits.');
});
check('wrapper/hero-alias-clears-location',async()=>{
    await fresh();await queue();begin();set_msg_xy(33,10);
    await pline_mon(game.youmonst,'You wait.');
    assert.ok(messages().includes('You wait.'));assert.ok(!messages().includes('<33,10>'));
    assert.ok(!messages().includes('<29,10>: You wait.'));assert.deepEqual(game.a11y.msg_loc,{x:0,y:0});
});
check('location/one-message-consumption',async()=>{
    await fresh();await queue();begin();set_msg_xy(35,12);
    await pline_xy(33,10,'A bell rings.');textIsLocated('A bell rings.');
    await pline('A plain followup.');assert.ok(!messages().includes('<35,12>'));
    assert.ok(!messages().includes('<33,10>: A plain followup.'));
});
for(const text of ['',null])check(`empty/${String(text)}`,async()=>{
    await fresh();await queue();begin();set_msg_xy(33,10);await pline(text);
    assert.equal(game._prevmsg,'<29,10>: You see a newt.');
    assert.deepEqual(game.a11y.msg_loc,{x:0,y:0});assert.equal(game.a11y.notices.length,0);
});
for(const coords of [[0,0],[80,10],[33,-1]])check(`invalid-location/${coords}`,async()=>{
    await fresh();await queue();begin();await pline_xy(...coords,'No location.');
    assert.equal(game._prevmsg,'No location.');assert.deepEqual(game.a11y.msg_loc,{x:0,y:0});
});
check('negative/accessiblemsg-off',async()=>{
    await fresh('OPTIONS=!accessiblemsg,spot_monsters\n');await queue();begin();
    await pline_xy(33,10,'A bell rings.');assert.ok(!messages().includes('<'));
    assert.match(messages(),/You see a newt/);assert.equal(game._prevmsg,'A bell rings.');
    assert.deepEqual(game.a11y.msg_loc,{x:0,y:0});
});
check('negative/notice-option-off',async()=>{
    await fresh('OPTIONS=accessiblemsg,whatis_coord:map,!spot_monsters\n');
    const m=await spawn(P.PM_NEWT,-2);notice_mon(m);assert.equal(game.a11y?.notices?.length||0,0);
    begin();await pline_xy(33,10,'A bell rings.');textIsLocated('A bell rings.');assert.ok(!messages().includes('You see'));
});
check('producer/blocking-and-deduplication',async()=>{
    await fresh();notice_mon_off();notice_mon_off();const m=await spawn(P.PM_NEWT,-2);
    notice_mon(m);notice_mon_on();notice_mon(m);assert.equal(game.a11y?.notices?.length||0,0);
    notice_mon_on();notice_mon(m);notice_mon(m);assert.equal(game.a11y.notices.length,1);
    begin();await pline_xy(33,10,'A bell rings.');textIsLocated('A bell rings.');
    assert.equal(messages().split('You see a newt.').length-1,1);
});
check('producer/sorted-all-monsters',async()=>{
    await fresh();await spawn(P.PM_NEWT,-3);await spawn(P.PM_NEWT,-1);
    notice_all_mons(true);assert.deepEqual(game.a11y.notices.map(n=>n.x),[30,28]);
    begin();await pline_xy(33,10,'A bell rings.');textIsLocated('A bell rings.');
    const text=messages();assert.ok(text.indexOf('<30,10>')<text.indexOf('<28,10>'));
    assert.ok(text.indexOf('<28,10>')<text.indexOf('<33,10>'));
});
check('producer/vision-recalc',async()=>{
    await fresh();const n=await spawn(P.PM_NEWT,-2);vision_recalc(0);
    assert.ok(n.mspotted);assert.ok(game.a11y.notices.some(m=>m.x===29));
    begin();await pline_xy(33,10,'A bell rings.');textIsLocated('A bell rings.');priorNotice('A bell rings.');
});
check('producer/vision-reveal-after-real-blindness',async()=>{
    await fresh();await make_blinded(20,false);const n=await spawn(P.PM_NEWT,-2);
    vision_recalc(0);assert.equal(game.a11y?.notices?.length||0,0);
    // C toggle_blindness finishes its sighting before make_blinded returns.
    begin();
    await make_blinded(0,false);vision_recalc(0);assert.ok(n.mspotted);
    assert.equal(game.a11y.notices?.length||0,0);
    assert.match(messages(),/<29,10>: You see a newt\./);
    await pline_xy(33,10,'A bell rings.');textIsLocated('A bell rings.');priorNotice('A bell rings.');
});
for(const hide of ['incoming','notice'])check(`filter/hide-${hide}`,async()=>{
    await fresh();await queue();begin();
    assert.equal(msgtype_parse_add(hide==='incoming'?'hide "^<33,10>:"':'hide "You see a newt"'),true);
    await pline_xy(33,10,'A bell rings.');
    if(hide==='incoming'){assert.ok(!messages().includes('A bell rings.'));assert.match(messages(),/You see a newt/);}
    else{textIsLocated('A bell rings.');assert.ok(!messages().includes('You see a newt'));}
    assert.deepEqual(game.a11y.msg_loc,{x:0,y:0});assert.equal(game.a11y.notices.length,0);
});
check('filter/norep-compares-located-previous-message',async()=>{
    await fresh();await queue();begin();
    assert.equal(msgtype_parse_add('norep "A bell rings"'),true);
    await pline_xy(33,10,'A bell rings.');textIsLocated('A bell rings.');
    const before=messages();await pline_xy(33,10,'A bell rings.');assert.equal(messages(),before);
    assert.deepEqual(game.a11y.msg_loc,{x:0,y:0});
});
for(const stage of ['notice','incoming','escape-notice'])check(`ordering/pending-${stage}`,async()=>{
    const run=await fresh();await queue();begin();
    assert.equal(msgtype_parse_add(stage==='incoming'?'stop "^<33,10>:"':'stop "You see a newt"'),true);
    let release,done=false;
    run._display.onEmptyQueue=()=>new Promise(resolve=>{release=resolve;});
    const work=pline_xy(33,10,'A bell rings.').then(()=>{done=true;});
    try {
        for(let i=0;i<200&&!release&&!done;i++)await setImmediate();
        assert.ok(release,'real pending input');assert.equal(done,false);
        assert.deepEqual(game.a11y.msg_loc,{x:0,y:0});
        if(stage!=='incoming')assert.ok(!messages().includes('A bell rings.'));
        else textIsLocated('A bell rings.');
    } finally {
        run._display.onEmptyQueue=()=>32;
        if(release)release(stage==='escape-notice'?27:32);
        await work;
    }
    textIsLocated('A bell rings.');priorNotice('A bell rings.');assert.equal(done,true);
    if(stage==='escape-notice')assert.equal(game._win_stop,true);
});
check('format/location-before-truncation',async()=>{
    await fresh();await queue();begin();const raw='a'.repeat(BUFSZ+20)+'XYZ';
    const full='<33,10>: '+raw,expected=full.slice(0,BUFSZ-7)+'...XYZ';
    await pline_xy(33,10,raw);assert.equal(game._prevmsg,expected);
    assert.equal(game._prevmsg.length,BUFSZ-1);assert.deepEqual(game.a11y.msg_loc,{x:0,y:0});
});
for(const caller of ['mcureblindness','carrot','monster-quaff'])check(`cross-owner/${caller}`,async()=>{
    await fresh();const m=await target();let potion;
    if(caller==='monster-quaff'){
        potion=mksobj(O.POT_EXTRA_HEALING,false,false);makeknown(potion.otyp);
        await mpickobj(m,potion);assert.equal(find_defensive(m,true),true);assert.equal(game.m.defensive,potion);
    }
    await queue();begin();
    if(caller==='mcureblindness')await mcureblindness(m,true);
    else if(caller==='carrot')await m_consume_obj(m,mksobj(O.CARROT,false,false));
    else await use_defensive(m);
    assert.equal(m.mcansee,1);assert.equal(m.mblinded,0);
    textIsLocated('The hill giant can see again.');priorNotice('The hill giant can see again.');
    if(potion){textIsLocated('The hill giant drinks a potion of extra healing!');assert.ok(!m.minvent.includes(potion));}
});
for(const [name,action] of [['urgent',urgent_pline],['nohistory',pline_nohistory],['nohistory-no-cursor',pline_nohistory_no_cursor]])check(`unchanged-separate-path/${name}/no-queue`,async()=>{
    await fresh();begin();set_msg_xy(33,10);await action('A bell rings.');
    assert.equal(game._prevmsg,'<33,10>: A bell rings.');assert.deepEqual(game.a11y.msg_loc,{x:0,y:0});
});
const timer=setTimeout(()=>{console.error('55 second source worker limit');process.exit(2);},55000);
for(const [name,fn] of tests){
    try{await fn();results.push({name,pass:true,rngSHA256:hash(getRngLog()),messageSHA256:hash(messages()),notes});}
    catch(error){results.push({name,pass:false,error:String(error.message).slice(0,1000),rngSHA256:hash(getRngLog())});}
}
clearTimeout(timer);
const report={kind:'constructed source states with real public producers',total:results.length,passed:results.filter(r=>r.pass).length,results};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:report.total,passed:report.passed,firstFailure:results.find(r=>!r.pass)||null}));
if(report.passed!==report.total)process.exitCode=1;
