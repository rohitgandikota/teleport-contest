// BEGIN mandatory canonical C preflight. Metadata only, before game imports.
import {createHash} from 'node:crypto';
import {branchAssertionErrors,recordingIntegrityErrors} from './gen-sessions/assertions.mjs';
assert.ok(process.argv.length<=3&&!process.argv[2]?.startsWith('--'));
const canonicalRoot = new URL('../', import.meta.url);
const canonicalSHA = bytes => createHash('sha256').update(bytes).digest('hex');
const canonicalRecipeBytes = readFileSync(new URL('tools/gen-sessions/recipes/row-refresh-owner.json', canonicalRoot));
assert.equal(canonicalSHA(canonicalRecipeBytes), '5ae0788985abccda96baf4e1c94106e7b6bf067c60782f11906ab7b271206351', 'unchanged recording recipe');
const canonicalRecipe = JSON.parse(canonicalRecipeBytes);
const canonicalLockBytes = readFileSync(new URL('tools/gen-sessions/evidence/row-refresh-owner/input-lock.json', canonicalRoot));
assert.equal(canonicalSHA(canonicalLockBytes), '83356d2b8cd26371560325e2da949b51f12850449c5b818fdb9007f2f249bd58', 'original final input lock');
const canonicalLock = JSON.parse(canonicalLockBytes);
assert.equal(canonicalLock.recipeSHA256, canonicalSHA(canonicalRecipeBytes));
const canonicalFields = ['name', 'seed', 'datetime', 'nethackrc', 'moves'];
assert.deepEqual(canonicalLock.tupleFields, canonicalFields);
const canonicalTuples = canonicalRecipe.segments.map(s => canonicalFields.map(field => ({field, present:Object.hasOwn(s,field), value:s[field]})));
assert.equal(canonicalSHA(JSON.stringify(canonicalTuples)), 'eb01f6a7f477cb0c5214ce900b7935b5c8c733cae375a0053804d50584a962af');
assert.equal(canonicalLock.tupleSHA256, canonicalSHA(JSON.stringify(canonicalTuples)));
assert.equal(canonicalLock.cases, 7);
assert.equal(canonicalLock.keys, 158);
assert.equal(canonicalLock.boundaries, 165);
assert.equal(canonicalRecipe.requireBranchAssertions, true);
assert.equal(canonicalRecipe.segments.length, 7);
assert.equal(canonicalRecipe.branches.length, 7);
assert.equal(canonicalRecipe.branchAssertions.length, 7);
assert.deepEqual(canonicalRecipe.branchAssertions.map(a => a.segment), [0, 1, 2, 3, 4, 5, 6]);
const canonicalBytes = readFileSync(new URL('tools/gen-sessions/generated/row-refresh-owner.session.json', canonicalRoot));
assert.equal(canonicalSHA(canonicalBytes), '7b1be02ec8062856a39860d4095c0ffdb5a25be97fdf5cdd7f01a3330e1587cf', 'locked canonical C raw');
assert.equal(canonicalBytes.length, 969822);
const canonicalNative = JSON.parse(canonicalBytes);
assert.equal(canonicalNative.source, 'c');
assert.equal(canonicalNative.version, 5);
assert.equal(canonicalNative.segments.length, 7);
assert.deepEqual(recordingIntegrityErrors(canonicalNative), [], 'canonical recording integrity');
assert.deepEqual(branchAssertionErrors(canonicalRecipe, canonicalNative), [], 'all seven original primary branches');
for (let i = 0; i < 7; i++) {
    const actual = canonicalNative.segments[i], expected = canonicalRecipe.segments[i];
    for (const field of canonicalFields) {
        assert.ok(Object.hasOwn(expected, field), `recipe field presence ${i} ${field}`);
        assert.equal(Object.hasOwn(actual, field), Object.hasOwn(expected, field), `C field presence ${i} ${field}`);
        assert.deepEqual(actual[field], expected[field], `C field value ${i} ${field}`);
    }
    assert.deepEqual(canonicalLock.segments[i], {name:expected.name, keys:expected.moves.length, tupleSHA256:canonicalSHA(JSON.stringify(canonicalTuples[i]))});
    assert.deepEqual(actual.steps.map(step => step.key), [null, ...expected.moves], `every C key ${i}`);
}
assert.equal(canonicalRecipe.segments.reduce((n,s) => n + s.moves.length, 0), 158);
assert.equal(canonicalNative.segments.reduce((n,s) => n + s.steps.length, 0), 165);
// END mandatory canonical C preflight.
// Constructed controls on real generated games and real owners. No native claim.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
const {runSegment} = await import('../js/jsmain.js');
const {InMemoryStorage} = await import('../js/storage.js');
const rowRefreshState = await import('../js/gstate.js');
let game = rowRefreshState.game;
const D = await import('../js/display.js');
const G = await import('../js/getpos.js');
const W = await import('../js/tty/wintty.js');
const {get_valid_jump_position} = await import('../js/apply.js');
const {cmap_names:CM} = await import('../js/drawing_data.js');
const {GLYPH_UNEXPLORED_OFF,MG_UNEXPL,HI_ZAP} = await import('../js/const.js');
const {NO_COLOR,ATR_INVERSE} = await import('../js/terminal.js');
const {outputs,hashes} = await import('./half-damage-reader-observe.mjs');

