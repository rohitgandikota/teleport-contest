// C pager.c:422-554. Constructed states use real producers and the public
// description API. These checks do not establish ordinary native input reach.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setup, seed, form, x, y} from './status-followup-test-setup.mjs';
import {game} from '../js/gstate.js';
import {do_screen_description} from '../js/pager.js';
import {howmonseen, vision_reset, vision_recalc} from '../js/vision.js';
import {makemon, hideunder, set_mimic_sym} from '../js/makemon.js';
import {mksobj, mksobj_at} from '../js/mkobj.js';
import {addinv} from '../js/invent.js';
import {Amulet_on, Blindf_on} from '../js/do_wear.js';
import {setuwep} from '../js/wield.js';
import {mon_set_minvis} from '../js/worn.js';
import {oname, distant_monnam, coyotename, pmname} from '../js/do_name.js';
import {clonewiz} from '../js/wizard.js';
import {make_blinded, make_hallucinated, peffects} from '../js/potion.js';
import {newsym, see_monsters, glyph_at} from '../js/display.js';
import {create_gas_cloud} from '../js/region.js';
import {set_levltyp} from '../js/mkmaze.js';
import {stock_room} from '../js/shknam.js';
import {newcham, m_at} from '../js/mon.js';
import {getRngLog} from '../js/rng.js';
import {PMNAMES, NUMMONS} from '../js/monst_data.js';
import {ONAMES} from '../js/objects_data.js';
import {NO_MINVENT, MM_NOGRP, MM_NOWAIT, MM_NOMSG, POOL, DOOR,
    D_ISOPEN, SHOPBASE, ROOMOFFSET, ARTICLE_NONE} from '../js/const.js';

const flags = NO_MINVENT | MM_NOGRP | MM_NOWAIT | MM_NOMSG;
async function monster(id = PMNAMES.PM_HILL_ORC, xx = x + 1, yy = y) {
    const mon = await makemon(game.mons[id], xx, yy, flags);
    assert.ok(mon);
    newsym(xx, yy);
    return mon;
}
async function detect() {
    const potion = mksobj(ONAMES.POT_MONSTER_DETECTION, false, false);
    potion.blessed = true;
    await peffects(potion);
    assert.ok(game.u.intrinsic.HDetect_monsters > 0);
}
async function equip(type, name, putOn) {
    let obj = mksobj(type, false, false);
    if (name) obj = await oname(obj, name, 0);
    await addinv(obj);
    await putOn(obj);
    return obj;
}
const esp = () => equip(ONAMES.AMULET_OF_ESP, null, Amulet_on);
const eyes = () => equip(ONAMES.LENSES, 'The Eyes of the Overworld', Blindf_on);
const sting = () => equip(ONAMES.ELVEN_DAGGER, 'Sting', setuwep);
function describe(mon, suffix, xx = mon.mx, yy = mon.my) {
    newsym(xx, yy);
    const result = do_screen_description({x:xx,y:yy}, true, 0);
    assert.equal(typeof result?.then, 'undefined', 'public inspection stays synchronous');
    assert.equal(result.out_str.match(/ \[seen: (.*)\]$/)?.[1] || '', suffix);
    return result;
}
function refresh() { vision_reset(); vision_recalc(); see_monsters(); }

