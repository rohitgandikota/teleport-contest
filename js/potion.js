// potion.js — potion effects.
// C ref: src/potion.c
//
// Only healup() so far, reached by the healing spells' zapyourself route.

import { game } from './gstate.js';

function note_unported_potion(what) {
    (game.unported ||= new Set()).add(what);
}

// src/potion.c:1428 healup()
export function healup(nhp, nxtra, curesick, cureblind) {
    const u = game.u;

    if (nhp) {
        /* the Upolyd arm reads u.mh; polyself is not ported */
        u.uhp += nhp;
        if (u.uhp > u.uhpmax) {
            u.uhp = (u.uhpmax += nxtra);
            if (u.uhpmax > (u.uhppeak || 0))
                u.uhppeak = u.uhpmax;
        }
    }
    if (cureblind) {
        /* make_blinded(0)/make_deaf(0) cure; visible only while afflicted */
        if (u.ucreamed || u.ublind || u.uprops?.DEAF)
            note_unported_potion('healup:cureblind');
        u.ucreamed = 0;
    }
    if (curesick) {
        if (u.uprops?.VOMITING || u.uprops?.SICK)
            note_unported_potion('healup:curesick');
    }
    (game.disp ||= {}).botl = true;
}
