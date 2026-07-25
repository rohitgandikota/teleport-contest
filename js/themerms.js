// themerms.js — the themeroom fills.
// C ref: dat/themerms.lua
//
// Each fill is a Lua `contents` function. They are transcribed here rather than
// interpreted, the same way js/mklev.js already transcribes the shaped rooms'
// contents.
//
// Order matters more than usual: themeroom_fill() picks one by reservoir
// sample (which draws), and then the chosen fill draws too. Wiring the sample
// without the fills makes several sessions diverge EARLIER, measured at -915
// RNG positions, because C keeps drawing exactly where we would go quiet.

import { game } from './gstate.js';
import { rn2 } from './rng.js';
import { percent, lua_shuffle, lua_d, nh_random } from './nhlua.js';
import { level_difficulty } from './makemon.js';
import { selection_from_mkroom, selection_iterate,
         selection_filter_percent, selection_numpoints } from './selvar.js';
import { lspo_terrain } from './sp_lev.js';

function note_unported_themerms(what) {
    (game.unported ||= new Set()).add(what);
}

// dat/themerms.lua:47 "Ice room"
//
//     local ice = selection.room();
//     des.terrain(ice, "I");
//     if (percent(25)) then
//        local mintime = 1000 - (nh.level_difficulty() * 100);
//        local ice_melter = function(x,y)
//           nh.start_timer_at(x,y, "melt-ice", mintime + nh.rn2(1000));
//        end;
//        ice:iterate(ice_melter);
//     end
//
// The percent(25) is spent whether or not any square melts, and the rn2(1000)
// is spent once PER SQUARE when it passes.
export function fill_ice_room(rm) {
    const ice = selection_from_mkroom(rm);

    lspo_terrain(ice, 'I');
    if (percent(25)) {
        const mintime = 1000 - (level_difficulty() * 100);

        selection_iterate(ice, (x, y) => {
            /* nh.start_timer_at(x, y, "melt-ice", mintime + nh.rn2(1000)) —
               the draw is real and ordered; the timer itself needs the timeout
               queue, which is not ported. */
            const when = mintime + rn2(1000);
            note_unported_themerms('start_timer_at:melt-ice');
            return when;
        });
    }
}

// dat/themerms.lua:76 "Boulder room"
//
//     local locs = selection.room():percentage(30);
//     local func = function(x,y)
//        if (percent(50)) then des.object("boulder", x, y);
//        else des.trap("rolling boulder", x, y); end
//     end;
//     locs:iterate(func);
//
// percentage(30) spends one rn2(100) per square of the room, then the iterate
// spends one rn2(100) per SELECTED square. Both are ported; the object and trap
// placement is what still records.
export function fill_boulder_room(rm) {
    const locs = selection_filter_percent(selection_from_mkroom(rm), 30);

    selection_iterate(locs, (x, y) => {
        if (percent(50))
            note_unported_themerms('des.object:boulder');
        else
            note_unported_themerms('des.trap:rolling boulder');
    });
}

// dat/themerms.lua:105 "Trap room"
//
//     local traps = { "arrow", "dart", "falling rock", "bear",
//                     "land mine", "sleep gas", "rust", "anti magic" };
//     shuffle(traps);
//     local locs = selection.room():percentage(30);
//     locs:iterate(function(x,y) des.trap(traps[1], x, y) end);
//
// shuffle() on eight entries spends rn2(8) down to rn2(2), seven draws, BEFORE
// the percentage() pass. Only traps[1] is ever used, but the whole shuffle
// happens regardless.
export function fill_trap_room(rm) {
    const traps = ['arrow', 'dart', 'falling rock', 'bear',
                   'land mine', 'sleep gas', 'rust', 'anti magic'];

    lua_shuffle(traps);

    const locs = selection_filter_percent(selection_from_mkroom(rm), 30);

    selection_iterate(locs, (x, y) => {
        note_unported_themerms(`des.trap:${traps[0]}`);
    });
}

// dat/themerms.lua:176 "Statuary"
//
//     for i = 1, d(5,5) do des.object({ id = "statue" }); end
//     for i = 1, d(3) do des.trap("statue"); end
//
// Lua evaluates each loop bound ONCE, so d(5,5)'s five draws all happen before
// any statue is placed, and d(3)'s single draw after the last one.
export function fill_statuary(rm) {
    const nstatues = lua_d(5, 5);
    for (let i = 1; i <= nstatues; i++)
        note_unported_themerms('des.object:statue');

    const ntraps = lua_d(3);
    for (let i = 1; i <= ntraps; i++)
        note_unported_themerms('des.trap:statue');
}

