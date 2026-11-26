// Constructed source controls on real generated games and public owners.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {runSegment} from '../../js/jsmain.js';
import {InMemoryStorage} from '../../js/storage.js';
import {game,resetGame} from '../../js/gstate.js';
import {GameDisplay} from '../../js/game_display.js';
import * as D from '../../js/display.js';
import * as T from '../../js/tty/topl.js';
import * as W from '../../js/tty/wintty.js';
import {hooked_tty_getlin} from '../../js/cmd.js';
import {getpos_sethilite} from '../../js/getpos.js';
import {get_valid_jump_position} from '../../js/apply.js';
import {cmap_names as CM} from '../../js/drawing_data.js';
import {SUPPRESS_HISTORY} from '../../js/const.js';
import {NO_COLOR,ATR_INVERSE} from '../../js/terminal.js';
import {outputs,hashes} from '../half-damage-reader-observe.mjs';

assert.ok(process.argv.length<=3&&!process.argv[2]?.startsWith('--'));
const recipe=JSON.parse(readFileSync(new URL('../gen-sessions/recipes/wrapped-message-clear.json',import.meta.url)));
const results=[],timer=setTimeout(()=>process.exit(2),55000);
const cell=(x=70,y=0)=>game.nhDisplay.grid[y+1][x-1];
const cursor=()=>[game.nhDisplay.cursorCol,game.nhDisplay.cursorRow];
function message(text='covered\nrow'){
    game._pending_message='';game._topline_physical_prefix='';
    game._topl_curx=game._topl_cury=0;T.addtopl(text);
}
async function check(name,fn,rc=''){
    const result={name,classification:'constructed source control'};
    let run,before;
    try{
        run=await runSegment({...recipe.segments[0],moves:'',
            nethackrc:recipe.segments[0].nethackrc+rc,storage:new InMemoryStorage()});
        await getpos_sethilite(null,null);
        before=hashes(outputs(run)).calls;
        await fn();result.pass=true;
    }catch(e){result.pass=false;result.error=e.message.slice(0,750);}
    if(run){result.beforeRNG=before;result.afterRNG=hashes(outputs(run)).calls;
        if(before!==result.afterRNG){result.pass=false;result.error='display source control changed gameplay RNG';}}
    results.push(result);
}

