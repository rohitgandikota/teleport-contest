// youprop.js — the hero-property macros from include/youprop.h.
//
// Same role js/monst.js plays for include/monst.h, js/obj.js for include/obj.h
// and js/mondata.js for include/mondata.h: a header's macros are shared by
// every C file that includes it, so they need one JS home rather than a
// private copy per module.
//
// Hallucination arrived here because two modules wanted it and js/invent.js
// had it as a private `return false` stub. A stub is fine while nothing sets
// the property, but it goes on being quietly wrong after something does, and
// nothing catches that. Reading the real uprops entry costs the same and
// starts telling the truth by itself.
//
// Nothing here draws.

import { game } from './gstate.js';

// include/youprop.h:116 HHallucination — u.uprops[HALLUC].intrinsic.
// The C comment above it reads "Hallucination is solely a timeout", which is
// why this is .intrinsic and there is no EHallucination to go with it.
export const HHallucination = () => !!game.u?.uprops?.HALLUC;

// include/youprop.h:117 HHalluc_resistance, :118 EHalluc_resistance,
// :119 Halluc_resistance. The port models uprops as a flat prop -> value map
// rather than C's {intrinsic, extrinsic, blocked} struct, so the two halves
// collapse into the one read; when uprops grows the struct, split them here.
export const Halluc_resistance = () => !!game.u?.uprops?.HALLUC_RES;

// include/youprop.h:120 Hallucination()
export const Hallucination = () => HHallucination() && !Halluc_resistance();

// include/youprop.h:123 HDeaf, :124 EDeaf, :125 Deaf.
// As with HALLUC above, the flat uprops map collapses intrinsic and extrinsic
// into one read. u.uroleplay.deaf is the deaf conduct, chosen at startup.
export const Deaf = () => !!game.u?.uprops?.DEAF || !!game.u?.uroleplay?.deaf;

// include/youprop.h:279 Underwater()
export const Underwater = () => !!game.u?.uinwater;

// include/youprop.h:399 Unaware — (gm.multi < 0 && (unconscious() ||
// is_fainted())).
//
// The multi test comes first in the C and it is a real short circuit, not a
// cheap-test-first optimisation: with multi >= 0 the macro is FALSE whatever
// the other two return. So this is exactly right whenever the hero is not in a
// multi-turn occupation, which is the overwhelmingly common case, and only the
// multi < 0 branch is a gap. unconscious() and is_fainted() both need sleep
// and fainting state that is not ported; recording there rather than guessing
// keeps the gap visible instead of burying it in a `return false`.
export const Unaware = () => {
    if (!(game.multi < 0))
        return false;               /* definitively false, nothing to guess */
    (game.unported ||= new Set()).add('youprop:Unaware');
    return false;
};
