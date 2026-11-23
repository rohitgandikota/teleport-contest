// Source contracts for do.c:404-783, reached only through public drop().
// These constructed states are not native recordings or coverage evidence.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { InMemoryStorage } from '../js/storage.js';
import { drop } from '../js/do.js';
import { addinv, obj_extract_self, weight } from '../js/invent.js';
import { mksobj, place_object } from '../js/mkobj.js';
import { make_engr_at, engr_at } from '../js/engrave.js';
import { maketrap } from '../js/mklev.js';
import { initRng, enableRngLog, getRngLog, rn2, rnd } from '../js/rng.js';
import { ONAMES as N } from '../js/objects_data.js';
import { PMNAMES as P } from '../js/monst_data.js';
import { ART_GRAYSWANDIR } from '../js/artilist_data.js';
import { Hallucination } from '../js/youprop.js';
import { epitaph } from '../js/dat_files.js';
import { ROOM, STONE, SINK, FOUNTAIN, THRONE, ALTAR, GRAVE, COLNO, ROWNO,
    IN_SIGHT, COULD_SEE, OBJ_INVENT, OBJ_FLOOR, OBJ_BURIED, OBJ_DELETED,
    OBJ_MINVENT, LOST_NONE, LOST_THROWN, LOST_DROPPED, W_RINGL, W_WEP, W_SWAPWEP,
    W_QUIVER, W_ARM, FROMOUTSIDE, DUST, PIT, BEAR_TRAP, HEADSTONE,
    T_LOOTED, F_LOOTED, AM_NONE, Align2amask, ECMD_TIME, ECMD_FAIL } from '../js/const.js';

const base = JSON.parse(readFileSync(new URL(
    'gen-sessions/recipes/command-result-flags.json', import.meta.url))).segments[0];
const d20 = ['rn2', 20], d5 = ['rn2', 5], d100 = ['rn2', 100];
const pair = [['rnd', COLNO - 3], ['rn2', ROWNO - 2]];
const typeName = type => Object.keys(N).find(name => N[name] === type);
let messages, prompts, reply, reads;

