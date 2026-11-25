// Source controls through real input, line, history, query and wish owners.
// No runtime function or RNG is replaced. Input uses GameDisplay's public callback.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setImmediate} from 'node:timers/promises';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {getlin,hooked_tty_getlin,paranoid_ynq,cmdq_add_key,cmdq_copy} from '../js/cmd.js';
import {nhgetch,resetInputState} from '../js/input.js';
import {getRngLog} from '../js/rng.js';
import {pline,display_nhwindow_message,TOPLINE_EMPTY,TOPLINE_NEED_MORE} from '../js/display.js';
import {remember_topl,tty_yn_function} from '../js/tty/topl.js';
import {makewish} from '../js/zap.js';
import {moveloop_core} from '../js/allmain.js';
import {CQ_CANNED,CQ_REPEAT} from '../js/const.js';

const recipe=JSON.parse(fs.readFileSync(new URL('gen-sessions/recipes/line-input-eof.json',import.meta.url)));
const base=recipe.segments[0];
let reads;
function feed(run,keys){
    reads=0;
    run._display.onEmptyQueue=async()=>{
        await setImmediate();
        assert.ok(reads<keys.length,'unexpected input read');
        return keys.charCodeAt(reads++);
    };
}
async function boot(){
    const run=await runSegment({...base,moves:' ',storage:new InMemoryStorage()});
    resetInputState();feed(run,' ');await display_nhwindow_message();feed(run,'');
    return run;
}
async function noRng(action){const before=[...getRngLog()];const result=await action();assert.deepEqual(getRngLog(),before);return result;}
function cleaned(){
    assert.equal(game._toplin,TOPLINE_EMPTY);
    assert.equal(game._pending_message,'');
    assert.equal(game.bot_disabled,false);
    assert.equal(game.nhDisplay.cursorCol,0);
    assert.equal(game.nhDisplay.cursorRow,0);
}
await test('FF on an empty line returns ESC, marks terminal gone and clears the prompt',async()=>{
    const run=await boot();feed(run,'\xff\n');
    assert.equal(await noRng(()=>getlin('Name?')),'\x1b');
    assert.equal(reads,1);assert.equal(game.iflags.term_gone,1);cleaned();
});
await test('FF cancels nonempty text immediately and leaves the next physical key unread',async()=>{
    const run=await boot();feed(run,'abc\xffZ\n');
    assert.equal(await noRng(()=>getlin('Name?')),'\x1b');
    assert.equal(reads,4);assert.equal(game._toplines,'Name? abc');cleaned();
    assert.equal(await nhgetch(),90);assert.equal(reads,5);
});
await test('ordinary line cancellation retains query plus pre-EOF text for real history',async()=>{
    const run=await boot();feed(run,'abc\xff\n');
    const history=[...(game._msg_history||[])];
    assert.equal(await getlin('Name?'),'\x1b');
    assert.deepEqual(game._msg_history||[],history);
    remember_topl();assert.ok(game._msg_history.includes('Name? abc'));
    assert.ok(!game._msg_history.some(s=>s?.includes('\xff')));
});
await test('direct extended-prompt reader suppresses EOF history',async()=>{
    const run=await boot();feed(run,'abc\xff\n');const history=[...(game._msg_history||[])];
    assert.equal(await noRng(()=>hooked_tty_getlin('#',null,true)),'\x1b');
    assert.equal(game._toplines,'');remember_topl();assert.deepEqual(game._msg_history||[],history);
});
await test('getlin restores a preexisting disabled status flag after EOF',async()=>{
    const run=await boot();game.bot_disabled=true;feed(run,'\xff\n');
    assert.equal(await getlin('Name?'),'\x1b');assert.equal(game.bot_disabled,true);
});
await test('ordinary Escape on an empty line cancels without marking terminal gone',async()=>{
    const run=await boot();feed(run,'\x1bZ');
    assert.equal(await noRng(()=>getlin('Name?')),'\x1b');
    assert.equal(reads,1);assert.ok(!game.iflags.term_gone);cleaned();
});
await test('ordinary Escape with text clears it and continues reading',async()=>{
    const run=await boot();feed(run,'abc\x1bOK\n');
    assert.equal(await noRng(()=>getlin('Name?')),'OK');
    assert.equal(reads,7);assert.ok(!game.iflags.term_gone);cleaned();
});
for(const [label,keys] of [['LF','ASCII\n'],['CR','ASCII\r']])
 await test(`${label} commits text and preserves ordinary cleanup`,async()=>{
    const run=await boot();feed(run,keys);
    assert.equal(await noRng(()=>getlin('Name?')),'ASCII');
    assert.equal(reads,6);assert.equal(game._toplines,'Name? ASCII');assert.ok(!game.iflags.term_gone);cleaned();
 });
