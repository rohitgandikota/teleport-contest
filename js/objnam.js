// objnam.js — object naming.
// C ref: src/objnam.c
//
// Only obj_typename() so far, which is what the discoveries window needs. It
// composes the class word, the actual name (once discovered) and the shuffled
// appearance in parentheses:
//
//   "scroll" + " of magic mapping" + " (ANDOVA BEGARIN)"
//
// The appearance comes from obj_descr[oc_descr_idx], and oc_descr_idx is what
// js/o_init.js shuffles at game start — so a correct label here is also a
// direct check that the o_init port is right.

import { game } from './gstate.js';
import { OCLASSES, ONAMES, obj_descr } from './objects_data.js';

const {
    COIN_CLASS, POTION_CLASS, SCROLL_CLASS, WAND_CLASS, SPBOOK_CLASS,
    RING_CLASS, AMULET_CLASS, ARMOR_CLASS, GEM_CLASS,
} = OCLASSES;

// include/objclass.h:190-191
export const OBJ_NAME = (ocl) => obj_descr[ocl.oc_name_idx]?.oc_name ?? null;
export const OBJ_DESCR = (ocl) => obj_descr[ocl.oc_descr_idx]?.oc_descr ?? null;

// include/objclass.h:38-44 — armour category, stored in oc_subtyp.
export const ARM_SUIT = 0, ARM_SHIELD = 1, ARM_HELM = 2, ARM_GLOVES = 3,
             ARM_BOOTS = 4, ARM_CLOAK = 5, ARM_SHIRT = 6;

const GemStone = (otyp) =>
    game.objects[otyp].oc_class === GEM_CLASS
    && game.objects[otyp].oc_material === 8 /* MINERAL */;

// src/objnam.c:220 obj_typename()
export function obj_typename(otyp) {
    const ocl = game.objects[otyp];
    const actualn = OBJ_NAME(ocl) ?? 'object?';
    const dn = OBJ_DESCR(ocl);
    const un = ocl.oc_uname || null;
    const nn = ocl.oc_name_known;
    let buf = '';

    switch (ocl.oc_class) {
    case COIN_CLASS:
        return actualn;
    case POTION_CLASS: buf = 'potion'; break;
    case SCROLL_CLASS: buf = 'scroll'; break;
    case WAND_CLASS:   buf = 'wand'; break;
    case SPBOOK_CLASS: buf = 'spellbook'; break;
    case RING_CLASS:   buf = 'ring'; break;
    case AMULET_CLASS:
        buf = nn ? actualn : 'amulet';
        if (un) buf += ` called ${un}`;
        if (dn) buf += ` (${dn})`;
        return buf;
    case ARMOR_CLASS:
        if (ocl.oc_subtyp === ARM_GLOVES || ocl.oc_subtyp === ARM_BOOTS)
            buf = 'pair of ';
        /* FALLTHRU */
    default:
        if (nn) {
            buf += actualn;
            if (GemStone(otyp)) buf += ' stone';
            if (un) buf += ` called ${un}`;
            if (dn) buf += ` (${dn})`;
        } else {
            buf += (dn || actualn);
            if (ocl.oc_class === GEM_CLASS)
                buf += (ocl.oc_material === 8) ? ' stone' : ' gem';
            if (un) buf += ` called ${un}`;
        }
        return buf;
    }

    /* ring / scroll / potion / wand / spellbook */
    if (nn) {
        if (ocl.oc_unique)
            buf = actualn;
        else
            buf += ` of ${actualn}`;
    }
    if (un) buf += ` called ${un}`;
    if (dn) buf += ` (${dn})`;
    return buf;
}
