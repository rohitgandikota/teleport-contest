// monst.js — the macros from include/monst.h.
//
// Same role js/obj.js plays for include/obj.h and js/mondata.js for
// include/mondata.h: a header's macros are shared by every C file that includes
// it, so they need one JS home rather than a private copy per module. There was
// already a second copy of DEADMONSTER living in js/dog.js, which is how a
// header macro drifts.

// include/monst.h:214 DEADMONSTER()
export const DEADMONSTER = (mon) => (mon.mhp ?? 0) < 1;
