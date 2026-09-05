#!/usr/bin/env node

// Persistent-state controls for region.c:80..719 and 1046..1315.
// Constructed controls verify source contracts and earn no native coverage.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runSegment } from '../js/jsmain.js';
import { InMemoryStorage } from '../js/storage.js';
import { game } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { create_region, add_rect_to_reg, add_mon_to_reg, remove_mon_from_reg,
    mon_in_region, add_region, remove_region, run_regions, update_player_regions,
    update_monster_region, inside_region, inside_gas_cloud, reg_damg,
    create_gas_cloud, visible_region_at } from '../js/region.js';
import { makemon, remove_monster, place_monster } from '../js/makemon.js';
import { mksobj } from '../js/mkobj.js';
import { addinv } from '../js/invent.js';
import { mcalcdistress, m_poisongas_ok } from '../js/mon.js';
import { polymon } from '../js/polyself.js';
import { rloc_to } from '../js/teleport.js';
import { Half_gas_damage } from '../js/youprop.js';
import { map_location, feel_location } from '../js/display.js';
import { vision_recalc } from '../js/vision.js';
import { enableRngLog, getRngLog } from '../js/rng.js';
import { ONAMES } from '../js/objects_data.js';
import { PMNAMES } from '../js/monst_data.js';
import { cmap_names as CM } from '../js/drawing_data.js';
import { ROOM, MM_NOGRP, MM_NOMSG, NO_MINVENT, FROMOUTSIDE,
    REG_HERO_INSIDE, REG_NOT_HEROS, M_POISONGAS_OK, MONST_INC, COLNO, ROWNO }
    from '../js/const.js';

const read = name => JSON.parse(readFileSync(new URL(
    `gen-sessions/recipes/${name}.json`, import.meta.url)));
let replays = 0;
for (const file of ['gas-cloud-hero', 'gas-cloud-monsters', 'gas-cloud-trails']) {
    for (const segment of read(file).segments) {
        let clouds = false, fog = false, extended = false, wet = false;
        globalThis.__step_snapshot = {step: '*', cb: state => {
            clouds ||= !!state.regions?.length;
            fog ||= state.u.umonnum === PMNAMES.PM_FOG_CLOUD;
            extended ||= state.regions?.some(r => r.ttl >= 20);
            wet ||= Half_gas_damage();
            for (const reg of state.regions || []) {
                assert.equal(reg.nrects, reg.rects.length);
                assert.ok(reg.n_monst <= reg.max_monst);
                assert.equal(new Set(reg.monsters.slice(0, reg.n_monst)).size, reg.n_monst);
            }
        }};
        try {
            await runSegment({...segment, storage: new InMemoryStorage()});
        } finally {
            delete globalThis.__step_snapshot;
        }
        const label = file + ':' + segment.name;
        assert.ok(clouds, label + ': cloud created');
        if (segment.name === 'worn-wet-towel')
            assert.ok(wet, label + ': worn towel is wet');
        if (segment.name === 'worn-dry-towel' || segment.name === 'carried-wet-towel')
            assert.equal(wet, false, label);
        if (file === 'gas-cloud-hero' && segment.name === 'fog-lifetime')
            assert.ok(fog && extended, label + ': fog sustains cloud');
        replays++;
    }
}

const source = read('monster-pickup-light').segments[0];
async function setup() {
    resetInputState();
    await runSegment({...source, moves:' ', storage:new InMemoryStorage()});
    game._preNhgetchHook = null;
    game.iflags.debug_mongen = false;
    pushKeys(' '.repeat(1000));
    game.u.uhp = game.u.uhpmax = 200;
    for (let x = game.u.ux - 2; x <= game.u.ux + 2; x++)
        for (let y = game.u.uy - 2; y <= game.u.uy + 2; y++)
            if (game.level.at(x,y)) game.level.at(x,y).typ = ROOM;
}
async function monster(mnum) {
    const mon = await makemon(game.mons[mnum], game.u.ux, game.u.uy,
        MM_NOGRP | MM_NOMSG | NO_MINVENT);
    assert.ok(mon);
    mon.mhp = mon.mhpmax = 100;
    return mon;
}
const region = damage => Object.assign(create_region([],0), {arg:damage, ttl:10});

// Wetness matters only for a towel actually worn. Physical resistance and
// wet-towel protection each round upward when halving the same damage.
for (const mode of ['bare','wet','dry','carried','half-physical-wet']) {
    await setup();
    if (mode !== 'bare') {
        const towel = mksobj(ONAMES.TOWEL, false, false);
        towel.spe = mode === 'dry' ? 0 : 4;
        if (mode !== 'carried') game.u.ublindf = towel;
        else await addinv(towel);
    }
    if (mode === 'half-physical-wet')
        game.u.intrinsic.HHalf_physical_damage = FROMOUTSIDE;
    enableRngLog();
    await inside_gas_cloud(region(12), null);
    const roll = Number(getRngLog().find(s=>s.startsWith('rnd(12)='))?.split('=')[1]);
    assert.ok(Number.isInteger(roll), mode + ': gas damage roll');
    let damage = roll + 5;
    if (mode === 'half-physical-wet') damage = Math.ceil(damage / 2);
    if (mode === 'wet' || mode === 'half-physical-wet') damage = Math.ceil(damage / 2);
    assert.equal(200-game.u.uhp, damage, mode);
}
await setup();
game.u.intrinsic.HPoison_resistance = FROMOUTSIDE;
await inside_gas_cloud(region(12),null);
assert.equal(game.u.uhp,200,'poison resistance prevents HP loss');
assert.equal(game.u.intrinsic.HBlinded & 0xffffff,1,'poison resistance does not protect eyes');
await setup();
await polymon(PMNAMES.PM_IRON_GOLEM);
const ironHP = game.u.mh;
await inside_gas_cloud(region(12),null);
assert.equal(game.u.mh,ironHP,'iron golem is immune');
assert.ok(!game.u.intrinsic.HBlinded,'immune form is not blinded');
await polymon(PMNAMES.PM_FOG_CLOUD);
const fogRegion = region(0); fogRegion.ttl = 19;
await inside_gas_cloud(fogRegion,null);
assert.equal(fogRegion.ttl,24,'harmless fog extends lifetime before damage guard');
await inside_gas_cloud(fogRegion,null);
assert.equal(fogRegion.ttl,24,'extension threshold is tested before adding five');

