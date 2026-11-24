// Source-derived real-producer controls, not a native recording.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setImmediate, setTimeout} from 'node:timers/promises';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {getRngLog} from '../js/rng.js';
import {resetInputState} from '../js/input.js';
import {vision_recalc, cansee} from '../js/vision.js';
import {Hallucination, Blind} from '../js/youprop.js';
import {Is_rogue_level, W_TOOL, W_WEP} from '../js/const.js';
import {ONAMES} from '../js/objects_data.js';
import {ART_EYES_OF_THE_OVERWORLD} from '../js/artilist_data.js';
import {Blindf_on, Blindf_off} from '../js/do_wear.js';
import {ready_weapon} from '../js/wield.js';
import {make_blinded} from '../js/potion.js';
import {docrt, pline, display_nhwindow_message} from '../js/display.js';

const parts=JSON.parse(fs.readFileSync(new URL(
    'gen-sessions/recipes/xray-preswap-redraw.json',import.meta.url))).segments;
async function boot(index=0) {
    const run=await runSegment({...parts[index],storage:new InMemoryStorage()});
    game._preNhgetchHook=null;
    resetInputState();
    run._display.onEmptyQueue=async()=>{await setImmediate();return 32;};
    await display_nhwindow_message();
    return run;
}
function rock() {
    const obj=game.level.objects.find(o=>o.otyp===ONAMES.ROCK);
    assert.ok(obj);
    assert.equal(game.level.objectAt(obj.ox,obj.oy),obj);
    return obj;
}
function eyes() {
    const obj=game.invent.find(o=>o.oartifact===ART_EYES_OF_THE_OVERWORLD);
    assert.ok(obj);return obj;
}
function draws(control=0) {
    const before=getRngLog().length;
    const prior=Object.getOwnPropertyDescriptor(globalThis,'__rng_log_disp');
    try {
        globalThis.__rng_log_disp=true;
        assert.equal(vision_recalc(control),undefined,'synchronous owner return');
    } finally {
        if(prior)Object.defineProperty(globalThis,'__rng_log_disp',prior);
        else delete globalThis.__rng_log_disp;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,'__rng_log_disp'),prior);
    const added=getRngLog().slice(before);
    assert.ok(added.every(s=>s.startsWith('~drn2(')),
        'vision recalculation must not consume core RNG in these controls');
    return added;
}
function ordinaryRock() {
    assert.equal(!!Is_rogue_level(game.u.uz),false);
    assert.equal(Hallucination(),true);assert.equal(Blind(),false);
    assert.equal(game.u.xray_range,3);assert.ok(eyes().owornmask&W_TOOL);
    const obj=rock();assert.ok(cansee(obj.ox,obj.oy));
    assert.deepEqual([game.u.ux,game.u.uy],[11,13]);
    assert.deepEqual([obj.ox,obj.oy],[10,13]);
    assert.equal(game.level.at(obj.ox,obj.oy).seenv,255);
    assert.equal(game.level.monsters.filter(m=>m.mhp>0
        &&Math.abs(m.mx-game.u.ux)<=3&&Math.abs(m.my-game.u.uy)<=3).length,0,
        'the xray circle contains no monster redraw producer');
    assert.equal(game.level.objects.filter(o=>Math.abs(o.ox-game.u.ux)<=3
        &&Math.abs(o.oy-game.u.uy)<=3).length,1,
        'one actual floor-object producer inside the circle');
    return obj;
}

