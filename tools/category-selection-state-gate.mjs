#!/usr/bin/env node

// C pickup.c query_category/count_categories, options.c menu_objsyms,
// and invent.c this_type_only. Constructed states earn no native coverage.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {runSegment} from '../js/jsmain.js';
import {game} from '../js/gstate.js';
import {InMemoryStorage} from '../js/storage.js';
import {pushKeys,resetInputState} from '../js/input.js';
import {query_category,count_categories} from '../js/pickup.js';
import {this_type_only,display_inventory} from '../js/invent.js';
import {parseNethackrc,set_menuobjsyms_flags,handler_menu_objsyms} from '../js/options.js';
import {mksobj} from '../js/mkobj.js';
import {ONAMES as N,OCLASSES as O} from '../js/objects_data.js';
import {OBJ_INVENT,ALL_TYPES,CHOOSE_ALL,WORN_TYPES,BUC_BLESSED,BUC_CURSED,
    BUC_UNCURSED,BUC_UNKNOWN,BILLED_TYPES,UNPAID_TYPES,JUSTPICKED,INCLUDE_VENOM,
    PICK_ANY,PICK_ONE,PICK_NONE,ALL_TYPES_SELECTED,PARANOID_AUTOALL,PARANOID_CONFIRM,
    W_ARM,W_WEP,W_QUIVER,W_SADDLE,W_BALL,W_CHAIN} from '../js/const.js';
import {decodeScreen} from './gen-sessions/screen-decode.mjs';

const read=(name,dir='recipes')=>JSON.parse(fs.readFileSync(new URL(
    `gen-sessions/${dir}/${name}${dir==='generated'?'.session':''}.json`,import.meta.url)));
const pad=' '.repeat(8)+'\x1b'.repeat(6);
let replays=0,observations=0;
for(const name of ['category-autoselect','category-filters','menu-object-symbols']) {
    const native=read(name,'generated');
    for(const [i,s]of read(name).segments.entries()) {
        await runSegment({...s,storage:new InMemoryStorage()});replays++;
        const label=name+':'+s.name;
        assert.equal(game.u.umortality||0,0,label);
        assert.deepEqual(game.impossible_log||[],[],label);
        assert.deepEqual(game.rc.errors,[],label);
        assert.equal(game.this_type||0,0,label);
        assert.equal(game.this_title||null,null,label);
        // Read every page of the final C inventory, including glyph separators.
        const start=s.moves.lastIndexOf('i '+pad)+1;assert.ok(start>0,label);
        const expected=new Map();
        for(const t of native.segments[i].steps.slice(start)) {
            for(const row of decodeScreen(t.screen)) {
                const m=row.match(/ ([$a-zA-Z]) [^\s] ((?:\d+|an?|the)\b.*)/);
                if(m)expected.set(m[1],{quan:/^\d+/.test(m[2])?parseInt(m[2],10):1,text:m[2]});
            }
        }
        assert.deepEqual(game.invent.map(o=>[o.invlet,o.quan]).sort(),
            [...expected].map(([k,v])=>[k,v.quan]).sort(),label+': C inventory quantities');
        for(const obj of game.invent) {
            const text=expected.get(obj.invlet).text;observations++;
            assert.equal(obj.where,OBJ_INVENT,label);
            if(text.includes('(at the ready)')) {
                assert.equal(game.u.uquiver,obj,label);assert.ok(obj.owornmask&W_QUIVER,label);
            }
            if(text.includes('(wielded)')||text.includes('(weapon in hand)')) {
                assert.equal(game.u.uwep,obj,label);assert.ok(obj.owornmask&W_WEP,label);
            }
            if(text.includes('(being worn)')&&obj.otyp===N.LEATHER_ARMOR) {
                assert.equal(game.u.uarm,obj,label);assert.ok(obj.owornmask&W_ARM,label);
            }
            assert.equal(!!obj.unpaid,text.includes('(unpaid,'),label+': billing ownership');
            if(/\bblessed\b/.test(text))assert.ok(obj.bknown&&obj.blessed,label);
            if(/\bcursed\b/.test(text))assert.ok(obj.bknown&&obj.cursed,label);
        }
        if(s.name.startsWith('hint-repeat-')) {
            const paranoid=s.name.includes('paranoid');
            assert.equal(game[paranoid?'A_second_hint':'A_first_hint'],3,label);
            assert.equal(game[paranoid?'A_first_hint':'A_second_hint']||0,0,label);
        }
        if(s.name.startsWith('justpicked-')) {
            const letters=s.name.includes('single')?['b']:['b','e'];
            assert.deepEqual(game.invent.filter(o=>o.pickup_prev).map(o=>o.invlet).sort(),
                s.name.endsWith('-drop')?[]:letters,label);
        }
    }
}
assert.equal(replays,117);
console.log(`category selection: ${replays} native replays, ${observations} C inventory observations PASS`);

