import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {root, load, nativePreflight, legacyPrimaryErrors} from './preflight.mjs';

// Load through the real entry point so its existing module wiring is active.
await import('../js/jsmain.js');
const O = await import('../js/options.js');
const S = await import('../js/gstate.js');
const T = await import('../js/tty/wintty.js');
const {GameDisplay} = await import('../js/game_display.js');
const {tty_init_nhwindows} = await import('../js/plselect.js');
const {pline} = await import('../js/display.js');
const {NO_COLOR} = await import('../js/terminal.js');
const {PICK_ONE, PICK_ANY, MENU_ITEMFLAGS_SELECTED, MENU_ITEMFLAGS_SKIPINVERT} = await import('../js/const.js');
const {def_oc_syms} = await import('../js/drawing_data.js');
const rows = [];
const check = async (name, body) => {
    try { await body(); rows.push({name,pass:true}); }
    catch (error) { rows.push({name,pass:false,error:error.message.slice(0,700)}); }
};
function reset() {
    const g = S.resetGame(); T.reset_windows();
    g.nhDisplay = new GameDisplay(null);
    g.nhDisplay.onEmptyQueue = () => { throw new Error('Source control exhausted its locked keys'); };
    g.flags = {}; g.program_state = {}; g.u = {ux:0,uy:0};
    return g;
}
const text = () => S.game.nhDisplay.grid.map(row => row.map(c => c.ch).join('')).join('\n');
const commands = [
    ['menu_next_page','>'], ['menu_previous_page','<'], ['menu_first_page','^'],
    ['menu_last_page','|'], ['menu_select_all','.'], ['menu_invert_all','@'],
    ['menu_deselect_all','-'], ['menu_select_page',','], ['menu_invert_page','~'],
    ['menu_deselect_page','\\'], ['menu_search',':'], ['menu_shift_right','}'], ['menu_shift_left','{'],
];
for (const [name, cmd] of commands) await check(`producer/both/${name}`, () => {
    reset(); const bind = O.parseNethackrc(`BINDINGS=;:${name}\n`);
    assert.deepEqual(bind.errors, []); assert.equal(S.game.n_menu_mapped, 1);
    assert.equal(O.map_menu_cmd(';'), cmd); assert.equal(O.get_menu_cmd_key(cmd), ';');
    reset(); const option = O.parseNethackrc(`OPTIONS=${name}:;\n`);
    assert.deepEqual(option.errors, []); assert.equal(S.game.n_menu_mapped, 1);
    assert.equal(O.map_menu_cmd(';'), cmd); assert.equal(O.get_menu_cmd_key(cmd), ';');
});
await check('producer/byte-key-not-reencoded', () => {
    reset(); assert.deepEqual(O.parseNethackrc('BINDINGS=\\é:menu_select_all\n').errors, []);
    assert.equal(O.map_menu_cmd('\xc3'), '.'); assert.equal(O.map_menu_cmd('\xe9'), '\xe9');
});
await check('producer/ordered-duplicates-and-first-reverse', () => {
    reset(); O.parseNethackrc('BINDINGS=;:menu_select_all\nBINDINGS=;:menu_search\nBINDINGS=#:menu_select_all\n');
    assert.equal(S.game.n_menu_mapped, 3); assert.equal(S.game.mapped_menu_cmds, ';;#');
    assert.equal(O.map_menu_cmd(';'), '.'); assert.equal(O.get_menu_cmd_key('.'), ';');
});
await check('producer/right-to-left-and-no-recursive-map', () => {
    reset(); O.parseNethackrc('BINDINGS=;:menu_select_all,;:menu_search\n');
    assert.equal(O.map_menu_cmd(';'), ':'); assert.equal(S.game.mapped_menu_op, ':.');
    reset(); const r = O.parseNethackrc('BINDINGS=;:menu_invert_all\nBINDINGS=@:menu_search\n');
    assert.deepEqual(r.errors, []);
    assert.equal(O.map_menu_cmd(';'), '@'); assert.equal(O.map_menu_cmd('@'), ':');
});
await check('producer/OPTIONS-full-name-ASCII-case', () => {
    reset(); assert.deepEqual(O.parseNethackrc('OPTIONS=MENU_SELECT_ALL:;\n').errors, []);
    assert.equal(O.map_menu_cmd(';'), '.');
    reset(); O.parseNethackrc('OPTIONS=menu_select_a:;\n'); assert.equal(S.game.n_menu_mapped, 0);
});
await check('producer/BINDINGS-case-sensitive', () => {
    reset(); const r = O.parseNethackrc('BINDINGS=;:MENU_SELECT_ALL\n');
    assert.equal(S.game.n_menu_mapped, 0); assert.ok(r.errors.includes("Unknown key binding command 'MENU_SELECT_ALL'"));
});
await check('producer/reserved-key-errors-and-no-output', () => {
    for (const [key, shown] of [['a','a'],['Z','Z'],['1','1'],['<space>',' '],['<esc>','^['],['<enter>','^J']]) {
        reset(); const r = O.parseNethackrc(`BINDINGS=${key}:menu_select_all\n`);
        assert.equal(S.game.n_menu_mapped, 0, key);
        assert.deepEqual(r.errors, [`Reserved menu command key '${shown}'`,`Bad menu key ${shown}:menu_select_all`], key);
        assert.ok(!text().trim());
    }
});
await check('producer/object-class-reservations', () => {
    for (const key of def_oc_syms.slice(1)) {
        reset(); const r = O.parseNethackrc(`BINDINGS=${key}:menu_search\n`);
        assert.equal(S.game.n_menu_mapped, 0, key);
        if (/^[0-9]$/.test(key)) assert.ok(r.errors[0].startsWith('Reserved menu command key'));
        else assert.equal(r.errors[0], `Menu command key '${key}' is an object class`);
    }
});
await check('producer/legal-punctuation-control-and-meta', () => {
    for (const [key, decoded] of [[';',';'],['#','#'],['@','@'],['^A','\x01'],['M-;','\xbb'],['\\,',',']]) {
        reset(); const r = O.parseNethackrc(`BINDINGS=${key}:menu_search\n`);
        assert.deepEqual(r.errors, [], key); assert.equal(O.map_menu_cmd(decoded), ':', key);
    }
});
await check('producer/unknown-key-preserves-error-owner', () => {
    reset(); assert.deepEqual(O.parseNethackrc('BINDINGS=bogus:menu_search\n').errors, ["Unknown key binding key 'bogus'"]);
    assert.equal(S.game.n_menu_mapped, 0); assert.ok(!text().trim());
});
await check('producer/OPTIONS-missing-empty-and-invalid-key', () => {
    for (const input of ['menu_search','menu_search:']) {
        reset(); const r = O.parseNethackrc(`OPTIONS=${input}\n`);
        assert.deepEqual(r.errors,[`Missing parameter for '${input}'`]); assert.equal(S.game.n_menu_mapped,0);
    }
    reset(); assert.deepEqual(O.parseNethackrc('OPTIONS=menu_search:a\n').errors,["Reserved menu command key 'a'"]);
});
await check('producer/unrelated-config-error-collection-unchanged', () => {
    reset(); const r = O.parseNethackrc('OPTIONS=unknown_menu_probe\nBINDINGS=bogus:inventory\n');
    assert.deepEqual(r.errors,["Unknown option 'unknown_menu_probe'","Unknown key binding key 'bogus'"]);
    assert.ok(!text().trim()); assert.equal(S.game.n_menu_mapped,0);
});
await check('state/reset-clears-store-and-base-position', () => {
    reset(); O.parseNethackrc('BINDINGS=;:menu_search\n'); T.tty_curs_base(12,9);
    reset(); assert.equal(S.game.n_menu_mapped,0); assert.equal(S.game.mapped_menu_cmds,'');
    assert.equal(S.game.mapped_menu_op,''); assert.equal(O.map_menu_cmd(';'),';');
    assert.deepEqual(T.tty_base_pos(),{x:0,y:0});
});
await check('help/first-alias-visctrl-both-formats', () => {
    reset(); O.parseNethackrc('BINDINGS=^A:menu_select_all\nBINDINGS=;:menu_select_all\n');
    const compact=[], columns=[];
    O.show_menu_controls(s=>compact.push(s),true); O.show_menu_controls(s=>columns.push(s),false);
    assert.ok(compact.includes('^A      Select all items in entire menu'));
    assert.ok(columns.includes('  Select     ^A     ,'));
    assert.ok(!compact.some(s=>s.includes('Pan current')));
});
await check('early/32-append-33-synchronous-raw-no-parser-error', async () => {
    reset(); S.game.iflags.last_msg=99;
    const r=O.parseNethackrc('BINDINGS=;:menu_select_all\n'.repeat(32)+'BINDINGS=#:menu_search\n');
    assert.deepEqual(r.errors,[]); assert.equal(S.game.n_menu_mapped,32);
    assert.equal(O.map_menu_cmd('#'),'#'); assert.equal(O.map_menu_cmd(';'),'.');
    const before=text(); assert.equal(before.split('\n')[0].trimEnd(),'out of menu map space.');
    assert.deepEqual(T.tty_base_pos(),{x:0,y:1}); assert.equal(S.game.iflags.last_msg,0);
    assert.equal(S.game._prevmsg,undefined); assert.equal(S.game._toplines,undefined);
    await Promise.resolve(); await Promise.resolve(); assert.equal(text(),before);
    tty_init_nhwindows(); assert.ok(!text().includes('out of menu map space.'));
});
await check('early/no-MSGTYPE-stop-or-suppression-before-windows', async () => {
    reset(); O.parseNethackrc('MSGTYPE=hide "out of menu map space."\n');
    const pending=pline('out of menu map space.');
    try {
        assert.equal(text().split('\n')[0].trimEnd(),'out of menu map space.');
        assert.equal(S.game._prevmsg,undefined);
    } finally { await pending; }
});