async function setup({ blind = false, deaf = false, halluc = false,
    resistance = 0, x = 31, y = 10, fill = ROOM } = {}) {
    const run = await runSegment({ ...base, moves: ' ', storage: new InMemoryStorage() });
    game._preNhgetchHook = null;
    for (const obj of [...game.level.objects]) obj_extract_self(obj);
    game.invent = []; game.level.buriedobjs = [];
    game.level.monsters = []; game.level.monAt.clear();
    game.level.traps = []; game.level.lev_engr = [];
    game.regions = []; game.timer_base = []; game.light_sources = [];
    game.u.ux = x; game.u.uy = y;
    for (const slot of ['uwep', 'uswapwep', 'uquiver', 'uarm', 'uarmc', 'uarmh',
        'uarmg', 'uarmf', 'uarmu', 'uarms', 'uamul', 'uleft', 'uright', 'ublindf', 'uball', 'uchain'])
        game.u[slot] = null;
    game.u.uswallow = false; game.u.ustuck = null; game.u.usteed = null;
    game.u.intrinsic = { HBlinded: blind ? 20 : 0, HDeaf: deaf ? 20 : 0,
        HHallucination: halluc ? 20 : 0 };
    game.u.uprops = { HALLUC: halluc ? 20 : 0, HALLUC_RES: resistance };
    game.u.blocked = {}; game.u.ublind = blind ? 1 : 0;
    game.u.usleep = 0; game.u.twoweap = false; game.multi = 0;
    game.u.ushops = ''; game.flags.acoustics = true; game.flags.verbose = true;
    game.level.flags.has_shop = false;
    game.dungeons[game.u.uz.dnum].flags.hellish = false;
    for (let xx = 0; xx < COLNO; xx++) for (let yy = 0; yy < ROWNO; yy++) {
        Object.assign(game.level.at(xx, yy), { typ: fill, lit: 1, flags: 0,
            looted: 0, roomno: 0, seenv: 0 });
        game.viz_array[yy][xx] = 0;
    }
    game.level.at(x, y).typ = SINK;
    game.level.flags.nsinks = 1; game.level.flags.nfountains = 0;
    game.viz_array[y][x] = blind ? 0 : IN_SIGHT | COULD_SEE;
    game._toplines = ''; game._toplin = 0; game._msg_history = [];
    game._pending_message = ''; game._win_stop = false;
    messages = []; prompts = []; reply = '\x1b'; reads = 0;
    // Feed the real tty input boundary. No gameplay helper or RNG is replaced.
    run._display.onEmptyQueue = () => {
        if (++reads > 100) throw Error('unexpected repeated input');
        const text = game.nhDisplay.grid[0].map(c => c.ch).join('').trimEnd();
        messages.push(text);
        if (text.includes('--More--')) return 32;
        if (text.startsWith('Call ')) {
            if (!prompts.length) prompts.push({ text, inventory: [...game.invent],
                inUse: game.invent[0]?.in_use, floor: game.level.objectsAt(x, y).slice() });
            const key = reply[0] || '\r'; reply = reply.slice(1);
            return key.charCodeAt(0);
        }
        return 27;
    };
}
async function item(type, fields = {}) {
    const obj = Object.assign(mksobj(type, false, false), {
        dknown: 1, known: 1, bknown: 1, blessed: 0, cursed: 0,
        in_use: false, how_lost: LOST_THROWN,
    }, fields);
    obj.owt = weight(obj);
    game.objects[type].oc_name_known = true;
    game.objects[type].oc_uname = null;
    await addinv(obj);
    // Acquisition clears how_lost in C invent.c:1075. Set the pre-drop marker
    // afterwards so the controls can distinguish the sink's early return.
    obj.how_lost = LOST_THROWN;
    return obj;
}
function text() { return [...messages, ...game._msg_history, game._toplines].join('\n'); }
function sourceDraws(seed, calls) {
    initRng(seed); enableRngLog();
    for (const [fn, n] of calls) (fn === 'rnd' ? rnd : rn2)(n);
    return getRngLog().slice();
}
async function dropWithDraws(obj, seed, calls, result = ECMD_TIME) {
    const expected = sourceDraws(seed, calls);
    initRng(seed); enableRngLog(); game.dispCtx = null;
    assert.equal(await drop(obj), result);
    assert.deepEqual(getRngLog(), expected, 'complete core sequence at the C drop boundary');
}
function ownership(obj, where) {
    assert.equal(obj.where, where);
    assert.equal(game.invent.includes(obj), where === OBJ_INVENT);
    assert.equal(game.level.objects.includes(obj), where === OBJ_FLOOR);
    assert.equal(game.level.buriedobjs.includes(obj), where === OBJ_BURIED);
    assert.equal(game.level.objectsAt(game.u.ux, game.u.uy).includes(obj), where === OBJ_FLOOR);
}

for (const [type, expected, absent, status] of [
    [N.RIN_LEVITATION, /sink quivers upward/, /bouncing down/, { blind: true }],
    [N.RIN_ADORNMENT, /ring bouncing down/, /faucets flash/, { blind: true }],
    [N.RIN_CONFLICT, /drop .* down the drain/, /loud noises|bouncing down/, { deaf: true }],
    [N.RIN_ADORNMENT, /drop .* down the drain/, /faucets flash|bouncing down/, { blind: true, deaf: true }],
    [N.RIN_SEE_INVISIBLE, /oxygen molecules/, /some air/, { halluc: true }],
    [N.RIN_AGGRAVATE_MONSTER, /Several .+ buzz angrily/, /Several flies buzz/, { halluc: true }],
    [N.RIN_SUSTAIN_ABILITY, /flow seems fixed/, /water flow seems fixed/, { halluc: true }],
    [N.RIN_SEE_INVISIBLE, /some air/, /oxygen molecules/, { halluc: true, resistance: W_ARM }],
]) test(`feedback ${typeName(type)} ${JSON.stringify(status)}`, async () => {
    await setup(status); const obj = await item(type);
    await dropWithDraws(obj, 1, [d20, d5]);
    assert.match(text(), expected); assert.doesNotMatch(text(), absent);
    ownership(obj, OBJ_DELETED); assert.equal(obj.how_lost, LOST_THROWN);
});