for (const [species,immune,resistant] of [
    ['GOBLIN',false,false], ['SNAKE',false,true], ['FLESH_GOLEM',true,true],
    ['VROCK',true,true], ['FOG_CLOUD',true,true]]) {
    await setup();
    const mon = await monster(PMNAMES['PM_'+species]);
    mon.mpeaceful = 1;
    assert.equal(mon.mblinded,0,'new monster blindness starts at zero');
    assert.equal(mon.mspec_used,0,'new monster cooldown starts at zero');
    assert.equal(m_poisongas_ok(mon) === M_POISONGAS_OK,immune,species);
    const reg = region(12); reg.player_flags = 0;
    await inside_gas_cloud(reg,mon);
    assert.equal(mon.mpeaceful,immune ? 1 : 0,species + ': hero ownership');
    assert.equal(mon.mhp === 100,immune || resistant,species + ': resistance');
    if (!immune) {
        assert.equal(mon.mblinded,1,species + ': eyes');
        await mcalcdistress();
        assert.equal(mon.mblinded,0,species + ': blindness expires');
        assert.equal(mon.mcansee,1,species + ': sight restored');
    }
}
await setup();
let mon = await monster(PMNAMES.PM_GOBLIN); mon.mpeaceful = 1;
await inside_gas_cloud(region(12),mon);
assert.equal(mon.mpeaceful,1,'natural gas does not blame the hero');

// Cloud expiration happens before damage and uses swap removal. Thick gas
// survives twice at lower strengths, then is removed on the following turn.
await setup();
const thick = region(12); thick.ttl=0; thick.expire_f=1;
add_region(thick);
for (const [arg,ttl] of [[6,1],[6,0],[3,1],[3,0]]) {
    await run_regions();
    assert.equal(thick.arg,arg); assert.equal(thick.ttl,ttl);
    assert.ok(game.regions.includes(thick));
}
await run_regions();
assert.ok(!game.regions.includes(thick));
const a=region(0),b=region(0),c=region(0);
add_region(a);add_region(b);add_region(c);remove_region(a);
assert.deepEqual(game.regions,[c,b],'last region replaces removed region');
assert.equal(reg_damg(a),0,'removed region has no damage');

await setup();
const reg=create_region([],0);
assert.deepEqual(reg.bounding_box,{lx:COLNO,ly:ROWNO,hx:0,hy:0});
const rect={lx:game.u.ux,ly:game.u.uy,hx:game.u.ux+1,hy:game.u.uy+1};
add_rect_to_reg(reg,rect);rect.hx=0;
assert.ok(inside_region(reg,game.u.ux+1,game.u.uy+1),'region owns its rectangle copy');
add_region(reg);assert.ok(reg.player_flags & REG_HERO_INSIDE);
reg.attach_2_u=true;update_player_regions();
assert.equal(reg.player_flags & REG_HERO_INSIDE,0,'attached region excludes hero membership');
reg.attach_2_u=false;update_player_regions();
mon=await monster(PMNAMES.PM_GOBLIN);
add_mon_to_reg(reg,mon);
assert.ok(mon_in_region(reg,mon));
assert.ok(reg.max_monst>=MONST_INC);
remove_monster(mon.mx,mon.my);place_monster(mon,game.u.ux+2,game.u.uy+2);
update_monster_region(mon);assert.ok(!mon_in_region(reg,mon),'movement removes stale membership');
await rloc_to(mon,game.u.ux,game.u.uy);
assert.ok(mon_in_region(reg,mon),'relocation enters cloud');
await rloc_to(mon,game.u.ux+2,game.u.uy+2);
assert.ok(!mon_in_region(reg,mon),'relocation leaves cloud');
add_mon_to_reg(reg,mon);remove_mon_from_reg(reg,mon);
assert.ok(!mon_in_region(reg,mon));
add_mon_to_reg(reg,mon);reg.monsters[reg.n_monst++]=0x7fffffff;
reg.max_monst=Math.max(reg.max_monst,reg.n_monst);reg.inside_f=0;
await run_regions();assert.deepEqual(reg.monsters.slice(0,reg.n_monst),[mon.m_id]);
assert.equal(reg.monsters[reg.n_monst],0,'expired member slot is zeroed');

// Feeling a dark floor can cover a cloud in the glyph buffer while the
// region remains present. A later normal map operation reveals it again.
await setup();
const x=game.u.ux+1,y=game.u.uy,loc=game.level.at(x,y);
loc.waslit=loc.lit=1; game.flags.dark_room=true; game.iflags.use_color=true;
await create_gas_cloud(x,y,1,8);vision_recalc(0);
map_location(x,y,true);
assert.ok(visible_region_at(x,y));
assert.equal(game.gbuf[y][x].disp_glyph.cmap,CM.S_poisoncloud);
feel_location(x,y);
assert.equal(game.gbuf[y][x].disp_glyph.cmap,CM.S_darkroom);
assert.ok(visible_region_at(x,y),'touch mapping does not delete the cloud');
console.log(`gas cloud state gate: ${replays} replays and source controls passed`);