async function menu(rc, keys, how=PICK_ANY, entries=null) {
    reset(); O.parseNethackrc(rc);
    const win=T.tty_create_nhwindow(T.NHW_MENU); T.tty_start_menu(win,0);
    for (const e of entries || [{id:1,key:'a',text:'first'},{id:2,key:'b',text:'second'}])
        T.tty_add_menu(win,null,e.id,e.key,e.group||0,0,NO_COLOR,e.text,e.flags||0);
    T.tty_end_menu(win,null);
    for (const key of keys) S.game.nhDisplay.pushKey(key.charCodeAt(0));
    const picks=await T.tty_select_menu(win,how);
    const result={picks:[...picks],cancelled:picks.cancelled,counts:[...(picks.counts||[])],page:T.tty_get_nhwindow(win).curr_page};
    await T.tty_destroy_nhwindow(win); return result;
}
await check('consumer/alias-select-invert-deselect-reuses-actions', async () => {
    const rc='BINDINGS=;:menu_select_all,#:menu_invert_all,~:menu_deselect_all\n';
    assert.deepEqual((await menu(rc,';\n')).picks,[1,2]);
    assert.deepEqual((await menu(rc,';#\n')).picks,[]);
    assert.deepEqual((await menu(rc,';~\n')).picks,[]);
});
await check('consumer/explicit-selector-before-alias', async () => {
    const es=[{id:1,key:';',text:'explicit'},{id:2,key:'b',text:'second'}];
    assert.deepEqual((await menu('BINDINGS=;:menu_select_all\n',';\n',PICK_ANY,es)).picks,[1]);
});
await check('consumer/PICK_ONE-group-before-alias', async () => {
    const es=[{id:1,key:'a',group:';',text:'first'},{id:2,key:'b',text:'second'}];
    assert.deepEqual((await menu('BINDINGS=;:menu_search\n',';',PICK_ONE,es)).picks,[1]);
});
await check('consumer/PICK_ANY-alias-before-group', async () => {
    const es=[{id:1,key:'a',group:';',text:'first'},{id:2,key:'b',text:'second'}];
    assert.deepEqual((await menu('BINDINGS=;:menu_select_all\n',';\n',PICK_ANY,es)).picks,[1,2]);
});
await check('consumer/invalid-input-preserves-count', async () => {
    const r=await menu('BINDINGS=;:menu_select_all\n','3?b\n');
    assert.deepEqual(r.picks,[2]); assert.deepEqual(r.counts,[[2,3]]);
});
await check('consumer/cancel-count-then-cancel-menu', async () => {
    assert.equal((await menu('BINDINGS=;:menu_select_all\n',';3\x1b\x1b')).cancelled,true);
});
await check('consumer/preselected-PICK_ONE-return-contract', async () => {
    const es=[{id:1,key:'a',text:'first'},{id:-2,key:'*',text:'random',flags:MENU_ITEMFLAGS_SELECTED}];
    assert.deepEqual((await menu('','a',PICK_ONE,es)).picks,[1,-2]);
    assert.deepEqual((await menu('','*',PICK_ONE,es)).picks,[]);
    assert.equal((await menu('','\x1b',PICK_ONE,es)).cancelled,true);
});
await check('consumer/default-and-explicit-negatives', async () => {
    assert.deepEqual((await menu('','.\n')).picks,[1,2]);
    assert.deepEqual((await menu('','a\n')).picks,[1]);
    assert.deepEqual((await menu('','#\n')).picks,[]);
});
await check('consumer/pagination-and-page-actions', async () => {
    const entries=Array.from({length:25},(_,i)=>({id:i+1,key:0,text:`entry ${i+1}`}));
    const rc='BINDINGS=;:menu_next_page,#:menu_select_page,@:menu_previous_page\n';
    const r=await menu(rc,';#@\n',PICK_ANY,entries);
    assert.deepEqual(r.picks,[24,25]); assert.equal(r.page,0);
});
await check('consumer/skipinvert-preserved', async () => {
    const es=[{id:1,key:'a',text:'first',flags:MENU_ITEMFLAGS_SKIPINVERT},{id:2,key:'b',text:'second'}];
    assert.deepEqual((await menu('BINDINGS=;:menu_select_all\n',';\n',PICK_ANY,es)).picks,[2]);
});
await check('consumer/search-alias-uses-actual-line-reader', async () => {
    assert.deepEqual((await menu('BINDINGS=;:menu_search\n',';second\n',PICK_ONE)).picks,[2]);
});
await check('consumer/pan-alias-has-no-standard-TTY-action', async () => {
    assert.deepEqual((await menu('BINDINGS=;:menu_shift_right\n',';\n')).picks,[]);
});
const report={classification:'Constructed source controls, separate from ordinary reach',
    runtime:load('source/runtime.json'),nativePreflight,legacyPrimaryErrors,total:rows.length,
    passed:rows.filter(r=>r.pass).length,rows};
const path=process.argv[2]; assert.ok(path,'report path required');
writeFileSync(path,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({total:report.total,passed:report.passed,failures:rows.filter(r=>!r.pass)}));
if(report.passed!==report.total)process.exitCode=1;