const base=read('category-autoselect').segments[0];
const ch=s=>s.charCodeAt(0),row=y=>game.nhDisplay.grid[y].map(c=>c.ch).join('');
let groups=0;
async function setup(keys='\x1b') {
    resetInputState();await runSegment({...base,moves:' ',storage:new InMemoryStorage()});
    game._preNhgetchHook=null;game._toplin=0;game._win_stop=false;
    game.flags.paranoia_bits=0;game.flags.cmdassist=false;
    resetInputState();pushKeys(keys+' '.repeat(100));groups++;
}
function obj(type=N.DAGGER,fields={}) {
    return Object.assign(mksobj(type,true,false),{where:OBJ_INVENT,invlet:'a',bknown:0},fields);
}
const two=()=>[obj(),obj(N.APPLE,{invlet:'b'})];
const query=(list,flags=ALL_TYPES|CHOOSE_ALL,how=PICK_ANY)=>query_category('Categories?',list,flags,how);

await setup();assert.deepEqual(await query([]),[]);
await setup();assert.deepEqual(await query([obj()]),[O.WEAPON_CLASS]);
await setup();assert.equal(count_categories([obj(),obj()]),1);
assert.equal(count_categories([obj(N.BLINDING_VENOM)]),0);
assert.equal(count_categories([obj(),obj(N.BLINDING_VENOM)]),1);
assert.deepEqual(await query([obj(N.BLINDING_VENOM),obj()],INCLUDE_VENOM),[O.VENOM_CLASS],
    'C counts inv_order but the shortcut returns the first eligible object');

// Count excludes saddles; the query's is_worn filter includes them. Ball and
// chain masks are not worn categories, while the quiver is a weapon slot.
for(const [mask,want]of [[0,0],[W_ARM,1],[W_WEP,1],[W_QUIVER,1],[W_SADDLE,0],[W_BALL,0],[W_CHAIN,0]]) {
    await setup();assert.equal(count_categories([obj(N.LEATHER_ARMOR,{owornmask:mask})],WORN_TYPES),want);
}
await setup();const saddle=obj(N.SADDLE,{owornmask:W_SADDLE});
assert.deepEqual(await query([saddle,obj(N.LEATHER_ARMOR,{owornmask:W_ARM})],WORN_TYPES),[O.TOOL_CLASS]);
await setup('b\r');
assert.deepEqual(await query([obj(N.HEAVY_IRON_BALL,{owornmask:W_BALL}),
    obj(N.APPLE,{owornmask:W_WEP}),obj(N.LEATHER_ARMOR,{owornmask:W_ARM})],WORN_TYPES),[O.FOOD_CLASS]);

for(const [keys,bits,flags,want]of [
    ['A\r',0,ALL_TYPES,[]],['Aa\r',0,ALL_TYPES,[ch('A'),ALL_TYPES_SELECTED]],
    ['A\ry',PARANOID_AUTOALL,ALL_TYPES,[ch('A')]],
    ['A\rn',PARANOID_AUTOALL,ALL_TYPES,[ALL_TYPES_SELECTED]],
    ['Ab\rn',PARANOID_AUTOALL,ALL_TYPES,[O.WEAPON_CLASS]],
    ['A\rq',PARANOID_AUTOALL,ALL_TYPES,[]],['A\r\x1b',PARANOID_AUTOALL,ALL_TYPES,[]],
    ['A\rn',PARANOID_AUTOALL,0,[]],['A\ry',PARANOID_AUTOALL,0,[ch('A')]],
    ['A\ryes\r',PARANOID_AUTOALL|PARANOID_CONFIRM,ALL_TYPES,[ch('A')]],
    ['A\rn\rno\r',PARANOID_AUTOALL|PARANOID_CONFIRM,ALL_TYPES,[ALL_TYPES_SELECTED]],
    ['A\rquit\r',PARANOID_AUTOALL|PARANOID_CONFIRM,ALL_TYPES,[]],
]) {
    await setup(keys);game.flags.paranoia_bits=bits;
    const got=await query(two(),CHOOSE_ALL|flags);assert.deepEqual([...got],want,JSON.stringify(keys));
    if(keys==='A\r'&&!bits)assert.ok(row(0).includes('No relevant items selected.'));
}
await setup('A');game.flags.paranoia_bits=PARANOID_AUTOALL;
assert.deepEqual(await query(two(),CHOOSE_ALL|ALL_TYPES,PICK_ONE),[],
    'PICK_ONE never confirms A and rejects it by itself');
