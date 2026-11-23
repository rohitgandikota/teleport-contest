#!/usr/bin/env node
// Source-derived controls. The exact caller bodies run with only I/O and RNG stubbed.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';
import {mons, NUMMONS, PMNAMES as PM} from '../js/monst_data.js';
import {def_monsyms} from '../js/drawing_data.js';
import {NO_COLOR, ATR_INVERSE as TERM_INVERSE} from '../js/terminal.js';

function extract(source, name) {
    const match = source.match(new RegExp(`(?:export )?(?:async )?function ${name}\\([^\\n]*\\) \\{[\\s\\S]*?^\\}`, 'm'));
    assert.ok(match, name);
    return match[0].replace(/^export /, '');
}
const body = name => extract(readFileSync(new URL(
    `../js/${name === 'flash_mon' ? 'mon' : name === 'you_aggravate' ? 'muse' : 'worm'}.js`, import.meta.url), 'utf8'), name);
const helper = extract(readFileSync(new URL('../js/display.js', import.meta.url), 'utf8'), 'mon_to_glyph');

function setup({hallu=false, sample=PM.PM_RED_DRAGON, visible=true, sparkle=true, symbols=true} = {}) {
    const calls = {draws:[], cells:[], flashes:[], events:[]};
    const active = [...def_monsyms];
    if (symbols) {
        active[mons[PM.PM_HUMAN].mlet] = 'Z';
        active[mons[PM.PM_LARGE_MIMIC].mlet] = 'Q';
        active[mons[PM.PM_RED_DRAGON].mlet] = 'R';
        active[mons[PM.PM_LONG_WORM_TAIL].mlet] = 'T';
    }
    const game = {mons, flags:{sparkle, use_inverse:true}, u:{ux:1, uy:1}, viz_array:[[], [], [0,0,0,4]], worms:{wheads:{}, wtails:{}}};
    const mon = {mnum:PM.PM_HUMAN, data:mons[PM.PM_HUMAN], mx:3, my:2, female:1, mtame:0};
    const show = (x,y,ch,color,decgfx,attr,glyph) => calls.cells.push({x,y,ch,color,decgfx,attr,glyph});
    const env = {
        game, NUMMONS, PMNAMES:PM, def_monsyms, NO_COLOR, TERM_INVERSE,
        IN_SIGHT:2, COULD_SEE:1, couldsee:()=>visible, Hallucination:()=>hallu,
        monsndx:ptr=>ptr.pmidx, showsym_mon:i=>active[i],
        rn2_on_display_rng:n=>{calls.draws.push(n); return sample;},
        flash_glyph_at:async(x,y,cell,count)=>calls.flashes.push({x,y,cell,count,viz:game.viz_array[y][x]}),
        newsym:(x,y)=>calls.events.push(['newsym',x,y]), show_glyph_cell:show,
        wstate:()=>game.worms, s_suffix:name=>`${name}'s`,
    };
    const context = vm.createContext(env);
    vm.runInContext(helper, context);
    env.__imports = {
        './display.js':{mon_to_glyph:env.mon_to_glyph, show_glyph_cell:show, newsym:env.newsym,
            cls:async()=>calls.events.push(['cls']), docrt:async()=>calls.events.push(['docrt']),
            pline:async text=>calls.events.push(['pline',text]), more:async()=>calls.events.push(['more']),
            canspotmon:()=>true, map_invisible:()=>{throw Error('unexpected invisible marker');}},
        './do_name.js':{noit_mon_nam:()=> 'test monster'},
        './youprop.js':{Hallucination:env.Hallucination},
        './pline.js':{You_feel:async text=>calls.events.push(['You_feel',text])},
        './trap.js':{unconscious:()=>false},
    };
    for (const name of ['flash_mon','you_aggravate','detect_wsegs']) {
        // Rebind dynamic imports to I/O stubs, leaving the function logic intact.
        vm.runInContext(body(name).replace(/import\('([^']+)'\)/g,
            (_, path)=>`Promise.resolve(__imports[${JSON.stringify(path)}])`), context);
    }
    return {env,game,mon,calls,active};
}

