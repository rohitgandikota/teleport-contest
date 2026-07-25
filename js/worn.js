// worn.js — what a monster or the hero currently has on.
// C ref: src/worn.c
//
// Nothing here draws.

import { game } from './gstate.js';
import { W_ARM, W_ARMC, W_ARMH, W_ARMS, W_ARMG, W_ARMF, W_ARMU } from './const.js';

// src/worn.c which_armor() — the object worn in a given slot, or null.
//
// Monsters do not don armour in this port yet (m_dowear is absent), so the
// minvent scan finds nothing for them. That is the honest answer for a monster
// carrying an unworn shield, and it is the same answer the C gives; it becomes
// wrong only once m_dowear exists, at which point this needs no change.
export function which_armor(mon, flag) {
    if (mon === game.youmonst) {
        switch (flag) {
        case W_ARM:  return game.uarm  || null;
        case W_ARMC: return game.uarmc || null;
        case W_ARMH: return game.uarmh || null;
        case W_ARMS: return game.uarms || null;
        case W_ARMG: return game.uarmg || null;
        case W_ARMF: return game.uarmf || null;
        case W_ARMU: return game.uarmu || null;
        default:     return null;   /* impossible("bad flag in which_armor") */
        }
    } else {
        for (const obj of (mon.minvent || []))
            if (obj.owornmask & flag)
                return obj;
        return null;
    }
}