await setup('A\r');assert.deepEqual(await query(two(),CHOOSE_ALL|ALL_TYPES,PICK_NONE),[]);

await setup('A2b\rn');game.flags.paranoia_bits=PARANOID_AUTOALL;
const counted=await query(two());assert.deepEqual([...counted],[O.WEAPON_CLASS]);
assert.equal(counted.counts.get(O.WEAPON_CLASS),2);assert.ok(!counted.counts.has(ch('A')));
// Invalid constructed pack order exercises the diagnostic, not reachability
// from a legal configuration (which contains fewer than twenty classes).
await setup();game.flags.inv_order=Array(20).fill(O.WEAPON_CLASS);
assert.deepEqual(await query([obj()],0),[]);
assert.deepEqual(game.impossible_log,['query_category: too many categories']);
for(const [flag,key,want]of [[UNPAID_TYPES,'u',ch('u')],[BILLED_TYPES,'x',ch('x')],
    [BUC_BLESSED,'B',ch('B')],[BUC_CURSED,'C',ch('C')],[BUC_UNCURSED,'U',ch('U')],
    [BUC_UNKNOWN,'X',ch('X')],[JUSTPICKED,'P',ch('P')],[INCLUDE_VENOM,'c',O.VENOM_CLASS]]) {
    await setup(key+'\r');const list=two();
    Object.assign(list[0],{unpaid:1,bknown:key==='X'?0:1,blessed:key==='B',cursed:key==='C',pickup_prev:1});
    if(flag===INCLUDE_VENOM)list.push(obj(N.BLINDING_VENOM));
    assert.deepEqual(await query(list,flag),[want],key);
}

// Header and entry bits have six valid combinations; display-only headings
// suppress the class symbols even when the selected mode includes headers.
for(let n=0;n<6;n++) {
    await setup();set_menuobjsyms_flags(n);game.invent=two();
    assert.deepEqual([game.iflags.menuobjsyms,game.iflags.menu_head_objsym,game.iflags.use_menu_glyphs],
        [n,!!(n&1),!!(n&6)]);
    assert.equal(display_inventory(null,true)[0].str.includes("(')')"),!!(n&1));
    assert.equal(display_inventory(null,false)[0].str,'Weapons');
}
await setup('5');await handler_menu_objsyms();assert.equal(game.iflags.menuobjsyms,5);
await setup('\x1b');await handler_menu_objsyms();assert.equal(game.iflags.menuobjsyms,4);
await setup('\r');await handler_menu_objsyms();assert.equal(game.iflags.menuobjsyms,4);
const invalid=parseNethackrc('OPTIONS=menu_objsyms:both\nOPTIONS=menu_objsyms:6\n');
assert.equal(invalid.opts.menuobjsyms,3);
assert.deepEqual(invalid.errors,["Illegal menu_objsyms parameter '6'"]);
for(const [value,want]of [['head',1],['hea',0],['one-or-the-other',5],['one-or-the-other-extra',5],
    [' headers',0],['5suffix',5],['-1',0],['',1]]) {
    assert.equal(parseNethackrc('OPTIONS=menu_objsyms:'+value+'\n').opts.menuobjsyms,want,value);
}

await setup();
for(const goldX of [false,true])for(const type of ['B','U','C','X','P']) {
    game.flags.goldX=goldX;game.this_type=ch(type);const coin=obj(N.GOLD_PIECE,{pickup_prev:1});
    assert.equal(this_type_only(coin),type==='P'||type===(goldX?'X':'U'),type);
}
for(const [fields,type,want]of [[{bknown:1,blessed:1},'B',true],[{bknown:0,blessed:1},'B',false],
    [{bknown:1,cursed:1},'C',true],[{bknown:1},'U',true],[{bknown:0},'X',true]]) {
    game.this_type=ch(type);assert.equal(this_type_only(obj(N.APPLE,fields)),want,type);
}
game.this_type=O.FOOD_CLASS;assert.ok(this_type_only(obj(N.APPLE)));assert.ok(!this_type_only(obj()));
console.log(`category selection: ${groups} constructed control groups PASS`);
