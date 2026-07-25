// end.js — the death sequence.
// C ref: src/end.c
//
// Seven of the 44 public sessions have their first divergence here, and not
// because of an RNG bug: they DIE and start a new game, and this port keeps
// playing a hero C has already killed. Every frame after that point is wrong.
//
// src/end.c is 1948 lines and done/done_in_by/really_done between them spend
// ZERO draws. The whole sequence is screens -- the DYWYPI prompt, the
// tombstone, the final inventory, the score -- and then a new game, whose
// u_init() and mklev() are where draws resume.

import { game } from './gstate.js';

function note_unported_end(what) {
    (game.unported ||= new Set()).add(what);
}

// src/end.c done() — the hero's game is over.
//
// `how` is one of the DIED/CHOKING/POISONING/... reasons in include/hack.h.
// Nothing here draws; done() prints and then either restores a life or ends
// the game.
export function done(how) {
    /* life-saving, the DYWYPI prompt, the tombstone, the final inventory and
       the score all need the end-of-game windows; and restarting needs
       newgame() to run a second time in this process. */
    note_unported_end(`done:${how}`);
    game.program_state_gameover = true;
}
