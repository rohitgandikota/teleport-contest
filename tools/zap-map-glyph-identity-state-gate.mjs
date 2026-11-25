// Source contracts for C zap.c:3726-3732 and display.c:2478-2485.
// Constructed states use real producers; no gameplay helper is replaced.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setup, seed, clearMessages, x, y} from './status-followup-test-setup.mjs';
import {game} from '../js/gstate.js';
import {zap_map} from '../js/zap.js';
import {makemon} from '../js/makemon.js';
import {tamedog} from '../js/dog.js';
import {mksobj, place_object, add_to_minv} from '../js/mkobj.js';
import {observe_object} from '../js/o_init.js';
import {set_itimeout, make_blinded, make_hallucinated} from '../js/potion.js';
import {set_levltyp} from '../js/mkmaze.js';
import {maketrap} from '../js/mklev.js';
import {seetrap} from '../js/trap.js';
import {create_gas_cloud} from '../js/region.js';
import {newsym, glyph_at, gbuf_at, show_glyph_cell, mon_to_glyph, map_background,
    map_invisible, clear_glyph_buffer, magic_map_background,
    warning_of} from '../js/display.js';
import {getRngLog, rn2_on_display_rng} from '../js/rng.js';
import {PMNAMES} from '../js/monst_data.js';
import {ONAMES} from '../js/objects_data.js';
import {cmap_names as S} from '../js/drawing_data.js';
import {NO_MINVENT, MM_NOGRP, MM_NOWAIT, MM_NOMSG, OBJ_MINVENT,
    ARROW_TRAP, CORPSTAT_FEMALE, CORPSTAT_MALE,
    GLYPH_MON_MALE_OFF, GLYPH_MON_FEM_OFF, GLYPH_PET_MALE_OFF, GLYPH_PET_FEM_OFF,
    GLYPH_DETECT_MALE_OFF, GLYPH_DETECT_FEM_OFF, GLYPH_OBJ_OFF, GLYPH_OBJ_PILETOP_OFF,
    GLYPH_BODY_OFF, GLYPH_BODY_PILETOP_OFF, GLYPH_STATUE_MALE_OFF,
    GLYPH_STATUE_FEM_OFF, GLYPH_STATUE_FEM_PILETOP_OFF, GLYPH_STATUE_MALE_PILETOP_OFF,
    GLYPH_CMAP_A_OFF, GLYPH_CMAP_B_OFF, GLYPH_CMAP_C_OFF, GLYPH_WARNING_OFF,
    GLYPH_INVIS_OFF, GLYPH_NOTHING_OFF, GLYPH_UNEXPLORED_OFF} from '../js/const.js';

const flags = NO_MINVENT | MM_NOGRP | MM_NOWAIT | MM_NOMSG;
const numberAt = (xx = x + 1, yy = y) => gbuf_at(xx, yy)?.disp_glyphnum;
async function monster(id = PMNAMES.PM_HILL_ORC, dx = 1) {
    const mon = await makemon(game.mons[id], x + dx, y, flags);
    assert.ok(mon); newsym(mon.mx, mon.my); return mon;
}
function wand(type = ONAMES.WAN_PROBING) {
    const obj = mksobj(type, false, false); observe_object(obj);
    assert.equal(!!game.objects[type].oc_name_known, false);
    game.u.dz = 0; return obj;
}
async function probe(obj, known, xx = x + 1, yy = y) {
    clearMessages(); seed();
    assert.equal(await zap_map(xx, yy, obj), undefined);
    const calls = getRngLog();
    // C learnwand -> makeknown -> discover_object exercises wisdom once.
    assert.equal(calls.length, known ? 1 : 0);
    if (known) assert.match(calls[0], /^rn2\(19\)=\d+$/);
    assert.equal(!!game.objects[obj.otyp].oc_name_known, known);
}
function paint(mon) {
    const g = mon_to_glyph(mon, rn2_on_display_rng);
    show_glyph_cell(mon.mx, mon.my, g.ch, g.color, g.decgfx, 0, g.glyph);
}

test('inventory-bearing monster: compare identity without walking the ownership cycle', async () => {
    await setup(); const mon = await monster();
    const item = mksobj(ONAMES.DAGGER, false, false);
    assert.equal(add_to_minv(mon, item), 0); newsym(mon.mx, mon.my);
    assert.equal(item.where, OBJ_MINVENT); assert.equal(item.ocarry, mon);
    assert.equal(mon.minvent[0], item);
    assert.equal(gbuf_at(mon.mx,mon.my).disp_glyph.mon, mon);
    const id = numberAt(); const obj = wand();
    await probe(obj, false);
    assert.equal(numberAt(), id);
    assert.equal(mon.minvent[0], item); assert.equal(item.ocarry, mon);
});