await test('every other high byte 80..FE remains admitted without re-encoding',async()=>{
    for(const [start,end] of [[0x80,0xc0],[0xc0,0xff]]){
        const run=await boot();const bytes=String.fromCharCode(...Array.from({length:end-start},(_,i)=>start+i));
        feed(run,bytes+'\n');assert.equal(await noRng(()=>getlin('Bytes?')),bytes);
        assert.equal(reads,bytes.length+1);assert.ok(!game.iflags.term_gone);
    }
});
await test('backspace removes one raw byte without Unicode decoding',async()=>{
    const run=await boot();feed(run,'\xc3\xa9\bX\n');
    assert.equal(await noRng(()=>getlin('Bytes?')),'\xc3X');assert.ok(!game.iflags.term_gone);
});
await test('80-byte input bound is unchanged',async()=>{
    const run=await boot();feed(run,'\xc3\xa9'.repeat(41)+'\n');
    assert.equal(await noRng(()=>getlin('Bytes?')),'\xc3\xa9'.repeat(40));assert.equal(reads,83);
});
await test('ordinary nhgetch still returns FF as 255 outside the line owner',async()=>{
    const run=await boot();feed(run,'\xff');
    assert.equal(await noRng(()=>nhgetch()),255);assert.ok(!game.iflags.term_gone);
});
await test('More ignores FF through its own reader, then EOF is read by getlin',async()=>{
    const run=await boot();await pline('Earlier message');assert.equal(game._toplin,TOPLINE_NEED_MORE);
    feed(run,'\xff \xff\n');
    assert.equal(await noRng(()=>getlin('Name?')),'\x1b');
    assert.equal(reads,3);assert.equal(game.iflags.term_gone,1);cleaned();
});
await test('direct tty line reader preserves both core command queues, including a queued FF',async()=>{
    const run=await boot();cmdq_add_key(CQ_CANNED,'\xff');cmdq_add_key(CQ_REPEAT,'R');
    const canned=cmdq_copy(CQ_CANNED),repeat=cmdq_copy(CQ_REPEAT);feed(run,'OK\n');
    assert.equal(await hooked_tty_getlin('Name?',null),'OK');
    assert.deepEqual(cmdq_copy(CQ_CANNED),canned);assert.deepEqual(cmdq_copy(CQ_REPEAT),repeat);
    assert.ok(!game.iflags.term_gone);
});
await test('queued yn answer FF is not reinterpreted as line EOF',async()=>{
    const run=await boot();cmdq_add_key(CQ_CANNED,'\xff');feed(run,'');
    assert.equal(await noRng(()=>tty_yn_function('Key?',null,'\0',true)),'\xff');
    assert.equal(reads,0);assert.ok(!game.iflags.term_gone);
});
await test('pending physical input holds getlin until FF actually arrives',async()=>{
    const run=await boot();let release,entered=false,finished=false;
    const blocked=new Promise(r=>release=r);let count=0;
    run._display.onEmptyQueue=async()=>{if(++count===1){entered=true;await blocked;return 255;}assert.equal(count,2);return 10;};
    const pending=getlin('Name?').then(answer=>{finished=true;return answer;});
    await setImmediate();assert.ok(entered);assert.equal(finished,false);
    assert.ok(!game.iflags.term_gone);assert.equal(game.bot_disabled,true);
    release();assert.equal(await pending,'\x1b');assert.equal(game.iflags.term_gone,1);cleaned();
});
await test('pending More completes before the line prompt can consume FF',async()=>{
    const run=await boot();await pline('Earlier message');
    let release,entered=false,count=0,finished=false;const blocked=new Promise(r=>release=r);
    run._display.onEmptyQueue=async()=>{if(++count===1){entered=true;await blocked;return 32;}assert.ok(count<=3);return count===2?255:10;};
    const pending=getlin('Name?').then(answer=>{finished=true;return answer;});
    await setImmediate();assert.ok(entered);assert.equal(finished,false);assert.ok(!game.iflags.term_gone);
    assert.equal(game._prevmsg,'Earlier message');release();
    assert.equal(await pending,'\x1b');assert.equal(count,2);cleaned();
});
await test('an input rejection propagates with exact identity and restores bot_disabled, not EOF',async()=>{
    const run=await boot();const failure=new Error('controlled transport rejection');
    run._display.onEmptyQueue=async()=>{await setImmediate();throw failure;};
    await assert.rejects(getlin('Name?'),error=>error===failure);
    assert.equal(game.bot_disabled,false);assert.ok(!game.iflags.term_gone);
});
for(const acceptQ of [false,true])await test(`paranoid consumer maps EOF to ${acceptQ?'quit':'no'} without retry`,async()=>{
    const run=await boot();feed(run,'abc\xff\n');
    assert.equal(await noRng(()=>paranoid_ynq(true,'Proceed?',acceptQ)),acceptQ?'q':'n');
    assert.equal(reads,4);assert.equal(game.iflags.term_gone,1);
});
await test('wish consumer returns before parsing or granting after a real FF read',async()=>{
    const run=await boot();feed(run,' \xff\nnothing\n');
    const inventory=structuredClone(game.invent),conduct=structuredClone(game.u.uconduct),luck=game.u.ublesscnt;
    await noRng(()=>makewish());
    assert.equal(game.iflags.term_gone,1);assert.equal(game.context.resume_wish,1);
    assert.deepEqual(game.invent,inventory);assert.deepEqual(game.u.uconduct,conduct);assert.equal(game.u.ublesscnt,luck);
    assert.equal(reads,2);cleaned();
});
await test('ASCII nothing declines a wish normally with no resume flag',async()=>{
    const run=await boot();feed(run,' nothing\n');
    const inventory=structuredClone(game.invent),conduct=structuredClone(game.u.uconduct);
    await noRng(()=>makewish());assert.ok(!game.iflags.term_gone);assert.equal(game.context.resume_wish,0);
    assert.deepEqual(game.invent,inventory);assert.deepEqual(game.u.uconduct,conduct);
});
await test('normal later getlin does not reset the sticky terminal-gone flag',async()=>{
    const run=await boot();feed(run,'\xff\n');assert.equal(await getlin('Name?'),'\x1b');
    feed(run,'OK\n');assert.equal(await getlin('Again?'),'OK');assert.equal(game.iflags.term_gone,1);
});
await test('moveloop awaits the FF-produced resume wish before turn effects or a command read',async()=>{
    const run=await boot();feed(run,' \xff\nnothing\n');
    await makewish();assert.equal(game.context.resume_wish,1);
    let release,entered=false;const blocked=new Promise(r=>release=r),stop=new Error('stop at genuine pending input');
    let count=0;run._display.onEmptyQueue=async()=>{if(++count===1)return 32;entered=true;await blocked;throw stop;};
    const before={rng:[...getRngLog()],moves:game.moves,hp:game.u.uhp,inv:structuredClone(game.invent),conduct:structuredClone(game.u.uconduct)};
    const pending=moveloop_core();await setImmediate();
    try{
        assert.ok(entered);assert.equal(game.context.resume_wish,0,'makewish clears the flag on entry');
        assert.equal(game._toplines,'For what do you wish? ');assert.equal(game.bot_disabled,true);
        assert.deepEqual(getRngLog(),before.rng);assert.equal(game.moves,before.moves);assert.equal(game.u.uhp,before.hp);
        assert.deepEqual(game.invent,before.inv);assert.deepEqual(game.u.uconduct,before.conduct);
    }finally{release();await assert.rejects(pending,error=>error===stop);}
    assert.equal(game.bot_disabled,false);
});