assert.ok(process.argv.length<=3&&!process.argv[2]?.startsWith('--'));
const recipe=JSON.parse(readFileSync(new URL('gen-sessions/recipes/row-refresh-owner.json',import.meta.url)));
const results=[],timer=setTimeout(()=>process.exit(2),55000);
const p=[70,0],screen=()=>game.nhDisplay.grid[p[1]+1][p[0]-1];
const unknown=()=>D.show_glyph_cell(...p,'U',NO_COLOR,false,0,{kind:'unexplored'});
const mark=()=>game.nhDisplay.setCell(p[0]-1,p[1]+1,'X',NO_COLOR,0);
const refresh=()=>D.row_refresh(p[0],p[0],p[1]);
async function fresh(part=recipe.segments[0]){
    const run=await runSegment({...part,moves:'',storage:new InMemoryStorage()});
    game = rowRefreshState.game;
    // Clear a prior held target callback through its real public owner.
    await G.getpos_sethilite(null,null);
    return run;
}
async function check(name,fn,part){
    let run;
    const result={name,classification:'constructed source control'};
    try{run=await fresh(part);const before=hashes(outputs(run));await fn();
        result.beforeRNG=before.calls;result.afterRNG=hashes(outputs(run)).calls;
        assert.equal(result.afterRNG,result.beforeRNG,'display-only source control draws no gameplay RNG');result.pass=true;
    }catch(e){result.pass=false;result.error=e.message.slice(0,700);}
    results.push(result);
}