for (const [type, color, intrinsic] of [
    [N.RIN_WARNING, 'white', false], [N.RIN_PROTECTION, 'silver', true],
    [N.RIN_PROTECTION, 'black', false],
]) test(`resisted hallucination retains ${color} sink feedback`, async () => {
    await setup({ halluc: true, resistance: intrinsic ? 0 : W_ARM });
    if (intrinsic) game.u.intrinsic.HHalluc_resistance = FROMOUTSIDE;
    const obj = await item(type, { spe: color === 'black' ? -2 : 2 });
    assert.equal(Hallucination(), false);
    await dropWithDraws(obj, 1, [d20, d5]);
    assert.match(text(), new RegExp(`sink glows ${color} for a moment`));
});

for (const type of [N.RIN_SEARCHING, N.RIN_SLOW_DIGESTION]) test(`return ${typeName(type)} skips both disposal draws`, async () => {
    await setup(); const obj = await item(type, { oname: 'keepsake' });
    const oldWeight = obj.owt;
    await dropWithDraws(obj, 1, []);
    ownership(obj, OBJ_FLOOR); assert.equal(obj.in_use, false);
    assert.equal(obj.how_lost, LOST_THROWN); assert.equal(obj.owt, oldWeight);
    assert.equal(obj.oname, 'keepsake');
});

for (const [name, seed, calls, where] of [
    ['backup', 26, [d20], OBJ_FLOOR],
    ['burial', 5, [d20, d5], OBJ_BURIED],
    ['consumption', 1, [d20, d5], OBJ_DELETED],
]) test(`${name} preserves the ring state and single owner`, async () => {
    await setup(); const obj = await item(N.RIN_LEVITATION, { oname: 'keepsake' });
    const oldWeight = obj.owt;
    await dropWithDraws(obj, seed, calls);
    ownership(obj, where); assert.equal(obj.in_use, where === OBJ_DELETED);
    assert.equal(obj.how_lost, LOST_THROWN); assert.equal(obj.oname, 'keepsake');
    assert.equal(obj.quan, 1); assert.equal(obj.owt, oldWeight);
    if (where !== OBJ_DELETED) assert.deepEqual([obj.ox, obj.oy], [game.u.ux, game.u.uy]);
});
test('consuming one stacked meat ring recomputes retained inventory weight', async () => {
    await setup(); const obj = await item(N.MEAT_RING, { quan: 3, oname: 'snack' });
    const beforeWeight = obj.owt;
    await dropWithDraws(obj, 1, [d20, d5]);
    ownership(obj, OBJ_INVENT); assert.equal(obj.quan, 2);
    assert.equal(obj.owt, beforeWeight * 2 / 3); assert.equal(obj.in_use, false);
    assert.equal(obj.how_lost, LOST_THROWN); assert.equal(obj.oname, 'snack');
});