for (const female of [false,true]) test(`normal monster ${female ? 'female' : 'male'}: equivalent descriptor forms do not discover`, async () => {
    await setup(); const mon = await monster();
    // Valid C monster sex field, a source boundary rather than an input claim.
    mon.female = female; newsym(mon.mx,mon.my); paint(mon);
    const id = mon.mnum + (female ? GLYPH_MON_FEM_OFF : GLYPH_MON_MALE_OFF);
    assert.equal(numberAt(), id);
    assert.equal(glyph_at(mon.mx,mon.my).glyphnum, undefined);
    await probe(wand(), false); assert.equal(numberAt(), id);
});

test('terrain number is unchanged when map_background and newsym use different descriptors', async () => {
    await setup(); map_background(x+1,y,true);
    const id = GLYPH_CMAP_A_OFF + S.S_room - S.S_ndoor;
    assert.equal(numberAt(),id); await probe(wand(),false); assert.equal(numberAt(),id);
});

test('pet range differs from normal monster despite the same character and species', async () => {
    await setup(); const mon=await monster(PMNAMES.PM_DOG);
    assert.ok(await tamedog(mon,null,false)); paint(mon);
    const normal=numberAt(), ch=gbuf_at(mon.mx,mon.my).disp_ch;
    await probe(wand(),true);
    assert.equal(numberAt(), mon.mnum+(mon.female?GLYPH_PET_FEM_OFF:GLYPH_PET_MALE_OFF));
    assert.notEqual(numberAt(),normal); assert.equal(gbuf_at(mon.mx,mon.my).disp_ch,ch);
});

test('captured pet identity does not follow a later live tame value', async () => {
    await setup(); const mon=await monster(PMNAMES.PM_DOG);
    assert.ok(await tamedog(mon,null,false)); newsym(mon.mx,mon.my);
    const pet=numberAt();
    // Ferality is a valid caller boundary; leave its old displayed glyph intact.
    mon.mtame=0;
    await probe(wand(),true);
    assert.equal(numberAt(),mon.mnum+(mon.female?GLYPH_MON_FEM_OFF:GLYPH_MON_MALE_OFF));
    assert.notEqual(numberAt(),pet);
});

for (const female of [false,true]) test(`detected ${female?'female':'male'} identity survives mapping`, async () => {
    await setup(); const mon=await monster(); mon.female=female;
    await make_blinded(100,false); set_itimeout('HDetect_monsters',100); newsym(mon.mx,mon.my);
    const id=mon.mnum+(female?GLYPH_DETECT_FEM_OFF:GLYPH_DETECT_MALE_OFF);
    assert.equal(numberAt(),id); await probe(wand(),false); assert.equal(numberAt(),id);
});

test('real mimic producer keeps its displayed object identity', async () => {
    await setup(); const rock=mksobj(ONAMES.ROCK,false,false); await place_object(rock,x+1,y);
    const mon=await monster(PMNAMES.PM_SMALL_MIMIC);
    assert.equal(mon.mappearance,ONAMES.ROCK);
    assert.equal(gbuf_at(mon.mx,mon.my).disp_glyph.kind,'obj');
    const id=numberAt(); await probe(wand(),false); assert.equal(numberAt(),id);
});

for (const [label,type,pile,female] of [
    ['object',ONAMES.DAGGER,false,false],['object pile',ONAMES.DAGGER,true,false],
    ['corpse',ONAMES.CORPSE,false,false],['corpse pile',ONAMES.CORPSE,true,false],
    ['male statue',ONAMES.STATUE,false,false],['female statue',ONAMES.STATUE,false,true],
    ['male statue pile',ONAMES.STATUE,true,false],['female statue pile',ONAMES.STATUE,true,true],
]) test(`${label}: real floor producer retains its glyph range`, async () => {
    await setup();
    if(pile) await place_object(mksobj(ONAMES.ROCK,false,false),x+1,y);
    const obj=mksobj(type,false,false);
    if(type===ONAMES.CORPSE||type===ONAMES.STATUE) obj.corpsenm=PMNAMES.PM_NEWT;
    if(type===ONAMES.STATUE) obj.spe=female?CORPSTAT_FEMALE:CORPSTAT_MALE;
    await place_object(obj,x+1,y); newsym(x+1,y);
    const expected=type===ONAMES.CORPSE ? obj.corpsenm+(pile?GLYPH_BODY_PILETOP_OFF:GLYPH_BODY_OFF)
        : type===ONAMES.STATUE ? obj.corpsenm+(female
            ? (pile?GLYPH_STATUE_FEM_PILETOP_OFF:GLYPH_STATUE_FEM_OFF)
            : (pile?GLYPH_STATUE_MALE_PILETOP_OFF:GLYPH_STATUE_MALE_OFF))
        : type+(pile?GLYPH_OBJ_PILETOP_OFF:GLYPH_OBJ_OFF);
    assert.equal(numberAt(),expected); await probe(wand(),false); assert.equal(numberAt(),expected);
    assert.equal(game.level.objectAt(x+1,y),obj);
});

