#!/usr/bin/env node
// C-derived parser controls. Native gameplay output has a separate reach check.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {register} from 'node:module';
import {decodeScreen} from '../frozen/screen-decode.mjs';
import {game,resetGame} from '../js/gstate.js';

register('./petattr-options-state-loader.mjs', import.meta.url);
const {runSegment} = await import('../js/jsmain.js');
const {InMemoryStorage} = await import('../js/storage.js');
const {allopt,findOption} = await import('../js/optlist.js');
const {parseNethackrc,boolean_option,audit_parse,audit_set_bool,
    audit_bool_effects,audit_option_value,audit_reset_visuals} = await import('../js/options.js');
const {CLR_BROWN,ATR_UNDERLINE,ATR_INVERSE,ATR_BOLD} = await import('../js/terminal.js');

function setup(attr=7,hilite=false) {
    resetGame();game.flags={hilite_pet:hilite};game.iflags={wc2_petattr:attr};
    game.opt_need_redraw=false;
}
const state=()=>({attr:game.iflags.wc2_petattr,hilite:boolean_option('hilite_pet'),
    redraw:!!game.opt_need_redraw});

for(const [value,expected] of [
    ['none',0],['bold',1],['dim',2],['italic',3],['underline',4],['blink',5],['inverse',7],
    ['normal',0],['uline',4],['reverse',7],[' B_O-l D',1],['r-e_v e r_s-e',7],
]) test(`petattr parser: ${JSON.stringify(value)}`,()=>{
    setup(4,false);
    const {accepted,result}=audit_parse(`petattr:${value}`);
    assert.equal(accepted,true);assert.deepEqual(result.errors,[]);
    assert.deepEqual(state(),{attr:expected,hilite:expected!==0,redraw:false});
    assert.equal(result.opts.hilite_pet,expected!==0);
    assert.equal(result.opts.petattr,undefined);
    assert.deepEqual(result.optSetInConfig,{petattr:true});
});

for(const value of ['bo','7','bold&inverse','bold,underline','bold extra','\tbold']) {
    test(`invalid pet attribute preserves state: ${JSON.stringify(value)}`,()=>{
        setup(4,true);
        // During play a comma remains part of this one attribute value.
        const {accepted,result}=audit_parse(`petattr:${value}`,false);
        assert.equal(accepted,false);
        assert.deepEqual(result.errors,[`Unknown petattr parameter 'petattr:${value}'`]);
        assert.deepEqual(state(),{attr:4,hilite:true,redraw:false});
        assert.deepEqual(result.opts,{});assert.equal(result.optSetInConfig,undefined);
    });
}

for(const name of ['peta','petat','petatt','PETATTR']) test(`canonical prefix ${name}`,()=>{
    setup();const {accepted,result}=audit_parse(`${name}=uline`);
    assert.equal(accepted,true);assert.deepEqual(result.errors,[]);
    assert.deepEqual(state(),{attr:4,hilite:true,redraw:false});
});

for(const text of ['pe:bold','hilite_p:yes','petattrx:bold']) test(`unmatched prefix ${text}`,()=>{
    setup(4,true);const {accepted,result}=audit_parse(text);
    assert.equal(accepted,false);
    assert.deepEqual(result.errors,[`Unknown option '${text}'`]);
    assert.deepEqual(state(),{attr:4,hilite:true,redraw:false});
});

test('pet remains the exact alias for pettype',()=>{
    setup();const {accepted,result}=audit_parse('pet:dog');
    assert.equal(accepted,true);assert.equal(result.opts.pettype,'dog');
    assert.deepEqual(state(),{attr:7,hilite:false,redraw:false});
});

for(const text of ['!petattr','nopetattr','no-peta:inverse','!petattr:bold']) {
    test(`option table rejects petattr negation: ${text}`,()=>{
        setup(4,true);const {accepted,result}=audit_parse(text);
        assert.equal(accepted,false);
        assert.deepEqual(result.errors,['The petattr option may not both have a value and be negated.']);
        assert.deepEqual(state(),{attr:4,hilite:true,redraw:false});
    });
}
test('stacked negations cancel before the table check',()=>{
    setup();const {accepted,result}=audit_parse('!no-peta:bold');
    assert.equal(accepted,true);assert.deepEqual(result.errors,[]);
    assert.deepEqual(state(),{attr:1,hilite:true,redraw:false});
});