await check('configured U is skipped by numeric unexplored identity',async()=>{unknown();mark();await refresh();assert.equal(screen().ch,'X');});
await check('origin exists with canonical cached null metadata',()=>{
    const o=D.gbuf_at(0,0);assert.ok(o);assert.equal(o.disp_ch,' ');assert.equal(o.disp_color,NO_COLOR);
    assert.equal(o.disp_glyphflags,MG_UNEXPL);assert.equal(o.disp_customcolor,0);assert.equal(o.disp_tileidx,0);
});
await check('show glyph column zero is silent and preserves origin',()=>{
    const before=structuredClone(D.gbuf_at(0,0));D.show_glyph_cell(0,0,'Q',1,false,0,{kind:'cmap',cmap:CM.S_room});
    assert.deepEqual(D.gbuf_at(0,0),before);
});
for(const [field,value] of [['disp_ch','Z'],['disp_color',1],['disp_glyphflags',0],['disp_customcolor',1],['disp_tileidx',1]]){
    await check('force cached origin '+field,async()=>{
        const row=(game.gbuf[0] ||= []);row[0]={disp_ch:' ',disp_color:NO_COLOR,disp_glyphflags:MG_UNEXPL,disp_customcolor:0,disp_tileidx:0,[field]:value};
        unknown();mark();await refresh();assert.equal(screen().ch,'U');
    });
    await check('clear cached origin '+field+' resets all cells',()=>{
        const row=(game.gbuf[0] ||= []);row[0]={disp_ch:' ',disp_color:NO_COLOR,disp_glyphflags:MG_UNEXPL,disp_customcolor:0,disp_tileidx:0,[field]:value};
        D.clear_glyph_buffer();
        assert.equal(game.gbuf.length,21);assert.ok(game.gbuf.every(r=>r.length===80));
        for(const r of game.gbuf)for(const g of r){assert.equal(g.disp_ch,' ');assert.equal(g.disp_color,NO_COLOR);
            assert.equal(g.disp_glyphnum,GLYPH_UNEXPLORED_OFF);assert.equal(g.disp_glyphflags,MG_UNEXPL);assert.equal(g.gnew,1);}
    });
}
await check('origin glyph identity alone does not force',async()=>{
    (game.gbuf[0] ||= [])[0]={disp_ch:' ',disp_color:NO_COLOR,disp_glyphflags:MG_UNEXPL,disp_customcolor:0,disp_tileidx:0,disp_glyphnum:0};
    unknown();mark();await refresh();assert.equal(screen().ch,'X');
});
await check('clear clean origin leaves null glyphs clean',()=>{
    D.clear_glyph_buffer();D.clear_glyph_buffer();assert.ok(game.gbuf.every(r=>r.every(g=>g.gnew===0)));
});
await check('explored U is repainted even though same printed character',async()=>{
    D.show_glyph_cell(...p,'U',NO_COLOR,false,0,{kind:'cmap',cmap:CM.S_room});mark();await refresh();assert.equal(screen().ch,'U');
},recipe.segments[2]);
await check('configured bgcolors defaults on in iflags',()=>assert.equal(game.iflags.bgcolors,true));
await check('rc bgcolors negation uses iflags',()=>assert.equal(game.iflags.bgcolors,false),recipe.segments[4]);
await check('mapxy_valid without validator is false',async()=>assert.equal(await G.mapxy_valid(...p),false));
await check('frame initial state and null callback follow C',()=>assert.equal(game.wsettings.map_frame_color,NO_COLOR));