test('ordinary vision alone has no redundant suffix or RNG', async () => {
    await setup(); const mon = await monster();
    assert.equal(howmonseen(mon), 1); seed();
    assert.match(describe(mon, '').firstmatch, /hill orc/);
    assert.deepEqual(getRngLog(), []);
});
test('blessed detection adds normal vision then detection', async () => {
    await setup(); const mon = await monster(); await detect();
    assert.equal(howmonseen(mon), 33);
    describe(mon, 'normal vision, monster detection');
});
test('invisible detected monster without see-invisible has detection alone', async () => {
    await setup(); const mon = await monster(); mon_set_minvis(mon, false); await detect();
    assert.equal(howmonseen(mon), 32); describe(mon, 'monster detection');
});
test('see-invisible form preserves its separate label', async () => {
    await setup(); form(PMNAMES.PM_ARCHON); const mon = await monster();
    mon_set_minvis(mon, false); refresh();
    assert.equal(howmonseen(mon), 6); describe(mon, 'see invisible, infravision');
});
test('infravision form adds its label after normal vision', async () => {
    await setup(); form(PMNAMES.PM_ARCHON); const mon = await monster(); refresh();
    assert.equal(howmonseen(mon), 5); describe(mon, 'normal vision, infravision');
});
test('cold monster does not acquire an infravision label', async () => {
    await setup(); form(PMNAMES.PM_ARCHON); const mon = await monster(PMNAMES.PM_ACID_BLOB); refresh();
    assert.equal(howmonseen(mon), 1); describe(mon, '');
});
test('worn ESP amulet adds telepathy while sighted', async () => {
    await setup(); const mon = await monster(); await esp();
    assert.equal(howmonseen(mon), 9); describe(mon, 'normal vision, telepathy');
});
test('blind mind-flayer form senses a minded monster', async () => {
    await setup(); form(PMNAMES.PM_MIND_FLAYER); const mon = await monster();
    await make_blinded(100, false); refresh();
    assert.equal(howmonseen(mon), 8); describe(mon, 'telepathy');
});
test('mindless monster excludes telepathy despite worn ESP', async () => {
    await setup(); const mon = await monster(PMNAMES.PM_ACID_BLOB); await esp();
    assert.equal(howmonseen(mon), 1); describe(mon, '');
});
test('blind mindless monster has the real zero sensing mask', async () => {
    await setup(); const mon = await monster(PMNAMES.PM_ACID_BLOB); await esp();
    await make_blinded(100,false); refresh();
    assert.equal(howmonseen(mon),0);
    assert.notEqual(glyph_at(mon.mx,mon.my).kind,'mon');
    const result = do_screen_description({x:mon.mx,y:mon.my},true,0);
    assert.ok(!result.out_str.includes('[seen:'));
});
test('worn Eyes adds astral vision at a visible near square', async () => {
    await setup(); const mon = await monster(); await eyes(); refresh();
    assert.equal(game.u.xray_range, 3);
    assert.equal(howmonseen(mon), 17); describe(mon, 'normal vision, astral vision');
});
test('Eyes range boundary excludes a monster four squares away', async () => {
    await setup(); const mon = await monster(PMNAMES.PM_HILL_ORC, x + 4); await eyes(); refresh();
    assert.equal(howmonseen(mon), 1); describe(mon, '');
});
test('wielded Sting warns of orcs', async () => {
    await setup(); const mon = await monster(); const obj = await sting();
    assert.ok(obj.oartifact && game.u.uwep === obj);
    assert.equal(howmonseen(mon), 65); describe(mon, 'normal vision, warned of orcs');
});
test('Sting does not warn of an unrelated species', async () => {
    await setup(); const mon = await monster(PMNAMES.PM_GRID_BUG); await sting();
    assert.equal(howmonseen(mon), 1); describe(mon, '');
});
for (const [id, noun] of [[PMNAMES.PM_HUMAN,'humans'], [PMNAMES.PM_ELF,'elves']])
test(`vampire form warning uses canonical ${noun} plural`, async () => {
    await setup(); form(PMNAMES.PM_VAMPIRE); const mon = await monster(id); refresh();
    assert.ok(howmonseen(mon) & 64);
    describe(mon, `normal vision, warned of ${noun}`);
});
test('purple worm species warning falls back to the actual species name', async () => {
    await setup(); form(PMNAMES.PM_PURPLE_WORM); const mon = await monster(PMNAMES.PM_SHRIEKER); refresh();
    assert.equal(howmonseen(mon), 65); describe(mon, 'normal vision, warned of shriekers');
});
for (const invisible of [false, true]) test(`all six compatible senses retain C order, invisible=${invisible}`, async () => {
    await setup(); form(PMNAMES.PM_ARCHON); const mon = await monster();
    await esp(); await eyes(); await sting(); await detect();
    if (invisible) mon_set_minvis(mon, false);
    refresh();
    assert.equal(howmonseen(mon), invisible ? 126 : 125);
    describe(mon, `${invisible ? 'see invisible' : 'normal vision'}, infravision, telepathy, astral vision, monster detection, warned of orcs`);
});
test('hallucinated warning says paranoid delusion without extra naming draws', async () => {
    await setup(); const mon = await monster(); await sting(); await make_hallucinated(100, false);
    newsym(mon.mx, mon.my);
    const previous = Object.getOwnPropertyDescriptor(globalThis, '__rng_log_disp');
    try {
        globalThis.__rng_log_disp = true;
        seed(); game.dispCtx = null;
        const name = distant_monnam(mon, ARTICLE_NONE);
        const expectedCalls = getRngLog().map(s=>s.replace(/\s+@\s*.*$/, ''));
        seed(); game.dispCtx = null;
        const result = do_screen_description({x:mon.mx,y:mon.my}, true, 0);
        assert.match(result.out_str, /\[seen: normal vision, paranoid delusion\]$/);
        assert.equal(result.firstmatch, name);
        assert.deepEqual(getRngLog().map(s=>s.replace(/\s+@\s*.*$/, '')), expectedCalls);
    } finally {
        if (previous) Object.defineProperty(globalThis, '__rng_log_disp', previous);
        else delete globalThis.__rng_log_disp;
    }
});
test('real hideunder producer describes a detected spider under its floor object', async () => {
    await setup(); mksobj_at(ONAMES.ROCK, x + 1, y, false, false);
    const mon = await monster(PMNAMES.PM_CAVE_SPIDER);
    assert.equal(await hideunder(mon), true); await detect();
    assert.equal(mon.mundetected, 1);
    assert.match(describe(mon, 'monster detection').firstmatch, /, hiding under /);
});
test('real eel hiding producer describes murky water', async () => {
    await setup(); set_levltyp(x + 1, y, POOL);
    const mon = await monster(PMNAMES.PM_GIANT_EEL);
    assert.equal(await hideunder(mon), true); await detect();
    assert.match(describe(mon, 'monster detection').firstmatch, /, hiding in murky water$/);
});
test('mimic furniture appearance still uses the canonical article', async () => {
    await setup(); set_levltyp(x + 1, y, DOOR); game.level.at(x+1,y).doormask = D_ISOPEN;
    const mon = await monster(PMNAMES.PM_SMALL_MIMIC); set_mimic_sym(mon); await detect();
    assert.equal(mon.m_ap_type & 7, 1);
    assert.match(describe(mon, 'normal vision, monster detection').firstmatch, /, mimicking a (?:closed )?door$/);
});
test('detected object mimic preserves its remembered real floor object', async () => {
    await setup(); mksobj_at(ONAMES.ROCK, x + 1, y, false, false);
    const mon = await monster(PMNAMES.PM_SMALL_MIMIC); set_mimic_sym(mon); await detect();
    assert.equal(mon.m_ap_type & 7, 2);
    assert.match(describe(mon, 'normal vision, monster detection').firstmatch, /, mimicking a rock$/);
});
test('blind-created object mimic with no remembered object still says something', async () => {
    await setup(); newsym(x+1,y); await make_blinded(100,false);
    const mon = await monster(PMNAMES.PM_SMALL_MIMIC); await detect();
    assert.equal(mon.m_ap_type & 7,2);
    assert.notEqual(game.level.at(mon.mx,mon.my).remembered_glyph?.glyph?.kind,'obj');
    assert.match(describe(mon,'monster detection').firstmatch,/, mimicking something$/);
});
test('real Wizard clone appearance is not described with the ALTMON-only wording', async () => {
    await setup(); await clonewiz();
    const mon = game.level.monsters.find(m=>m.mnum === PMNAMES.PM_WIZARD_OF_YENDOR);
    assert.ok(mon); assert.equal(mon.m_ap_type & 7,3); await detect();
    const result = do_screen_description({x:mon.mx,y:mon.my},true,0);
    assert.ok(!result.firstmatch.includes('masquerading'));
    assert.equal(typeof result?.then,'undefined');
});
test('accurate coyote naming preserves the real helper draw and species suffix', async () => {
    await setup(); const mon = await monster(PMNAMES.PM_COYOTE); newsym(mon.mx,mon.my);
    seed(); game.dispCtx = null; const name = coyotename(mon); const calls = getRngLog();
    seed(); game.dispCtx = null;
    const result = do_screen_description({x:mon.mx,y:mon.my},true,0);
    assert.equal(result.firstmatch,(mon.mpeaceful ? 'peaceful ' : '')+name);
    assert.deepEqual(getRngLog(),calls);
});
test('every valid species and gender has a nonempty warning fallback name', async () => {
    await setup();
    for(let id=0;id<NUMMONS;id++) for(const gender of [0,1,2])
        assert.ok(pmname(game.mons[id],gender).trim().length>0, `species ${id}, gender ${gender}`);
});
for (const damage of [0, 1]) test(`real gas-cloud producer is included, damage=${damage}`, async () => {
    await setup(); const mon = await monster(PMNAMES.PM_HILL_ORC, x + 3);
    await detect(); await create_gas_cloud(mon.mx, mon.my, 1, damage); refresh();
    const result = do_screen_description({x:mon.mx,y:mon.my}, true, 0);
    assert.ok(glyph_at(mon.mx,mon.my).kind === 'mon');
    assert.match(result.firstmatch, damage ? /, in a cloud of poison gas$/ : /, in a cloud of vapor$/);
});
test('ordinary worm tail keeps its indefinite article', async () => {
    await setup(); const mon = await monster(PMNAMES.PM_LONG_WORM, x + 2); await detect();
    const tail = [...game.level.monAt].find(([pos,m])=>m === mon && pos !== `${mon.mx},${mon.my}`);
    assert.ok(tail, 'canonical worm producer places a tail');
    const [xx,yy] = tail[0].split(',').map(Number);
    assert.match(do_screen_description({x:xx,y:yy},true,0).firstmatch, /^tail of a /);
});
test('stocked shopkeeper transformed to a worm has no extra indefinite article', async () => {
    await setup();
    const room = {lx:x+1,hx:x+3,ly:y-1,hy:y+1,rtype:SHOPBASE,doorct:1,fdoor:0,roomnoidx:0};
    game.level.rooms = [room]; game.level.nroom = 1; game.level.doors = [{x,y:y-1}];
    for(let xx=room.lx;xx<=room.hx;xx++) for(let yy=room.ly;yy<=room.hy;yy++)
        game.level.at(xx,yy).roomno = ROOMOFFSET;
    set_levltyp(x,y-1,DOOR); game.level.at(x,y-1).doormask = D_ISOPEN;
    await stock_room(0,room); const mon = room.resident; assert.ok(mon?.isshk);
    assert.equal(await newcham(mon,game.mons[PMNAMES.PM_LONG_WORM],0), 1);
    assert.ok(mon.isshk && mon.wormno); await detect(); refresh();
    const tail = [...game.level.monAt].find(([pos,m])=>m === mon && pos !== `${mon.mx},${mon.my}`);
    assert.ok(tail); const [xx,yy] = tail[0].split(',').map(Number);
    assert.equal(m_at(xx,yy),mon);
    const result = do_screen_description({x:xx,y:yy},true,0);
    assert.match(result.firstmatch, /^tail of peaceful /);
    assert.ok(!result.firstmatch.startsWith('tail of a '));
    await make_hallucinated(100,false); newsym(xx,yy);
    assert.match(do_screen_description({x:xx,y:yy},true,0).firstmatch,/^tail of a /);
});