for(const initial of [true,false])for(const attr of [0,4]) {
    test(`missing parameter still updates highlight, initial=${initial}, attr=${attr}`,()=>{
        for(const text of ['petattr','petattr:','petattr=','petattr:   ']) {
            setup(attr,attr===0);
            const {accepted,result}=audit_parse(text,initial);
            assert.equal(accepted,true,'C optfn_petattr keeps optn_ok despite string_for_opt error');
            assert.deepEqual(result.errors,[`Missing parameter for '${text.trim()}'`]);
            assert.deepEqual(state(),{attr,hilite:attr!==0,redraw:!initial});
        }
    });
}

for(const [value,enabled] of [
    ['t',true],['TRU',true],['true',true],['y',true],['yes',true],['ON',true],
    ['1',true],['01junk',true],['1.5',true],['f',false],['fals',false],
    ['n',false],['no',false],['off',false],['0',false],['00junk',false],['0xff',false],
]) test(`hilite_pet boolean value ${value}`,()=>{
    setup(0,false);const {accepted,result}=audit_parse(`hilite_pe:${value}`);
    assert.equal(accepted,true);assert.deepEqual(result.errors,[]);
    assert.deepEqual(state(),{attr:enabled?7:0,hilite:enabled,redraw:true});
    assert.equal(result.opts.hilite_pet,enabled);
});

for(const value of ['o','2','-1','truejunk',' true']) test(`invalid boolean value ${JSON.stringify(value)}`,()=>{
    setup(4,true);const {accepted,result}=audit_parse(`hilite_pet:${value}`);
    assert.equal(accepted,false);
    assert.deepEqual(result.errors,[`'hilite_pet:${value}' is not valid for a boolean`]);
    assert.deepEqual(state(),{attr:4,hilite:true,redraw:false});
});

for(const text of ['!hilite_pet:false','no-hilite_pet:off']) test(`negated boolean parameter ${text}`,()=>{
    setup(4,true);const {accepted,result}=audit_parse(text);
    assert.equal(accepted,false);
    assert.deepEqual(result.errors,["Negated boolean 'hilite_pet' should not have a parameter"]);
    assert.deepEqual(state(),{attr:4,hilite:true,redraw:false});
});

for(const text of ['!hilite_pet','no-hilite_pet','!hilite_pet:']) test(`disable without replacing attribute: ${text}`,()=>{
    setup(4,true);const {accepted,result}=audit_parse(text);
    assert.equal(accepted,true);assert.deepEqual(result.errors,[]);
    assert.deepEqual(state(),{attr:4,hilite:false,redraw:true});
});

for(const attr of [0,1,4,7])for(const enabled of [false,true]) {
    test(`menu boolean side effect, attr=${attr}, enable=${enabled}`,()=>{
        setup(attr,!enabled);audit_set_bool('hilite_pet',enabled);audit_bool_effects('hilite_pet');
        assert.deepEqual(state(),{attr:enabled&&!attr?7:attr,hilite:enabled,redraw:true});
    });
}

for(const [rc,attr,hilite,redraw] of [
    ['',7,false,false],
    ['OPTIONS=petattr:bold\n',1,true,false],
    ['OPTIONS=hilite_pet,petattr:none\n',7,true,true],
    ['OPTIONS=petattr:none,hilite_pet\n',0,false,true],
    ['OPTIONS=petattr:bold,!hilite_pet\n',1,true,true],
    ['OPTIONS=!hilite_pet,petattr:bold\n',1,false,true],
    ['OPTIONS=petattr:none\nOPTIONS=hilite_pet\n',7,true,true],
    ['OPTIONS=hilite_pet\nOPTIONS=petattr:none\n',0,false,true],
]) test(`startup order ${JSON.stringify(rc)}`,()=>{
    resetGame();const result=parseNethackrc(rc);
    assert.deepEqual(result.errors,[]);
    assert.equal(game.iflags?.wc2_petattr,attr);
    assert.equal(!!result.opts.hilite_pet,hilite);
    assert.equal(!!game.opt_need_redraw,redraw);
    assert.equal(audit_option_value(findOption('petattr')),
        {0:'none',1:'bold',7:'inverse'}[attr]);
});

const recipe=JSON.parse(readFileSync(new URL('gen-sessions/recipes/monster-glyph-identities.json',import.meta.url)));
for(const [config,attr,enabled] of [
    ['petattr:underline',4,true],['hilite_pet,petattr:none',7,true],
    ['!hilite_pet,petattr:bold',1,false],['petattr:none,hilite_pet',0,false],
]) test(`actual startup installs parsed values: ${config}`,async()=>{
    await runSegment({...recipe.segments[1],nethackrc:recipe.segments[1].nethackrc+`OPTIONS=${config}\n`,
        moves:' ',storage:new InMemoryStorage()});
    assert.equal(game.iflags.wc2_petattr,attr);
    assert.equal(boolean_option('hilite_pet'),enabled);
    assert.equal(game.flags.petattr,undefined);
});

