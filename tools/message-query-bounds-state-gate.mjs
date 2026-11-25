// Constructed boundary controls through real message, query, naming and queue owners.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setImmediate} from 'node:timers/promises';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {resetInputState} from '../js/input.js';
import {getRngLog} from '../js/rng.js';
import {pline,pline_nohistory,pline_nohistory_no_cursor,urgent_pline,
    display_nhwindow_message,TOPLINE_NEED_MORE} from '../js/display.js';
import {You,Norep,pline_xy,set_msg_xy} from '../js/pline.js';
import {tty_yn_function,remember_topl} from '../js/tty/topl.js';
import {getlin,cmdq_add_key,cmdq_add_dir,cmdq_add_userinput,cmdq_copy,cmdq_clear} from '../js/cmd.js';
import {msgtype_parse_add} from '../js/options.js';
import {christen_monst} from '../js/do_name.js';
import {makemon,MM_NOMSG} from '../js/makemon.js';
import {set_ustuck} from '../js/mon.js';
import {ustatusline} from '../js/insight.js';
import {PMNAMES} from '../js/monst_data.js';
import {BUFSZ,QBUFSZ,CQ_CANNED,CQ_REPEAT,CMDQ_KEY} from '../js/const.js';
const recipe=JSON.parse(fs.readFileSync(new URL('gen-sessions/recipes/message-query-bounds.json',import.meta.url)));
const base=recipe.segments.find(s=>s.name==='message-short-holder');
let reads;
function feed(run,keys=' '.repeat(8)) {
    reads=0;let offset=0;
    run._display.onEmptyQueue=async()=>{
        await setImmediate();reads++;
        assert.ok(offset<keys.length,'unexpected input read');
        return keys.charCodeAt(offset++);
    };
}
async function boot(extra='') {
    const run=await runSegment({...base,moves:' ',nethackrc:base.nethackrc+extra,
        storage:new InMemoryStorage()});
    game._preNhgetchHook=null;resetInputState();feed(run);
    await display_nhwindow_message();feed(run);return run;
}
async function unchangedRng(fn){const rng=[...getRngLog()];const r=await fn();assert.deepEqual(getRngLog(),rng);return r;}
for(const n of [254,255,256,257,1279]) await test(`pline length ${n}: C first-249/last-three contract`,async()=>{
    await boot();const msg='A'.repeat(n-3)+'END';
    await unchangedRng(()=>pline(msg));
    assert.equal(game._prevmsg,n<=255?msg:'A'.repeat(249)+'...END');
});
await test('extreme pline overflow fails before painting instead of silently clipping',async()=>{
    await boot();const previous=game._prevmsg,screen=game.nhDisplay.terminal.serialize();
    await assert.rejects(()=>unchangedRng(()=>pline('A'.repeat(1280))),
        {message:'pline attempting to print 1280 characters!'});
    assert.equal(game._prevmsg,previous);assert.equal(game.nhDisplay.terminal.serialize(),screen);
});
for(const [name,owner] of [['nohistory',pline_nohistory],['nohistory-no-cursor',pline_nohistory_no_cursor],['urgent',urgent_pline]])
 await test(`${name}: shared vpline bound and final bytes`,async()=>{
    await boot();const history=[...(game._msg_history||[])];
    await unchangedRng(()=>owner('B'.repeat(256)+'XYZ'));
    assert.equal(game._prevmsg,'B'.repeat(249)+'...XYZ');
    if(name!=='urgent')assert.deepEqual(game._msg_history||[],history);
});
await test('You prefix participates in the same bound',async()=>{
    await boot();await You('A'.repeat(250)+'END');
    assert.equal(game._prevmsg,'You '+'A'.repeat(245)+'...END');
});
await test('accessible location is prefixed before truncation and consumed once',async()=>{
    await boot('OPTIONS=accessiblemsg\n');
    await pline_xy(8,12,'short');const prefix=game._prevmsg.slice(0,-5);
    assert.ok(prefix.length>0);await display_nhwindow_message();
    await pline_xy(8,12,'A'.repeat(256)+'END');
    assert.equal(game._prevmsg,(prefix+'A'.repeat(256)).slice(0,249)+'...END');
    assert.deepEqual(game.a11y.msg_loc,{x:0,y:0});
});
await test('empty message still consumes the location without input or output',async()=>{
    await boot('OPTIONS=accessiblemsg\n');const before=game._prevmsg;
    set_msg_xy(8,12);await pline('');assert.equal(game._prevmsg,before);
    assert.equal(reads,0);assert.deepEqual(game.a11y.msg_loc,{x:0,y:0});
});
await test('raw UTF-8 byte sequence is cut at a byte boundary, without decoding',async()=>{
    await boot();const msg='A'.repeat(248)+'\xc3\xa9'+'B'.repeat(10)+'\xe2\x82\xac';
    await pline(msg);assert.equal(game._prevmsg,'A'.repeat(248)+'\xc3...\xe2\x82\xac');
    assert.equal(game._prevmsg.length,255);
});
await test('MSGTYPE sees the clipped text before painting',async()=>{
    await boot();assert.equal(msgtype_parse_add('hide "^A{249}\\.\\.\\.END$"'),true);
    const previous=game._prevmsg,screen=game.nhDisplay.terminal.serialize();
    await pline('A'.repeat(260)+'END');
    assert.equal(game._prevmsg,previous);assert.equal(game.nhDisplay.terminal.serialize(),screen);assert.equal(reads,0);
});
await test('Norep compares the clipped message identity',async()=>{
    await boot();await pline('A'.repeat(249)+'middle1END');
    const previous=game._prevmsg,count=reads;
    await Norep('A'.repeat(249)+'middle2END');
    assert.equal(game._prevmsg,previous);assert.equal(reads,count);
});
await test('message history retains the clipped message',async()=>{
    await boot();await pline('A'.repeat(256)+'END');remember_topl();
    assert.ok(game._msg_history.includes('A'.repeat(249)+'...END'));
});
await test('pending More holds completion and preserves final marker until actual input',async()=>{
    const run=await boot();await pline('earlier message');
    let release;const blocked=new Promise(r=>release=r);let entered=false,finished=false;
    run._display.onEmptyQueue=async()=>{entered=true;await blocked;return 32;};
    const pending=pline(('word '.repeat(55))+'END').then(()=>{finished=true;});
    await setImmediate();assert.ok(entered);assert.equal(finished,false);
    assert.equal(game._prevmsg,'earlier message');
    release();await pending;assert.equal(game._prevmsg,('word '.repeat(55)).slice(0,249)+'...END');
});
for(const n of [126,127,128,129,256]) await test(`query length ${n}: C prefix-only bound`,async()=>{
    const run=await boot();feed(run,'y');const query='Q'.repeat(n-1)+'?';
    const answer=await unchangedRng(()=>tty_yn_function(query,'yn','n'));
    assert.equal(answer,'y');assert.equal(reads,1);
    const bounded=n<128?query:'Q'.repeat(124)+'...';
    assert.equal(game._prevmsg,bounded+' [yn] (n) ');
    assert.equal(game._toplines,bounded+' [yn] (n) y');
});
await test('query UTF-8 bytes can be split by C strncpy',async()=>{
    const run=await boot();feed(run,'n');
    await tty_yn_function('A'.repeat(123)+'\xc3\xa9'+'tail','yn','n');
    assert.equal(game._prevmsg,'A'.repeat(123)+'\xc3... [yn] (n) ');
});
await test('NULL-response query preserves arbitrary input and adds no choice suffix',async()=>{
    const run=await boot();feed(run,'z');
    assert.equal(await tty_yn_function('A'.repeat(128),null,'\0'),'z');
    assert.equal(game._prevmsg,'A'.repeat(124)+'... ');assert.equal(reads,1);
});
await test('query default and hidden choices still use the real response loop',async()=>{
    const run=await boot();feed(run,'\x1b');
    assert.equal(await tty_yn_function('A'.repeat(128),'ynq\x1ba','q'),'q');
    assert.equal(game._prevmsg,'A'.repeat(124)+'... [ynq] (q) ');
    feed(run,'a');assert.equal(await tty_yn_function('short','ynq\x1ba','q'),'a');
});
await test('numeric query count remains in yn_number',async()=>{
    const run=await boot();feed(run,'#12\r');
    assert.equal(await tty_yn_function('A'.repeat(128),'yn#','n'),'#');
    assert.equal(game.yn_number,12);assert.equal(reads,4);
});
await test('queued answer returns with no window, key read or RNG draw',async()=>{
    await boot();cmdq_clear(CQ_REPEAT);cmdq_add_key(CQ_CANNED,'y');
    const screen=game.nhDisplay.terminal.serialize(),previous=game._prevmsg;
    assert.equal(await unchangedRng(()=>tty_yn_function('A'.repeat(128),'yn','n',true)),'y');
    assert.equal(reads,0);assert.equal(game.nhDisplay.terminal.serialize(),screen);assert.equal(game._prevmsg,previous);
    assert.equal(cmdq_copy(CQ_REPEAT),null);
});
await test('queued wrong-kind command retains existing ESC/default fallback',async()=>{
    await boot();cmdq_add_dir(CQ_CANNED,1,0,0);cmdq_add_key(CQ_CANNED,'y');
    assert.equal(await tty_yn_function('A'.repeat(128),'yn','n',true),'n');
    assert.equal(reads,0);assert.equal(cmdq_copy(CQ_CANNED),null);
});
await test('queued USER_INPUT prompts once and preserves repeat-answer identity',async()=>{
    const run=await boot();feed(run,'y');cmdq_clear(CQ_REPEAT);cmdq_add_userinput(CQ_CANNED);
    assert.equal(await tty_yn_function('A'.repeat(128),'yn','n',true),'y');
    assert.equal(reads,1);assert.deepEqual(cmdq_copy(CQ_REPEAT),[{typ:CMDQ_KEY,key:'y'}]);
});
await test('query waits for an earlier More before showing the clipped question',async()=>{
    const run=await boot();await pline('earlier message');assert.equal(game._toplin,TOPLINE_NEED_MORE);
    let release;const blocked=new Promise(r=>release=r);let count=0,finished=false;
    run._display.onEmptyQueue=async()=>{if(++count===1){await blocked;return 32;}return 121;};
    const pending=tty_yn_function('A'.repeat(128),'yn','n').then(answer=>{finished=true;return answer;});
    await setImmediate();assert.equal(count,1);assert.equal(finished,false);assert.equal(game._prevmsg,'earlier message');
    release();assert.equal(await pending,'y');assert.equal(count,2);
    assert.equal(game._prevmsg,'A'.repeat(124)+'... [yn] (n) ');
});
await test('real getlin and christen_monst preserve byte-valued names into held status',async()=>{
    const run=await boot();const bytes=('\xc3\xa9').repeat(31);feed(run,bytes+'\r');
    const typed=await getlin('Name?');assert.equal(typed,bytes);assert.equal(typed.length,62);
    const mon=await makemon(game.mons[PMNAMES.PM_LARGE_MIMIC],7,12,MM_NOMSG);
    assert.ok(mon);christen_monst(mon,typed);set_ustuck(mon);
    feed(run);await display_nhwindow_message();await ustatusline();
    assert.equal(mon.mgivenname,bytes);assert.ok(game._prevmsg.includes(bytes));
    assert.equal(Buffer.from(bytes,'latin1').length,62);
    assert.equal(Buffer.byteLength(bytes,'utf8'),124,'blindly UTF-8 encoding would double-count');
});