await check('clear wrapped U skips numeric unexplored and ends at base row cursor',async()=>{
    message();await D.tty_clear_nhwindow_message(1);
    assert.equal(cell().ch,' ');assert.deepEqual(cursor(),[0,1]);
    assert.deepEqual([game._topl_curx,game._topl_cury,game._toplin],[0,0,D.TOPLINE_EMPTY]);
});
await check('omitted argument uses actual message window extent',async()=>{
    D.show_glyph_cell(70,0,'.',NO_COLOR,false,0,{kind:'cmap',cmap:CM.S_room});
    message();await D.tty_clear_nhwindow_message();assert.equal(cell().ch,'.');
});
await check('explored glyph sharing U still paints by numeric identity',async()=>{
    D.show_glyph_cell(70,0,'U',NO_COLOR,false,0,{kind:'cmap',cmap:CM.S_room});
    message();await D.tty_clear_nhwindow_message(1);assert.equal(cell().ch,'U');assert.deepEqual(cursor(),[70,1]);
},'SYMBOLS=S_room:U\n');
for(const [field,value] of [['disp_ch','Z'],['disp_color',1],['disp_glyphflags',0],['disp_customcolor',1],['disp_tileidx',1]]){
    await check('cached origin force '+field+' survives covered-row clear',async()=>{
        Object.assign(game.gbuf[0][0],{[field]:value});message();await D.tty_clear_nhwindow_message(1);
        assert.equal(cell().ch,'U');assert.deepEqual(cursor(),[79,1]);
    });
}
await check('origin identity alone does not force unknown cells',async()=>{
    game.gbuf[0][0].disp_glyphnum=0;message();await D.tty_clear_nhwindow_message(1);assert.equal(cell().ch,' ');
});
await check('empty toplin resets logical coordinates without painting',async()=>{
    message();game._toplin=D.TOPLINE_EMPTY;const before=game.nhDisplay.terminal.serialize();
    await D.tty_clear_nhwindow_message(1);assert.equal(game.nhDisplay.terminal.serialize(),before);
    assert.deepEqual([game._topl_curx,game._topl_cury],[0,0]);
});
await check('erasing screen suppresses painting but resets message state',async()=>{
    message();game._erasing_tty_screen=true;const before=game.nhDisplay.terminal.serialize();
    await D.tty_clear_nhwindow_message(1);assert.equal(game.nhDisplay.terminal.serialize(),before);
    assert.deepEqual([game._topl_curx,game._topl_cury,game._toplin],[0,0,0]);
});
await check('single-line clear preserves the entire first map row',async()=>{
    message('single');const before=structuredClone(game.nhDisplay.grid[1]);
    await D.tty_clear_nhwindow_message(0);assert.deepEqual(game.nhDisplay.grid[1],before);
    assert.deepEqual(cursor(),[0,0]);assert.equal(game._topl_curx,0);
});
await check('physical clear preserves logical history',async()=>{
    message();game._toplines='history';game._msg_history=['older'];
    await D.tty_clear_nhwindow_message(1);assert.equal(game._toplines,'history');assert.deepEqual(game._msg_history,['older']);
});
await check('special prompt is nonempty for clear',async()=>{
    message();game._toplin=D.TOPLINE_SPECIAL_PROMPT;await D.tty_clear_nhwindow_message(1);assert.equal(cell().ch,' ');
});
await check('real resetGame before level allocation is safe',async()=>{
    resetGame();game.nhDisplay=new GameDisplay(null);message();
    await D.tty_clear_nhwindow_message(1);assert.deepEqual(cursor(),[0,1]);assert.equal(game._topl_cury,0);
});
await check('tall constructed message restores status through canonical bot',async()=>{
    const before=structuredClone(game.nhDisplay.grid.slice(22));
    message('top');game._topl_cury=22;
    for(let x=0;x<80;x++)game.nhDisplay.setCell(x,22,'X',NO_COLOR,0);
    await D.tty_clear_nhwindow_message(22);assert.deepEqual(game.nhDisplay.grid.slice(22),before);
});
for(const enabled of [true,false])await check('actual async jump frame with bgcolors '+enabled,async()=>{
    game.jumping_is_magic=1;await getpos_sethilite(null,get_valid_jump_position);game.iflags.bgcolors=enabled;
    const {ux:x,uy:y}=game.u;assert.equal(await get_valid_jump_position(x,y),true);
    D.show_glyph_cell(x,y,'U',NO_COLOR,false,0,{kind:'unexplored'});
    message();game._topl_cury=y+1;await D.tty_clear_nhwindow_message(y+1);
    assert.equal(cell(x,y).ch,enabled?'U':' ');
});
for(const enabled of [true,false])await check('real kitten frame precedence with bgcolors '+enabled,async()=>{
    const pet=game.level.monsters.find(m=>m.mtame);assert.ok(pet);
    game.jumping_is_magic=1;await getpos_sethilite(null,get_valid_jump_position);game.iflags.bgcolors=enabled;
    assert.equal(await get_valid_jump_position(pet.mx,pet.my),true);
    D.newsym(pet.mx,pet.my);message();game._topl_cury=pet.my+1;
    await D.tty_clear_nhwindow_message(pet.my+1);assert.equal(cell(pet.mx,pet.my).attr,enabled?0:ATR_INVERSE);
},'OPTIONS=pettype:cat,hilite_pet\n');