async function jumpValidator(){game.jumping_is_magic=1;game.iflags.bgcolors=true;await G.getpos_sethilite(null,get_valid_jump_position);}
await check('real async jump validator drives frame producer',async()=>{
    await jumpValidator();assert.equal(game.wsettings.map_frame_color,HI_ZAP);
    assert.equal(await G.mapxy_valid(game.u.ux,game.u.uy),true);assert.equal(await G.mapxy_valid(...p),false);
});
await check('valid async frame restores a cached unexplored cell',async()=>{
    await jumpValidator();const {ux:x,uy:y}=game.u;
    D.show_glyph_cell(x,y,'U',NO_COLOR,false,0,{kind:'unexplored'});
    game.nhDisplay.setCell(x-1,y+1,'X',NO_COLOR,0);
    await D.row_refresh(x,x,y);assert.equal(game.nhDisplay.grid[y+1][x-1].ch,'U');
});
await check('invalid async frame leaves unexplored blanked',async()=>{
    await jumpValidator();unknown();mark();await refresh();assert.equal(screen().ch,'X');
});
await check('disabled bgcolors does not substitute a frame',async()=>{
    await jumpValidator();game.iflags.bgcolors=false;
    const {ux:x,uy:y}=game.u;D.show_glyph_cell(x,y,'U',NO_COLOR,false,0,{kind:'unexplored'});
    game.nhDisplay.setCell(x-1,y+1,'X',NO_COLOR,0);await D.row_refresh(x,x,y);assert.equal(game.nhDisplay.grid[y+1][x-1].ch,'X');
});
await check('NO_COLOR frame does not paint an unexplored valid target',async()=>{
    await jumpValidator();game.wsettings.map_frame_color=NO_COLOR;
    const {ux:x,uy:y}=game.u;D.show_glyph_cell(x,y,'U',NO_COLOR,false,0,{kind:'unexplored'});
    game.nhDisplay.setCell(x-1,y+1,'X',NO_COLOR,0);await D.row_refresh(x,x,y);assert.equal(game.nhDisplay.grid[y+1][x-1].ch,'X');
});
await check('zero-valued frame color remains a real frame',async()=>{
    await jumpValidator();game.wsettings.map_frame_color=0;
    const {ux:x,uy:y}=game.u;D.show_glyph_cell(x,y,'U',NO_COLOR,false,0,{kind:'unexplored'});
    game.nhDisplay.setCell(x-1,y+1,'X',NO_COLOR,0);await D.row_refresh(x,x,y);assert.equal(game.nhDisplay.grid[y+1][x-1].ch,'U');
});
await check('unchanged callback color change forces cached valid locations',async()=>{
    await jumpValidator();await D.flush_screen(0);game.wsettings.map_frame_color=NO_COLOR;
    await G.getpos_sethilite(null,get_valid_jump_position);
    assert.equal(game.wsettings.map_frame_color,HI_ZAP);assert.equal(D.gbuf_at(game.u.ux,game.u.uy).gnew,1);
});
await check('removing validator refreshes its old selection',async()=>{
    await jumpValidator();await D.flush_screen(0);await G.getpos_sethilite(null,null);
    assert.equal(game.wsettings.map_frame_color,HI_ZAP);assert.equal(await G.mapxy_valid(game.u.ux,game.u.uy),false);
    assert.equal(D.gbuf_at(game.u.ux,game.u.uy).gnew,1);
});
for(const color of [true,false])await check('frame precedence over real pet inverse, color '+color,async()=>{
    await jumpValidator();game.flags.color=color;
    const pet=game.level.monsters.find(m=>m.mtame);assert.ok(pet);
    assert.equal(await get_valid_jump_position(pet.mx,pet.my),true);
    D.newsym(pet.mx,pet.my);await D.row_refresh(pet.mx,pet.mx,pet.my);
    assert.equal(game.nhDisplay.grid[pet.my+1][pet.mx-1].attr,color?0:ATR_INVERSE);
},recipe.segments[5]);
await check('async corner dismissal finishes before returning selection',async()=>{
    await jumpValidator();unknown();game._toplin=0;
    const w=W.tty_create_nhwindow(W.NHW_MENU);W.tty_start_menu(w,0);
    W.tty_add_menu(w,null,1,'a',0,0,NO_COLOR,'a long enough corner item',0);W.tty_end_menu(w,'Corner');
    game.nhDisplay.pushKey(32);await W.tty_select_menu(w,0);
    assert.equal(W.tty_get_nhwindow(w).active,0);assert.equal(screen().ch,' ');
    assert.equal(W.tty_destroy_nhwindow(w),undefined);assert.equal(W.tty_get_nhwindow(w),undefined);
});