test('generic object identity uses the class, without observing its distant real type', async () => {
    await setup();const obj=mksobj(ONAMES.POT_HEALING,false,false);
    await place_object(obj,x+4,y);newsym(x+4,y);
    assert.equal(!!obj.dknown,false);assert.equal(numberAt(x+4),obj.oclass+GLYPH_OBJ_OFF);
    await probe(wand(),false,x+4);assert.equal(!!obj.dknown,false);
    assert.equal(numberAt(x+4),obj.oclass+GLYPH_OBJ_OFF);
});

test('seen trap identity is stable and does not rediscover the wand', async () => {
    await setup();const trap=maketrap(x+1,y,ARROW_TRAP);seetrap(trap);
    const id=GLYPH_CMAP_B_OFF+S.S_arrow_trap-S.S_grave;
    assert.equal(numberAt(),id);await probe(wand(),false);assert.equal(numberAt(),id);
});

test('invisible marker identity survives the mapping phase', async () => {
    await setup();newsym(x+1,y);map_invisible(x+1,y);
    assert.equal(numberAt(),GLYPH_INVIS_OFF);await probe(wand(),false);
    assert.equal(numberAt(),GLYPH_INVIS_OFF);
});

test('warning producer retains its numeric level through mapping', async () => {
    await setup();const mon=await monster(PMNAMES.PM_HILL_GIANT);
    mon.mpeaceful=0;await make_blinded(100,false);set_itimeout('HWarning',100);newsym(mon.mx,mon.my);
    assert.ok(warning_of(mon)>0);const id=GLYPH_WARNING_OFF+warning_of(mon);
    assert.equal(numberAt(),id);await probe(wand(),false);assert.equal(numberAt(),id);
});

test('real visible cloud producer has a stable cmap identity', async () => {
    await setup();await create_gas_cloud(x+3,y,1,2);newsym(x+3,y);
    const id=GLYPH_CMAP_C_OFF+S.S_poisoncloud-S.S_digbeam;
    assert.equal(numberAt(x+3),id);await probe(wand(),false,x+3);assert.equal(numberAt(x+3),id);
});

test('absent cleared buffer is unexplored and mapping a known-type cell discovers a new glyph', async () => {
    await setup();newsym(x+1,y);const typ=game.level.at(x+1,y).lastseentyp;
    clear_glyph_buffer();assert.equal(gbuf_at(x+1,y),undefined);
    assert.equal(game.level.at(x+1,y).disp_glyph.kind,'unexplored');
    await probe(wand(),true);assert.equal(game.level.at(x+1,y).lastseentyp,typ);
    assert.notEqual(numberAt(),GLYPH_UNEXPLORED_OFF);
});

test('unseen dark-room nothing glyph differs from unexplored and remains stable', async () => {
    await setup();await make_blinded(100,false);game.flags.dark_room=false;
    const loc=game.level.at(x+1,y);loc.waslit=0;
    magic_map_background(x+1,y,true);assert.equal(numberAt(),GLYPH_NOTHING_OFF);
    await probe(wand(),false);assert.equal(numberAt(),GLYPH_NOTHING_OFF);
});

test('non-probing wand never evaluates a cyclic monster descriptor', async () => {
    await setup();const mon=await monster();add_to_minv(mon,mksobj(ONAMES.DAGGER,false,false));
    newsym(mon.mx,mon.my);const id=numberAt();await probe(wand(ONAMES.WAN_POLYMORPH),false);
    assert.equal(numberAt(),id);
});

test('hallucinated monster compares the selected numbers with only the mapping display draw', async () => {
    await setup();const mon=await monster(), obj=wand();
    await make_hallucinated(100,false);newsym(mon.mx,mon.my);
    const before=numberAt();
    const saved=Object.getOwnPropertyDescriptor(globalThis,'__rng_log_disp');
    try {
        globalThis.__rng_log_disp=true;seed();
        await zap_map(mon.mx,mon.my,obj);
        const calls=getRngLog().map(c=>c.replace(/\s+@\s*.*$/,''));
        const changed=before!==numberAt();
        assert.equal(calls.length,changed?2:1);assert.match(calls[0],/^~drn2\(\d+\)=\d+$/);
        if(changed)assert.match(calls[1],/^rn2\(19\)=\d+$/);
        assert.equal(!!game.objects[obj.otyp].oc_name_known,before!==numberAt());
        const descriptor=gbuf_at(mon.mx,mon.my).disp_glyph;
        assert.equal(numberAt(),descriptor.mnum+(mon.female?GLYPH_MON_FEM_OFF:GLYPH_MON_MALE_OFF));
    } finally {
        if(saved)Object.defineProperty(globalThis,'__rng_log_disp',saved);else delete globalThis.__rng_log_disp;
    }
});