// dat/themerms.lua:157 "Massacre"
//
//     local idx = math.random(#mon);
//     for i = 1, d(5,5) do
//        if (percent(10)) then idx = math.random(#mon); end
//        des.object({ id = "corpse", montype = mon[idx] });
//     end
//
// The first math.random(27) is spent before the count, and the percent(10)
// inside the loop is spent EVERY iteration whether or not it re-rolls idx.
export function fill_massacre(rm) {
    const mon = ['apprentice', 'warrior', 'ninja', 'thug',
                 'hunter', 'acolyte', 'abbot', 'page',
                 'attendant', 'neanderthal', 'chieftain',
                 'student', 'wizard', 'valkyrie', 'tourist',
                 'samurai', 'rogue', 'ranger', 'priestess',
                 'priest', 'monk', 'knight', 'healer',
                 'cavewoman', 'caveman', 'barbarian',
                 'archeologist'];
    let idx = nh_random(1, mon.length);     /* math.random(#mon) */
    const n = lua_d(5, 5);

    for (let i = 1; i <= n; i++) {
        if (percent(10))
            idx = nh_random(1, mon.length);
        note_unported_themerms('des.object:corpse');
    }
}

// dat/themerms.lua:191 "Light source" — one unlit-room object, no draws.
export function fill_light_source(rm) {
    note_unported_themerms('des.object:oil lamp');
}

// dat/themerms.lua:199 "Temple of the gods" — three altars, one per alignment,
// in the order nhlib.lua's shuffled `align` table holds them. The shuffle
// happened once at nhl_init(); nothing draws here.
export function fill_temple_of_the_gods(rm) {
    for (const _ of (game.splev_align || []))
        note_unported_themerms('des.altar');
}

// dat/themerms.lua:92 "Spider nest"
//
//     local spooders = nh.level_difficulty() > 8;
//     local locs = selection.room():percentage(30);
//     locs:iterate(function(x,y)
//        des.trap({ type = "web", x = x, y = y,
//                   spider_on_web = spooders and percent(80) });
//     end);
//
// Lua's `and` SHORT-CIRCUITS, so percent(80) is evaluated only when spooders is
// true. On a level of difficulty 8 or less this fill spends no draws inside the
// loop at all; above it, one per selected square. Writing it as an unconditional
// percent(80) would add a draw per square on every shallow level.
export function fill_spider_nest(rm) {
    const spooders = level_difficulty() > 8;
    const locs = selection_filter_percent(selection_from_mkroom(rm), 30);

    selection_iterate(locs, (x, y) => {
        const spider_on_web = spooders && percent(80);
        note_unported_themerms('des.trap:web');
    });
}

// dat/themerms.lua:253 "Storeroom"
//
//     local locs = selection.room():percentage(30);
//     locs:iterate(function(x,y)
//        if (percent(25)) then des.object("chest");
//        else des.monster({ class = "m", appear_as = "obj:chest" }); end
//     end);
export function fill_storeroom(rm) {
    const locs = selection_filter_percent(selection_from_mkroom(rm), 30);

    selection_iterate(locs, (x, y) => {
        if (percent(25))
            note_unported_themerms('des.object:chest');
        else
            note_unported_themerms('des.monster:mimic-as-chest');
    });
}

// dat/themerms.lua:65 "Cloud room"
//
//     local fog = selection.room();
//     for i = 1, (fog:numpoints() / 4) do
//        des.monster({ id = "fog cloud", asleep = true });
//     end
//     des.gas_cloud({ selection = fog });
//
// Lua's numeric for with a fractional limit runs while i <= limit, so a room of
// 14 squares gives 3.5 and three iterations. No draws here; the monsters and
// the gas cloud are what record.
export function fill_cloud_room(rm) {
    const fog = selection_from_mkroom(rm);
    const limit = selection_numpoints(fog) / 4;

    for (let i = 1; i <= limit; i++)
        note_unported_themerms('des.monster:fog cloud');

    note_unported_themerms('des.gas_cloud');
}