for(const key of [' ','\x1b'])await check('direct unwrapped more cleanup '+JSON.stringify(key),async()=>{
    message('short');game.nhDisplay.pushKey(key.charCodeAt(0));await D.more();
    const text=game.nhDisplay.grid[0].map(c=>c.ch).join('').trimEnd();
    assert.equal(text,key===' '?'short--More--':'');assert.equal(game._toplin,D.TOPLINE_EMPTY);
    assert.deepEqual(cursor(),key===' '?[13,0]:[0,0]);
    assert.deepEqual([game._topl_curx,game._topl_cury],key===' '?[13,0]:[0,0]);
    assert.equal(!!game._win_stop,key==='\x1b');
});
for(const key of [' ','\x1b'])await check('direct wrapped more restores then homes '+JSON.stringify(key),async()=>{
    message('wrapped\nlast');game.nhDisplay.pushKey(key.charCodeAt(0));await D.more();
    assert.equal(cell().ch,' ');assert.deepEqual(cursor(),[0,0]);assert.equal(game._topl_cury,0);
});
await check('more suffix itself wraps and restores',async()=>{
    message('x'.repeat(73));game.nhDisplay.pushKey(32);await D.more();assert.equal(cell().ch,' ');assert.deepEqual(cursor(),[0,0]);
});
await check('NOSTOP prevents ESC suppression',async()=>{
    message('short');game._win_nostop=true;game.nhDisplay.pushKey(27);await D.more();assert.equal(!!game._win_stop,false);
});
await check('message display wrapper clears after unwrapped acknowledgement',async()=>{
    message('short');game.nhDisplay.pushKey(32);await D.display_nhwindow_message();
    assert.ok(game.nhDisplay.grid[0].every(c=>c.ch===' '));assert.deepEqual(cursor(),[0,0]);assert.equal(game._topl_curx,0);
});
await check('already-seen display wrapper leaves pixels and resets coordinates',async()=>{
    message('short');game._toplin=D.TOPLINE_NON_EMPTY;const before=game.nhDisplay.terminal.serialize();
    await D.display_nhwindow_message();assert.equal(game.nhDisplay.terminal.serialize(),before);assert.equal(game._topl_curx,0);
});
await check('WIN_STOP display guard leaves state untouched',async()=>{
    message();game._win_stop=true;const before=[game._toplin,game._topl_curx,game._topl_cury,game.nhDisplay.terminal.serialize()];
    await D.display_nhwindow_message();assert.deepEqual([game._toplin,game._topl_curx,game._topl_cury,game.nhDisplay.terminal.serialize()],before);
});
await check('nohistory caller awaits covered-row restoration',async()=>{
    message();game._toplin=D.TOPLINE_NON_EMPTY;await T.show_topl_nohistory('New');assert.equal(cell().ch,' ');
    assert.equal(game.nhDisplay.grid[0].slice(0,3).map(c=>c.ch).join(''),'New');
});
await check('pline propagates nohistory cleanup completion',async()=>{
    message();game._toplin=D.TOPLINE_NON_EMPTY;game.pline_flags=SUPPRESS_HISTORY;
    await D.pline('New');assert.equal(cell().ch,' ');assert.equal(game.nhDisplay.grid[0][0].ch,'N');
});
await check('wrapped yes/no cleanup adopts its async return',async()=>{
    game._toplin=D.TOPLINE_EMPTY;game.nhDisplay.pushKey(121);
    assert.equal(await T.tty_yn_function('Q'.repeat(79),null,'\0'),'y');assert.equal(cell().ch,' ');assert.equal(game._topl_cury,0);
});
await check('getlin cleanup completes before cancelled return',async()=>{
    game._toplin=D.TOPLINE_EMPTY;game.nhDisplay.pushKey(27);
    assert.equal(await hooked_tty_getlin('Q'.repeat(79),null),'\x1b');assert.equal(cell().ch,' ');assert.equal(game._topl_cury,0);
});
await check('message menu acknowledgement performs outer clear',async()=>{
    game._toplin=D.TOPLINE_EMPTY;game.nhDisplay.pushKey(97);
    assert.equal(await W.tty_message_menu('a',1,'Choose'),'a');
    assert.ok(game.nhDisplay.grid[0].every(c=>c.ch===' '));assert.equal(game.ttyDisplay.dismiss_more,0);
});

clearTimeout(timer);
const report={classification:'constructed source controls; actual helpers, no mocks or native claim',total:results.length,passed:results.filter(r=>r.pass).length,results};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:report.total,passed:report.passed,failed:results.filter(r=>!r.pass).map(r=>({name:r.name,error:r.error}))}));
if(report.passed!==report.total)process.exitCode=1;