for (const name of ['flash_mon','you_aggravate']) {
    for (const variant of ['default','override','blank','high-bit','hallucinated','mimic']) {
        test(`${name}: ${variant} symbol and captured identity`, async()=>{
            const s=setup({hallu:variant==='hallucinated',symbols:variant!=='default'});
            if (variant==='mimic') Object.assign(s.mon, {mnum:PM.PM_LARGE_MIMIC,
                data:mons[PM.PM_LARGE_MIMIC], mappearance:PM.PM_HUMAN, m_ap_type:3});
            if (variant==='blank') s.active[s.mon.data.mlet]=' ';
            if (variant==='high-bit') s.active[s.mon.data.mlet]='\xf1';
            await s.env[name](s.mon);
            const cell=name==='flash_mon'?s.calls.flashes[0].cell:s.calls.cells[0];
            const mnum=variant==='hallucinated'?PM.PM_RED_DRAGON:s.mon.data.pmidx;
            assert.equal(cell.ch,s.active[mons[mnum].mlet]);
            assert.equal(cell.color,mons[mnum].mcolor);
            assert.deepEqual(s.calls.draws,variant==='hallucinated'?[NUMMONS]:[]);
            if (variant!=='default') {
                assert.equal(cell.glyph.mnum,mnum);
                assert.equal(cell.glyph.female,true);
                s.mon.mnum=PM.PM_LITTLE_DOG; s.mon.female=0;
                assert.equal(cell.glyph.mnum,mnum); assert.equal(cell.glyph.female,true);
            }
            if (name==='flash_mon') {
                assert.equal(s.calls.flashes[0].count,8);
                assert.equal(s.calls.flashes[0].viz,7);
                assert.equal(s.game.viz_array[2][3],4);
            }
        });
    }
}
test('flash_mon: blocked sight and sparkle retain the C count',async()=>{
    const s=setup({visible:false,sparkle:false,symbols:false});
    await s.env.flash_mon(s.mon);
    assert.equal(s.calls.flashes[0].count,2);
    assert.equal(s.game.viz_array[2][3],4);
});

for (const variant of ['default','override','detected','tame','hallucinated']) {
    test(`detect_wsegs: ${variant}, one tail identity for two segments`,()=>{
        const s=setup({hallu:variant==='hallucinated',symbols:variant!=='default'});
        Object.assign(s.mon,{wormno:1,mnum:PM.PM_LONG_WORM,data:mons[PM.PM_LONG_WORM],mtame:variant==='tame'?10:0});
        const head={wx:3,wy:2,nseg:null}, near={wx:4,wy:2,nseg:head}, far={wx:5,wy:2,nseg:near};
        s.game.worms.wheads[1]=head;s.game.worms.wtails[1]=far;
        const detected=variant==='detected';
        s.env.detect_wsegs(s.mon,detected);
        assert.equal(s.calls.cells.length,2);
        assert.deepEqual(s.calls.cells.map(c=>[c.x,c.y]),[[5,2],[4,2]]);
        const mnum=variant==='hallucinated'?PM.PM_RED_DRAGON:PM.PM_LONG_WORM_TAIL;
        assert.deepEqual(s.calls.draws,variant==='hallucinated'?[NUMMONS]:[]);
        for (const c of s.calls.cells) {
            assert.equal(c.ch,s.active[mons[mnum].mlet]);
            assert.equal(c.attr,detected?TERM_INVERSE:0);
            if (variant!=='default') {
                assert.equal(c.glyph.mnum,mnum);
                assert.equal(c.glyph.female,true);
                assert.equal(c.glyph.detected,detected);
            }
        }
    });
}
test('detect_wsegs: hallucination samples once even without a tail',()=>{
    const s=setup({hallu:true,symbols:false});s.mon.wormno=1;
    s.game.worms.wheads[1]=s.game.worms.wtails[1]={wx:3,wy:2,nseg:null};
    s.env.detect_wsegs(s.mon,false);
    assert.deepEqual(s.calls.draws,[NUMMONS]);assert.equal(s.calls.cells.length,0);
});
