// monmove.js — monster movement.
// C ref: src/monmove.c
//
// distfleeck() draws rn2(5) unconditionally at its head (the "brave gremlin"
// roll), once per monster that acts, so it is the first thing a turn with
// awake monsters spends after the movement allotment.

import { game } from './gstate.js';
import { rn2 } from './rng.js';
import { dog_move } from './dog.js';
import { mfndpos, mon_allowflags } from './mon.js';
import { MONSYMS, MFLAGS } from './monst_data.js';
import { ALLOW_U } from './const.js';

// src/monmove.c:532 distfleeck()
export function distfleeck(mtmp) {
    const bravegremlin = (rn2(5) === 0);

    /* The rest is positional: inrange/nearby/scared from the monster's idea of
       where the hero is, plus onscary(). None of it draws. */
    return { inrange: false, nearby: false, scared: false, bravegremlin };
}

// src/monmove.c:700 dochug() — one monster's turn.
export function dochug(mtmp) {
    if (mtmp.msleeping)
        return 0;                     /* asleep monsters do not act */

    distfleeck(mtmp);

    /* src/monmove.c:1773 — m_move() dispatches a tame monster to dog_move()
       BEFORE it calls mfndpos(), so the pet path does not need the 243-line
       candidate-square search at all. */
    if (mtmp.mtame)
        return dog_move(mtmp, 0);

    return m_move(mtmp, 0);
}

// src/monmove.c:1720 m_move() — a non-tame monster's turn. The tame case is
// dispatched to dog_move() above, exactly as C does at :1773.
export function m_move(mtmp, after) {
    const ptr = mtmp.data;
    const omx = mtmp.mx, omy = mtmp.my;

    /* mtrapped / meating / hides_under all come first in C; the first two
       draw nothing here and the third needs an object underfoot. */
    if (hides_under(ptr) && OBJ_AT(omx, omy) && rn2(10))
        return MMOVE_NOTHING;      /* do not leave hiding place */

    let ggx = mtmp.mux, ggy = mtmp.muy;
    let appr = mtmp.mflee ? -1 : 1;

    if (mtmp.mconf) {
        appr = 0;
    } else {
        const should_see = (dist2(omx, omy, ggx, ggy) <= 36);

        if (!mtmp.mcansee
            || (mtmp.mpeaceful && !mtmp.isshk)
            || ((ptr.mlet === MONSYMS.S_BAT || ptr.mlet === MONSYMS.S_LIGHT)
                && !rn2(3)))
            appr = 0;

        /* leppie_avoidance, m_balks_at_approaching and gettrack all change
           appr or the goal without drawing; none is ported. */
        note_unported('m_move appr adjustments');
    }

    /* src/monmove.c:1891 — the pickup branch. The rn2(10) fires for every
       PEACEFUL monster whether or not it then picks anything up. */
    if ((!mtmp.mpeaceful || !rn2(10))) {
        note_unported('m_move ranged/pickup branch');
    }

    const flag = mon_allowflags(mtmp);
    const mfp = {};
    const cnt = mfndpos(mtmp, mfp, flag);
    if (cnt === 0)
        return MMOVE_NOMOVES;

    let chcnt = 0;
    const jcnt = Math.min(MTSZ, cnt - 1);
    let chi = -1;
    let nix = omx, niy = omy;
    let nidist = dist2(nix, niy, ggx, ggy);
    let mmoved = MMOVE_NOTHING;

    for (let i = 0; i < cnt; i++) {
        const nx = mfp.poss[i].x, ny = mfp.poss[i].y;

        if (appr !== 0) {
            const track = mtmp.mtrack || [];
            let skip = false;
            for (let j = 0; j < jcnt; j++)
                if (track[j] && nx === track[j].x && ny === track[j].y)
                    if (rn2(4 * (cnt - j))) { skip = true; break; }
            if (skip) continue;
        }

        const ndist = dist2(nx, ny, ggx, ggy);
        const nearer = ndist < nidist;

        if ((appr === 1 && nearer) || (appr === -1 && !nearer)
            || (!appr && !rn2(++chcnt))
            || (mmoved === MMOVE_NOTHING)) {
            nix = nx;
            niy = ny;
            nidist = ndist;
            chi = i;
            mmoved = MMOVE_MOVED;
        }
    }

    if (mmoved === MMOVE_MOVED && (nix !== omx || niy !== omy)) {
        if (chi >= 0 && (mfp.info[chi] & ALLOW_U)) {
            note_unported('mattacku');
            return MMOVE_DONE;
        }
        mtmp.mtrack = mtmp.mtrack || [];
        mtmp.mtrack.unshift({ x: omx, y: omy });
        if (mtmp.mtrack.length > MTSZ) mtmp.mtrack.length = MTSZ;
        mtmp.mx = nix;
        mtmp.my = niy;
    }
    return mmoved;
}

const MTSZ = 4;
const MMOVE_NOTHING = 0, MMOVE_MOVED = 2, MMOVE_DONE = 3, MMOVE_NOMOVES = 4;

/* include/mondata.h hides_under() */
function hides_under(ptr) {
    return (ptr.mflags1 & MFLAGS.M1_CONCEAL) !== 0;
}

function OBJ_AT(x, y) {
    return (game.level?.objects || []).some(o => o.ox === x && o.oy === y);
}

/* src/hack.c dist2() */
function dist2(x0, y0, x1, y1) {
    const dx = x0 - x1, dy = y0 - y1;
    return dx * dx + dy * dy;
}

function note_unported(what) {
    (game.unported ||= new Set()).add(what);
}