for (const returned of [false, true]) test(`type naming occurs ${returned ? 'after return' : 'before disposal'}`, async () => {
    await setup(); const obj = await item(returned ? N.RIN_SEARCHING : N.RIN_LEVITATION,
        { oname: 'my ring' });
    game.objects[obj.otyp].oc_name_known = false; reply = 'sink-test\r';
    await dropWithDraws(obj, 1, returned ? [] : [d20, d5]);
    assert.equal(prompts.length, 1);
    assert.equal(prompts[0].inventory.includes(obj), !returned);
    assert.equal(prompts[0].floor.includes(obj), returned);
    if (!returned) assert.equal(prompts[0].inUse, true);
    assert.equal(game.objects[obj.otyp].oc_uname, 'sink-test');
    assert.equal(game.objects[obj.otyp].oc_name_known, false);
    assert.equal(obj.oname, 'my ring');
});
test('blind visual-only effect does not offer a type name', async () => {
    await setup({ blind: true }); const obj = await item(N.RIN_ADORNMENT);
    game.objects[obj.otyp].oc_name_known = false;
    await dropWithDraws(obj, 1, [d20, d5]);
    assert.equal(prompts.length, 0); assert.equal(game.objects[obj.otyp].oc_uname, null);
});
test('a previously called ring keeps its name without a new prompt', async () => {
    await setup(); const obj = await item(N.RIN_CONFLICT);
    game.objects[obj.otyp].oc_name_known = false; game.objects[obj.otyp].oc_uname = 'prior';
    await dropWithDraws(obj, 1, [d20, d5]);
    assert.equal(prompts.length, 0); assert.equal(game.objects[obj.otyp].oc_uname, 'prior');
});

for (const blind of [false, true]) test(`hunger follows nexthere and protects ball/chain/artifact (${blind})`, async () => {
    await setup({ blind }); const ring = await item(N.RIN_HUNGER);
    const floor = (type, fields = {}) => Object.assign(mksobj(type, false, false), fields);
    const ball = floor(N.HEAVY_IRON_BALL), chain = floor(N.IRON_CHAIN);
    const a = floor(N.DAGGER, { oname: 'first' });
    const gray = floor(N.SILVER_SABER, { oartifact: ART_GRAYSWANDIR, oname: 'Grayswandir' });
    const b = floor(N.APPLE, { oname: 'second' }), amulet = floor(N.AMULET_OF_YENDOR);
    const other = floor(N.DAGGER, { oname: 'elsewhere' });
    game.u.uball = ball; game.u.uchain = chain;
    const local = [ball, a, amulet, gray, b, chain];
    for (const obj of local.toReversed()) place_object(obj, game.u.ux, game.u.uy);
    place_object(other, 20, 4);
    game.level.objects = [b, other, chain, gray, a, ball, amulet];
    await dropWithDraws(ring, 1, [d100, d100, d100, d100, d100, d20, d5]);
    assert.equal(a.where, OBJ_DELETED); assert.equal(b.where, OBJ_DELETED);
    assert.deepEqual(game.level.objectsAt(game.u.ux, game.u.uy), [ball, amulet, gray, chain]);
    assert.equal(other.where, OBJ_FLOOR); ownership(ring, OBJ_BURIED);
    if (blind) {
        assert.doesNotMatch(text(), /Suddenly/); assert.match(text(), /bouncing down/);
    } else {
        assert.match(text(), /first.*vanish[\s\S]*second.*vanish/);
        assert.doesNotMatch(text(), /elsewhere.*vanish|Grayswandir.*vanish/);
    }
});
test('hunger can destroy an artifact on the C 99-percent boundary', async () => {
    await setup(); const ring = await item(N.RIN_HUNGER);
    const gray = Object.assign(mksobj(N.SILVER_SABER, false, false),
        { oartifact: ART_GRAYSWANDIR, oname: 'Grayswandir' });
    place_object(gray, game.u.ux, game.u.uy);
    await dropWithDraws(ring, 284, [d100, d100, d20, d5]);
    assert.equal(gray.where, OBJ_DELETED); ownership(ring, OBJ_BURIED);
});

