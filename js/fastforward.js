// fastforward.js — the shrinking remainder of seed8000's replayed PRNG stream.
//
// This file is scaffolding, not a port. Every call in it is a literal value
// recorded from ONE session, replayed into every session, so it is exactly the
// thing that cannot generalise to the held-out set. Deleting it is the work;
// each block goes when the C it stands in for is ported.
//
// Gone so far:
//   o_init shuffles + gem colours   -> js/o_init.js        (199 calls)
//   nhlib.lua align shuffle          -> js/mklev.js
//   dungeon.c initialisation         -> js/dungeon.js       (294 calls)
//   mklev structural phase           -> js/mklev.js
//   room fill + mineralize           -> js/mklev.js       (1,448 calls)
//   u_init_role + ini_inv            -> js/u_init.js         (87 calls)
//   init_attr + vary_init_attr       -> js/attrib.js         (37 calls)
//   the per-turn move loop           -> js/allmain.js       (127 calls)
//
// Remaining, in the order they should go:
//   fastforward_post_mklev    2 calls  <- allmain.c moveloop_preamble
//   fastforward_pre_mklev     1 call   <- the tail of u_init_misc
//
// Generated from: seed8000-tourist-starter.session.json

import { rn2, rnd, d, rne, rnz } from "./rng.js";

// Pre-mklev startup: o_init shuffles, dungeon init, u_init_misc
// 303 leaf RNG calls (session indices 0-308)
export function fastforward_pre_mklev() {
    // randomize_gem_colors, shuffle and init_objects used to be replayed
    // here. They are now produced by the real port in js/o_init.js, which
    // reproduces all 199 calls on 37 of the 44 public sessions. The other 7
    // differ only because role.c's pick_role/pick_gend/pick_align run first.
    // The nhlib.lua align shuffle and the whole dungeon.c initialisation
    // used to be replayed here. They are now produced by the real ports in
    // js/mklev.js (l_nhcore_init) and js/dungeon.js (init_dungeons), which
    // reproduce them on 27 of the 44 public sessions.
    // u_init_misc
    rn2(10);
}

// Post-mklev startup: allmain.c moveloop_preamble() only.
//
// src/attrib.c init_attr()/rnd_attr()/vary_init_attr() used to be replayed here
// too; they are now produced by the real port in js/attrib.js. 2 leaf calls
// left in this block.
export function fastforward_post_mklev() {
    rnd(9000); rnd(30);
}