await test('already-visible xray object redraws on every recalculation',async()=>{
    await boot();ordinaryRock();
    for(let repeat=0;repeat<2;repeat++) {
        const added=draws();
        assert.equal(added.length,1,
            'C tests the new geometry before lighting, not old active IN_SIGHT');
        assert.match(added[0],new RegExp(`^~drn2\\(${ONAMES.NUM_OBJECTS-ONAMES.FIRST_OBJECT}\\)=`));
    }
});
await test('cleared old visibility postpones object mapping to the final pass',async()=>{
    await boot();const obj=ordinaryRock();
    assert.equal(draws(2).length,0);
    assert.equal(!!cansee(obj.ox,obj.oy),false);
    const added=draws();
    // The real lit room has two visible floor objects and one visible monster.
    assert.equal(game.level.objects.filter(o=>cansee(o.ox,o.oy)).length,2);
    assert.equal(game.level.monsters.filter(m=>m.mhp>0&&cansee(m.mx,m.my)).length,1);
    assert.equal(added.length,3,
        'pre-swap newsym reads the cleared old view; no premature fourth draw');
    assert.ok(cansee(obj.ox,obj.oy));
});
await test('real facewear removal disables the additional callback',async()=>{
    await boot();const obj=eyes();
    await Blindf_off(obj);vision_recalc(0);
    assert.equal(game.u.xray_range,-1);
    assert.ok(game.invent.includes(obj));assert.equal(obj.owornmask&W_TOOL,0);
    assert.equal(draws().length,0);
});
await test('real re-equipping settles dirty vision through wear feedback',async()=>{
    await boot();const obj=eyes();
    await Blindf_off(obj);vision_recalc(0);
    await Blindf_on(obj);
    assert.equal(game.u.ublindf,obj);assert.equal(game.u.xray_range,3);
    // setworn marks vision dirty; on_msg -> vpline settles it before returning.
    assert.equal(game.vision_full_recalc,0);
    assert.equal(draws().length,1);
});
await test('sane Eyes preserve the ordinary glyph and consume no display draw',async()=>{
    const run=await boot(1);const obj=rock(),before=run._display.terminal.serialize();
    assert.equal(Hallucination(),false);assert.equal(game.u.xray_range,3);
    assert.ok(cansee(obj.ox,obj.oy));assert.equal(draws().length,0);
    assert.equal(run._display.terminal.serialize(),before);
});
await test('ordinary lenses retain only the existing underfoot hero mapping',async()=>{
    await boot(2);const obj=rock();
    assert.equal(Hallucination(),true);assert.equal(game.u.xray_range,-1);
    assert.deepEqual([obj.ox,obj.oy],[game.u.ux,game.u.uy]);
    assert.equal(draws().length,1,'C tail newsym maps the object under the hero');
});
await test('Rogue priority still excludes xray despite hallucination',async()=>{
    await boot(3);
    assert.ok(Is_rogue_level(game.u.uz));assert.equal(Hallucination(),true);
    assert.equal(game.u.xray_range,3);assert.equal(draws().length,0);
});
await test('real wielded Eyes plus blindness takes the earlier Blind return',async()=>{
    await boot();const obj=eyes();
    await Blindf_off(obj);await ready_weapon(obj);await make_blinded(100,false);
    assert.ok(obj.owornmask&W_WEP);assert.equal(game.u.xray_range,3);
    assert.equal(Blind(),true);assert.equal(draws().length,0);
    assert.ok(game.viz_array.every(row=>row.every(value=>!(value&2))));
});
await test('pending More precedes recalculation and keeps nested redraw quiet',async()=>{
    const run=await boot();
    await pline('A message waits before the xray redraw.');
    let release,settled=false,error;
    run._display.onEmptyQueue=()=>new Promise(resolve=>{release=resolve;});
    const action=docrt().then(()=>{settled=true;},e=>{error=e;settled=true;});
    try {
        for(let i=0;i<200&&!release&&!settled;i++)await setTimeout(1);
        assert.ok(release);assert.equal(settled,false);
        assert.equal(game.program_state.in_docrt,true);
        const before=run._display.terminal.serialize(),rng=[...getRngLog()];
        const visibility=game.viz_array;
        await docrt();
        assert.equal(game.viz_array,visibility);
        assert.equal(run._display.terminal.serialize(),before);
        assert.deepEqual(getRngLog(),rng);
    } finally {
        run._display.onEmptyQueue=async()=>{await setImmediate();return 32;};
        release?.(32);await action;
    }
    if(error)throw error;
    assert.equal(game.program_state.in_docrt,false);ordinaryRock();
});