for (const looted of [0, 7]) test(`teleport success normalizes looted=${looted} and still draws after nosink`, async () => {
    await setup(); const ring = await item(N.RIN_TELEPORTATION);
    game.level.at(31, 10).looted = looted;
    await dropWithDraws(ring, 1, [...pair, d20, d5]);
    assert.equal(game.level.at(31, 10).typ, ROOM); assert.equal(game.level.at(31, 10).looted, 0);
    assert.equal(game.level.at(56, 12).typ, SINK); assert.equal(game.level.at(56, 12).looted, looted ? 1 : 0);
    assert.equal(game.level.flags.nsinks, 1); ownership(ring, OBJ_DELETED);
    assert.doesNotMatch(text(), /backs up|momentarily vanishes/);
});
for (const reject of ['trap', 'engraving', 'visible-distance-nine']) test(`teleport rejects ${reject} before the next candidate`, async () => {
    await setup(reject === 'visible-distance-nine' ? { x: 56, y: 9 } : {});
    const ring = await item(N.RIN_TELEPORTATION);
    if (reject === 'trap') maketrap(56, 12, PIT);
    if (reject === 'engraving') make_engr_at(56, 12, 'stay', null, 0, DUST);
    if (reject === 'visible-distance-nine') game.viz_array[12][56] = IN_SIGHT | COULD_SEE;
    await dropWithDraws(ring, 1, [...pair, ...pair, d20, d5]);
    assert.equal(game.level.at(4, 14).typ, SINK); assert.notEqual(game.level.at(56, 12).typ, SINK);
});
test('teleport accepts an unseen nearby room', async () => {
    await setup({ x: 56, y: 11 }); const ring = await item(N.RIN_TELEPORTATION);
    await dropWithDraws(ring, 1, [...pair, d20, d5]);
    assert.equal(game.level.at(56, 12).typ, SINK);
});
for (const success of [false, true]) test(`teleport ${success ? 'accepts the 200th try' : 'fails after exactly 200 tries'}`, async () => {
    await setup({ fill: STONE }); const ring = await item(N.RIN_TELEPORTATION);
    game.level.at(31, 10).looted = 7;
    // Seed 2 first reaches (14,5) on attempt 200; all earlier cells are STONE.
    if (success) game.level.at(14, 5).typ = ROOM;
    await dropWithDraws(ring, 2, [...Array.from({ length: 200 }, () => pair).flat(), d20, d5]);
    assert.equal(game.level.at(31, 10).typ, success ? ROOM : SINK);
    assert.equal(game.level.at(31, 10).looted, success ? 0 : 7);
    assert.equal(game.level.at(14, 5).typ, success ? SINK : STONE);
    assert.equal(game.level.flags.nsinks, 1);
    assert.match(text(), success ? /sink vanishes/ : /sink momentarily vanishes/);
});

for (const [seed, typ, looted, hell, alignment] of [
    [5, FOUNTAIN, 0], [26, FOUNTAIN, 7], [1, THRONE, 0], [1, THRONE, 7],
    [4, ALTAR, 7, false, 0], [13, ALTAR, 0, false, 1], [21, ALTAR, 0, false, -1],
    [4, ALTAR, 0, true, null], [19, ALTAR, 0, true, 0],
]) test(`polymorph terrain ${typ}, seed ${seed}, looted ${looted}, hell ${!!hell}`, async () => {
    await setup(); const ring = await item(N.RIN_POLYMORPH);
    const loc = game.level.at(31, 10); loc.looted = looted; loc.flags = 7;
    game.dungeons[game.u.uz.dnum].flags.hellish = !!hell;
    const calls = [['rn2', 4]];
    if (typ === ALTAR) { calls.push(['rn2', 3]); if (hell) calls.push(['rn2', 3]); }
    await dropWithDraws(ring, seed, [...calls, d20, d5]);
    assert.equal(loc.typ, typ); assert.equal(game.level.flags.nsinks, 0);
    assert.equal(game.level.flags.nfountains, typ === FOUNTAIN ? 1 : 0);
    assert.equal(loc.flags, 0);
    assert.equal(loc.looted, typ === ALTAR ? 0 : looted ? (typ === THRONE ? T_LOOTED : F_LOOTED) : 0);
    if (typ === FOUNTAIN) assert.equal(loc.blessedftn, 0);
    if (typ === ALTAR) assert.equal(loc.altarmask, alignment === null ? AM_NONE : Align2amask(alignment));
    assert.match(text(), /sink transforms into (a fountain|an opulent throne|an altar)!/);
    assert.doesNotMatch(text(), /undefined|backs up/);
});
for (const blocked of [false, true]) test(`polymorph grave ${blocked ? 'blocked by trap' : 'with epitaph'}`, async () => {
    await setup({ blind: true }); const ring = await item(N.RIN_POLYMORPH);
    if (blocked) {
        // Construct the C t_at() branch. Ordinary maketrap refuses furniture.
        game.level.at(31, 10).typ = ROOM;
        assert.ok(maketrap(31, 10, BEAR_TRAP));
        game.level.at(31, 10).typ = SINK;
    }
    const calls = [['rn2', 4]];
    // get_rnd_text skips the first comment line, then samples the remaining bytes.
    if (!blocked) calls.push(['rn2', epitaph.length - epitaph.indexOf('\n') - 1]);
    await dropWithDraws(ring, 3, [...calls, d20, d5]);
    assert.equal(game.level.at(31, 10).typ, blocked ? ROOM : GRAVE);
    assert.equal(game.level.flags.nsinks, 0);
    if (!blocked) assert.equal(engr_at(31, 10).engr_type, HEADSTONE);
    assert.match(text(), blocked ? /sink vanishes/ : /sink transforms into a grave/);
});

