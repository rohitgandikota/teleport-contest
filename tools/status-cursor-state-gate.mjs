#!/usr/bin/env node
// Compare status cursor output with extracted pinned C, without replaying a game.
// The C backend checks text/cursor and field state, not ANSI attributes or core botl.
import assert from 'node:assert/strict';
import {register} from 'node:module';
import {test} from 'node:test';
import {cases} from './status-cursor-cases.mjs';
import {statusCursorOracle} from './status-cursor-c-oracle.mjs';

register('./status-cursor-state-loader.mjs',import.meta.url);
await import('../js/jsmain.js'); // Establish the port's module initialization order.
const {resetGame}=await import('../js/gstate.js');
const {Terminal}=await import('../js/terminal.js');
const C=await import('../js/const.js');
const {genl_status}=await import('../js/windows.js');
const {tty_status_init,tty_status_enablefield,tty_status_update,tty_clear_nhwindow,
    tty_get_nhwindow,reset_windows,audit_status_curs,audit_putstatusfield,
    audit_status_cl_end}=await import('../js/tty/wintty.js');
const expected=statusCursorOracle(cases);
assert.equal(expected.length,cases.length,'C oracle case count');

for(const [index,sample] of cases.entries()) test(sample.name,()=>{
    const game=resetGame();
    reset_windows();
    game.nhDisplay=new Terminal(null);
    game.iflags={wc2_statuslines:sample.rows,hilite_delta:sample.hilite||0};
    game.flags={hitpointbar:!!sample.hpbar};
    game.u={uhp:sample.critical?1:12,uhpmax:12,ulevel:1,mtimedone:0};
    game.blstats=[Array.from({length:C.MAXBLSTATS},()=>({a:0}))];
    game.blstats[0][C.BL_CAP].a=sample.enc||0;
    const masks=Array(C.BL_ATTCLR_MAX).fill(0);
    Object.assign(masks,sample.masks||{});
    tty_status_init();
    const cw=tty_get_nhwindow(game.WIN_STATUS);
    cw.cols=sample.cols;
    const update=(field,text,color=8,percent=100)=>
        tty_status_update(C[field],text,0,percent,color,masks);
    for(const field of sample.fields) {
        tty_status_enablefield(C[field.field],'test',field.fmt,true);
        update(field.field,field.text);
    }
    update('BL_FLUSH','');
    game.nhDisplay.setCursor(37,0);
    for(const action of sample.actions) {
        switch(action.op) {
        case 'update': update(action.field,action.text,action.color,action.percent);break;
        case 'flush': update('BL_FLUSH','');break;
        case 'reset': update('BL_RESET','');break;
        case 'clear': tty_clear_nhwindow(game.WIN_STATUS);break;
        case 'erasing': game._erasing_tty_screen=action.value;break;
        case 'masks': masks.fill(0);Object.assign(masks,action.value);break;
        case 'cursor': audit_status_curs(cw,action.x,action.y);break;
        case 'field': audit_putstatusfield(action.text,action.x,action.y);break;
        case 'clear-eol': audit_status_cl_end(cw,action.y);break;
        default: throw Error(`Unknown status action: ${action.op}`);
        }
    }
    const st=game._tty_status,g=genl_status(),term=game.nhDisplay;
    const actual={name:sample.name,
        cursor:[term.cursorCol,term.cursorRow,term.cursorVisible],
        windowCursor:[cw.curx,cw.cury],
        shrink:[st.cond_shrinklvl,st.enc_shrinklvl,st.dlvl_shrinklvl],
        rows:term.grid.slice(cw.offy).map(row=>row.map(cell=>cell.ch).join('')),
        fields:st.tty_status[1].flatMap((field,i)=>g.status_activefields[i]?
            [[i,field.x,field.y,field.lth,+field.dirty,+field.redraw,field.color,field.attr]]:[])};
    assert.deepEqual(actual,expected[index],sample.name);
});