test('pet parsing queues redraw without painting or drawing RNG',async()=>{
    await runSegment({...recipe.segments[1],moves:' ',storage:new InMemoryStorage()});
    const before={grid:structuredClone(game.nhDisplay.grid),core:structuredClone(game.coreCtx),
        display:structuredClone(game.dispCtx)};
    game.opt_need_redraw=false;
    const {accepted}=audit_parse('petattr:bold',false);
    assert.equal(accepted,true);assert.equal(game.opt_need_redraw,true);
    assert.deepEqual(game.nhDisplay.grid,before.grid);
    assert.deepEqual(game.coreCtx,before.core);assert.deepEqual(game.dispCtx,before.display);
    game.nhDisplay.pushKey(32); // docrt acknowledges the pending startup line.
    await audit_reset_visuals();assert.equal(game.opt_need_redraw,false);
});

test('shared boolean parser keeps existing option storage and accepts C values',()=>{
    setup();const {accepted,result}=audit_parse('!time:');
    assert.equal(accepted,true);assert.equal(result.opts.time,false);
    assert.deepEqual(state(),{attr:7,hilite:false,redraw:false});
    const second=audit_parse('autopickup:no');
    assert.equal(second.accepted,true);assert.equal(second.result.opts.autopickup,false);
});

test('an invalid neighboring setting does not discard the valid option',()=>{
    setup(4,false);
    const first=audit_parse('hilite_pet,petattr:bogus');
    assert.equal(first.accepted,false);
    assert.deepEqual(first.result.errors,["Unknown petattr parameter 'petattr:bogus'"]);
    assert.deepEqual(state(),{attr:4,hilite:true,redraw:true});
    setup(4,true);
    const second=audit_parse('petattr:none,hilite_pet:bogus');
    assert.equal(second.accepted,false);
    assert.deepEqual(second.result.errors,["'hilite_pet:bogus' is not valid for a boolean"]);
    assert.deepEqual(state(),{attr:0,hilite:false,redraw:false});
});

test('abbreviation lookup agrees with C minmatch for this option table',()=>{
    const source=readFileSync(new URL('../js/options.js',import.meta.url),'utf8');
    const code=source.match(/    (?:const|let) opt = findOption\(name\);[\s\S]*?(?=    if \(!opt\) \{)/)[0];
    const lookup=new Function('name','allopt','findOption',code+'\nreturn opt;');
    // src/options.c:6703 determine_ambiguities(), pairwise common prefixes.
    const minimum=allopt.map((a,i)=>{
        let need=0;
        for(const [j,b] of allopt.entries())if(i!==j) {
            let k=0;
            while(a.name[k]&&b.name[k]&&a.name[k].toLowerCase()===b.name[k].toLowerCase())k++;
            need=Math.max(need,k+1);
        }
        return need<3?3:Math.min(need,a.name.length);
    });
    for(const entry of allopt)for(let len=1;len<=entry.name.length;len++) {
        const name=entry.name.slice(0,len).toLowerCase();
        const index=allopt.findIndex((o,i)=>len>=minimum[i]&&o.name.toLowerCase().startsWith(name));
        const expected=index>=0?allopt[index]:allopt.find(o=>o.alias?.toLowerCase()===name);
        for(const text of [name,name.toUpperCase()])
            assert.equal(lookup(text,allopt,findOption)?.name,expected?.name,text);
    }
});


test('native option paths produce the requested pet attributes', () => {
    const fixture = JSON.parse(readFileSync(new URL(
        'gen-sessions/generated/petattr-options.session.json', import.meta.url)));
    const samples = [[0,30,ATR_UNDERLINE],[1,30,ATR_INVERSE],[2,30,0],
        [3,27,ATR_BOLD],[3,30,0],[3,32,ATR_BOLD],[3,34,ATR_BOLD],
        [4,27,0],[4,54,ATR_UNDERLINE],[4,57,ATR_UNDERLINE],[5,44,ATR_UNDERLINE]];
    for (const [segment, step, attr] of samples) {
        const cell = decodeScreen(fixture.segments[segment].steps[step].screen)[13][8];
        assert.deepEqual([cell.ch, cell.color, cell.attr], ['G', CLR_BROWN, attr]);
    }
});