test('ordinary item and ordinary terrain keep the original drop path', async () => {
    await setup(); let obj = await item(N.DAGGER);
    await dropWithDraws(obj, 1, []); ownership(obj, OBJ_FLOOR);
    assert.equal(obj.how_lost, LOST_DROPPED); assert.doesNotMatch(text(), /down the drain/);
    await setup(); game.level.at(31, 10).typ = ROOM; obj = await item(N.RIN_LEVITATION);
    await dropWithDraws(obj, 1, []); ownership(obj, OBJ_FLOOR);
    assert.equal(obj.how_lost, LOST_DROPPED); assert.doesNotMatch(text(), /down the drain/);
});
test('engulfment takes precedence over the underlying sink', async () => {
    await setup(); const obj = await item(N.RIN_LEVITATION);
    const mon = { mnum: P.PM_FOG_CLOUD, data: game.mons[P.PM_FOG_CLOUD],
        mx: 31, my: 10, mhp: 30, mhpmax: 30, minvent: [], m_id: 90001 };
    game.u.uswallow = true; game.u.ustuck = mon;
    await dropWithDraws(obj, 1, []);
    assert.equal(obj.where, OBJ_MINVENT); assert.equal(obj.ocarry, mon);
    assert.ok(mon.minvent.includes(obj)); assert.equal(game.invent.includes(obj), false);
    assert.equal(obj.how_lost, LOST_NONE); assert.doesNotMatch(text(), /down the drain/);
});
test('worn ring is refused before sink feedback or RNG', async () => {
    await setup(); const obj = await item(N.RIN_LEVITATION, { owornmask: W_RINGL });
    game.u.uleft = obj;
    await dropWithDraws(obj, 1, [], ECMD_FAIL); ownership(obj, OBJ_INVENT);
    assert.equal(obj.in_use, false); assert.equal(obj.how_lost, LOST_THROWN);
    assert.match(text(), /cannot drop something you are wearing/);
    assert.doesNotMatch(text(), /down the drain/);
});
for (const [slot, mask] of [['uwep', W_WEP], ['uswapwep', W_SWAPWEP], ['uquiver', W_QUIVER]])
    test(`dropping a ring releases ${slot} before sink disposal`, async () => {
        await setup(); const obj = await item(N.RIN_LEVITATION, { owornmask: mask });
        game.u[slot] = obj;
        await dropWithDraws(obj, 1, [d20, d5]);
        assert.equal(game.u[slot], null); assert.equal(obj.owornmask, 0);
        ownership(obj, OBJ_DELETED);
    });
test('sink dispatch precedes the cannot-reach-floor branch', async () => {
    await setup(); const obj = await item(N.RIN_SEARCHING);
    game.u.intrinsic.HLevitation = FROMOUTSIDE;
    await dropWithDraws(obj, 1, []);
    assert.match(text(), /down the drain/); ownership(obj, OBJ_FLOOR);
    assert.equal(obj.how_lost, LOST_THROWN);
});