await check('destroying an active corner window awaits the real validator',async()=>{
    await jumpValidator();unknown();game._toplin=0;
    const w=W.tty_create_nhwindow(W.NHW_MENU);W.tty_putstr(w,0,'a long enough corner text');
    game.nhDisplay.pushKey(32);await W.tty_display_nhwindow(w);
    assert.equal(W.tty_get_nhwindow(w).active,1);
    const pending=W.tty_destroy_nhwindow(w);assert.ok(pending instanceof Promise);
    assert.ok(W.tty_get_nhwindow(w));await pending;assert.equal(W.tty_get_nhwindow(w),undefined);
    assert.equal(screen().ch,' ');
});
await check('inactive window destruction stays synchronous',()=>{
    const w=W.tty_create_nhwindow(W.NHW_MENU);
    assert.equal(W.tty_destroy_nhwindow(w),undefined);assert.equal(W.tty_get_nhwindow(w),undefined);
});
await check('final rundown preserves the active window contents',async()=>{
    game._toplin=0;const w=W.tty_create_nhwindow(W.NHW_MENU);W.tty_putstr(w,0,'rundown corner text');
    game.nhDisplay.pushKey(32);await W.tty_display_nhwindow(w);
    const before=game.nhDisplay.terminal.serialize();game.iflags.window_inited=false;
    await W.tty_destroy_nhwindow(w);assert.equal(game.nhDisplay.terminal.serialize(),before);
});
await check('constructed short corner page preserves left margin and status',async()=>{
    await jumpValidator();game._toplin=0;
    const w=W.tty_create_nhwindow(W.NHW_MENU);W.tty_start_menu(w,0);
    for(let i=0;i<24;i++)W.tty_add_menu(w,null,i+1,0,0,0,NO_COLOR,'page entry '+i,0);
    W.tty_end_menu(w,null);
    const cw=W.tty_get_nhwindow(w);
    // Normal fixed24-row paging is full-screen. This only constructs C's corner arm.
    cw.maxrow=23;await W.tty_display_nhwindow(w);assert.ok(cw.offx>0);
    const repaintX=cw.offx+2;
    D.show_glyph_cell(repaintX,10,'.',NO_COLOR,false,0,{kind:'cmap',cmap:CM.S_room});
    game.nhDisplay.setCell(cw.offx-1,10,'X',NO_COLOR,0);game.disp.botlx=false;
    assert.equal(await W.tty_next_page(w),true);
    assert.equal(game.nhDisplay.grid[11][repaintX-1].ch,'.','shorter page restores cached explored terrain');
    assert.equal(game.nhDisplay.grid[10][cw.offx-1].ch,'X','nonzero docorner start does not clear the margin');
    assert.equal(game.disp.botlx,false,'between-page restore does not redraw status');
    assert.equal(await W.tty_next_page(w),false);assert.equal(await W.tty_prev_page(w),true);
    await W.tty_destroy_nhwindow(w);
});
await check('frame repaint respects dirty bounds and resets them',async()=>{
    await jumpValidator();await D.flush_screen(0);
    const {ux:x,uy:y}=game.u;
    const valid=[];for(let k=1;k<80;k++)if(await get_valid_jump_position(k,y))valid.push(k);
    assert.ok(valid.length>=3);const left=valid[0],right=valid.at(-1),middle=valid[1];
    const expected=D.gbuf_at(middle,y).disp_ch;
    game.nhDisplay.setCell(middle-1,y+1,'X',NO_COLOR,0);
    D.newsym_force(left,y);D.newsym_force(right,y);
    assert.deepEqual([game.gbuf_start[y],game.gbuf_stop[y]],[left,right]);
    await D.flush_screen(0);assert.equal(game.nhDisplay.grid[y+1][middle-1].ch,expected);
    assert.deepEqual([game.gbuf_start[y],game.gbuf_stop[y]],[79,0]);
    game.nhDisplay.setCell(x-1,y+1,'X',NO_COLOR,0);await D.flush_screen(0);
    assert.equal(game.nhDisplay.grid[y+1][x-1].ch,'X','an empty bbox does not repaint valid frames');
});

clearTimeout(timer);
const report={classification:'constructed controls using real generated games and owners; no native claim',total:results.length,passed:results.filter(x=>x.pass).length,results};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({total:report.total,passed:report.passed,failed:results.filter(x=>!x.pass).map(x=>({name:x.name,error:x.error}))}));
if(report.passed!==report.total)process.exitCode=1;
