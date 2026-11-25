// Constructed tactile-map controls using normal trap, blindness and potion producers.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setup, x, y, clearMessages} from './half-damage-intrinsic-setup.mjs';
import {game} from '../js/gstate.js';
import {maketrap} from '../js/mklev.js';
import {feeltrap, seetrap} from '../js/trap.js';
import {make_blinded, peffects} from '../js/potion.js';
import {Blind, Levitation} from '../js/youprop.js';
import {mksobj, place_object} from '../js/mkobj.js';
import {getRngLog} from '../js/rng.js';
import {newsym, glyph_at, map_background} from '../js/display.js';
import {cansee} from '../js/vision.js';
import {ONAMES as O} from '../js/objects_data.js';
import {cmap_names as CM} from '../js/drawing_data.js';
import {PIT, BEAR_TRAP, WEB, VIBRATING_SQUARE} from '../js/const.js';

const deadline=setTimeout(()=>{console.error('55 second state limit');process.exit(2);},55000);
deadline.unref();

async function prepare(type, {blind=true, floating=false, hero=false}={}) {
    await setup();
    const tx=hero?x:x+1, ty=y;
    map_background(tx,ty,true);
    if(floating) {
        const potion=mksobj(O.POT_LEVITATION,false,false);
        potion.blessed=0; potion.cursed=0;
        await peffects(potion);
        assert.equal(Levitation(),true);
    }
    if(blind) {
        await make_blinded(100,false);
        assert.equal(Blind(),true);
        assert.equal(!!cansee(tx,ty),false);
    }
    const trap=await maketrap(tx,ty,type);
    assert.ok(trap);
    assert.equal(!!trap.tseen,false);
    clearMessages();
    return trap;
}

function remember(trap) {
    const rng=[...getRngLog()];
    assert.equal(feeltrap(trap),undefined);
    assert.equal(trap.tseen,1);
    assert.deepEqual(getRngLog(),rng);
    return game.level.at(trap.tx,trap.ty).remembered_glyph;
}

for(const [name,type] of [['pit',PIT],['bear trap',BEAR_TRAP],['web',WEB],
                         ['vibrating square',VIBRATING_SQUARE]]) {
    await test(`touch maps an unseen adjacent ${name} without a random draw`,async()=>{
        const trap=await prepare(type);
        const memory=remember(trap);
        assert.equal(memory.glyph.cmap,CM.S_arrow_trap+type-1);
        assert.deepEqual(glyph_at(trap.tx,trap.ty),memory.glyph);
        const before=structuredClone(memory);
        remember(trap);
        assert.deepEqual(game.level.at(trap.tx,trap.ty).remembered_glyph,before);
    });
}

await test('blind levitation still remembers a trap beneath the hero',async()=>{
    const trap=await prepare(VIBRATING_SQUARE,{floating:true,hero:true});
    const memory=remember(trap);
    assert.equal(memory.glyph.cmap,CM.S_vibrating_square);
    assert.equal(glyph_at(x,y).kind,'hero','the hero is redrawn above the trap');
});

await test('grounded blindness already maps the known trap beneath the hero',async()=>{
    const trap=await prepare(PIT,{hero:true});
    assert.equal(remember(trap).glyph.cmap,CM.S_pit);
    assert.equal(glyph_at(x,y).kind,'hero');
});

await test('sighted discovery redraws the object above the trap',async()=>{
    const trap=await prepare(PIT,{blind:false});
    const rock=mksobj(O.ROCK,false,false);
    await place_object(rock,trap.tx,trap.ty);
    newsym(trap.tx,trap.ty);
    assert.equal(remember(trap).glyph.kind,'obj');
    assert.equal(glyph_at(trap.tx,trap.ty).otyp,O.ROCK);
});

await test('ordinary seetrap does not grant tactile knowledge out of sight',async()=>{
    const trap=await prepare(PIT);
    const before=structuredClone(game.level.at(trap.tx,trap.ty).remembered_glyph);
    seetrap(trap);
    assert.equal(trap.tseen,1);
    assert.deepEqual(game.level.at(trap.tx,trap.ty).remembered_glyph,before);
});

await test('touch leaves disabled hero memory unchanged',async()=>{
    const trap=await prepare(PIT);
    game.level.flags.hero_memory=false;
    const before=structuredClone(game.level.at(trap.tx,trap.ty).remembered_glyph);
    assert.deepEqual(remember(trap),before);
});

clearTimeout(deadline);
