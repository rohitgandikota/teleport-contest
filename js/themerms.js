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
import { percent } from './nhlua.js';
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
