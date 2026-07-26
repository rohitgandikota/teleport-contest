// mkroom.js — special rooms: shops, zoos, temples, swamps.
// C ref: src/mkroom.c
//
// makelevel() makes up to ONE special room per level, chosen by a chain of
// depth-gated else-ifs (src/mklev.c:1344). That chain was missing entirely,
// and with it the rn2(u_depth) the shop arm draws. It is not a deep-level
// concern: the shop gate is rn2(u_depth) < 3, so at depths 2 and 3 a shop is
// made EVERY time there are enough rooms.
//
// Only the shop path is ported so far. mkzoo, mkswamp and mktemple are absent
// and recorded, so do_mkroom's other arms are honest holes rather than stubs.

import { game } from './gstate.js';
import { rnd, rn2 } from './rng.js';
import { OROOM, SHOPBASE, FILL_NORMAL, COURT, ZOO, BEEHIVE, MORGUE,
         BARRACKS, SWAMP, TEMPLE, LEPREHALL, COCKNEST, ANTHOLE,
         ROOMOFFSET, POOL, SDOOR, ROOM, IS_ROOM, IS_DOOR, isok,
         OBJ_AT } from './const.js';
import { makemon, mkclass, NO_MM_FLAGS } from './makemon.js';
import { m_at, t_at } from './mon.js';
import { PMNAMES, MONSYMS } from './monst_data.js';
import { OCLASSES } from './objects_data.js';
import { inside_room } from './sp_lev.js';

function note_unported_mkroom(what) {
    (game.unported ||= new Set()).add(`mkroom:${what}`);
}

// src/shknam.c:209 shtypes[] — the shop table. Only the fields mkshop() reads
// are carried: the class symbol and the probability. The probabilities sum to
// exactly 100, which is what makes the rnd(100) walk below terminate.
export const shtypes = [
    { name: 'general store',                   symb: OCLASSES.RANDOM_CLASS, prob: 42 },
    { name: 'used armor dealership',           symb: OCLASSES.ARMOR_CLASS,  prob: 14 },
    { name: 'second-hand bookstore',           symb: OCLASSES.SCROLL_CLASS, prob: 10 },
    { name: 'liquor emporium',                 symb: OCLASSES.POTION_CLASS, prob: 10 },
    { name: 'antique weapons outlet',          symb: OCLASSES.WEAPON_CLASS, prob: 5 },
    { name: 'delicatessen',                    symb: OCLASSES.FOOD_CLASS,   prob: 5 },
    { name: 'jewelers',                        symb: OCLASSES.RING_CLASS,   prob: 3 },
    { name: 'quality apparel and accessories', symb: OCLASSES.WAND_CLASS,   prob: 3 },
    { name: 'hardware store',                  symb: OCLASSES.TOOL_CLASS,   prob: 3 },
    { name: 'rare books',                      symb: OCLASSES.SPBOOK_CLASS, prob: 3 },
    { name: 'health food store',               symb: OCLASSES.FOOD_CLASS,   prob: 2 },
    { name: 'lighting store',                  symb: OCLASSES.TOOL_CLASS,   prob: 0 },
];

// src/mkroom.c:502 antholemon() — which ant species an anthole gets.
//
// Draws nothing. It needs ubirthday (the game's start timestamp, which C mods
// by 3 to vary the species between games) and we do not model that yet, so
// this is an honest hole rather than a plausible return value: it reports
// itself and answers "no ant available", which makes the ANTHOLE arm of
// makelevel's chain fall through to BARRACKS.
//
// CONSEQUENCE, stated so it is not a surprise: on levels deeper than 12 where
// C would have made an anthole, we draw the following rn2(4) that C does not.
// Shallower levels are unaffected, since the arm is gated on u_depth > 12.
export function antholemon() {
    note_unported_mkroom('antholemon:ubirthday');
    return false;
}

// src/mkroom.c:42 isbig()
function isbig(sroom) {
    const area = (sroom.hx - sroom.lx + 1) * (sroom.hy - sroom.ly + 1);
    return area > 20;
}

// src/mkroom.c:52 do_mkroom()
export function do_mkroom(roomtype) {
    if (roomtype >= SHOPBASE) {
        mkshop();
    } else {
        switch (roomtype) {
        case COURT:     mkzoo(COURT);     break;
        case ZOO:       mkzoo(ZOO);       break;
        case BEEHIVE:   mkzoo(BEEHIVE);   break;
        case MORGUE:    mkzoo(MORGUE);    break;
        case BARRACKS:  mkzoo(BARRACKS);  break;
        case SWAMP:     mkswamp();        break;
        case TEMPLE:    note_unported_mkroom('mktemple'); break;
        case LEPREHALL: mkzoo(LEPREHALL); break;
        case COCKNEST:  mkzoo(COCKNEST);  break;
        case ANTHOLE:   mkzoo(ANTHOLE);   break;
        default:
            note_unported_mkroom(`do_mkroom:${roomtype}`);
        }
    }
}

// src/mkroom.c:95 mkshop()
//
// Draws exactly ONE rnd(100), and only when the shop type is not already
// fixed. Everything else is room selection and lighting. The stock is NOT
// made here: the C's own comment says "The shop used to be stocked here, but
// this no longer happens -- all we do is set its rtype, and it gets stocked
// at the end of makelevel()", which is the fill_special_room() pass we
// already run for the vault.
function mkshop() {
    let sroom = null;
    let i = -1;             /* shoptype; -1 means "not yet determined" */

    /* the wizard-mode SHOPTYPE environment override is not modelled */

    for (let idx = 0; ; idx++) {
        const r = game.level.rooms[idx];
        if (!r || r.hx < 0)
            return;         /* no eligible room */
        if (idx >= game.level.nroom)
            return;         /* impossible("rooms[] not closed by -1?") */
        if (r.rtype !== OROOM)
            continue;
        if (has_dnstairs(r) || has_upstairs(r))
            continue;
        if (r.doorct === 1) {
            if (invalid_shop_shape(r))
                continue;
            sroom = r;
            break;
        }
    }

    if (!sroom.rlit) {
        for (let x = sroom.lx - 1; x <= sroom.hx + 1; x++)
            for (let y = sroom.ly - 1; y <= sroom.hy + 1; y++) {
                const loc = game.level.at(x, y);
                if (loc) loc.lit = 1;
            }
        sroom.rlit = 1;
    }

    if (i < 0) {            /* shoptype not yet determined */
        /* pick a shop type at random */
        let j;
        for (j = rnd(100), i = 0; (j -= shtypes[i].prob) > 0; i++)
            continue;

        /* big rooms cannot be wand or book shops, so make them general stores */
        if (isbig(sroom) && (shtypes[i].symb === OCLASSES.WAND_CLASS
                             || shtypes[i].symb === OCLASSES.SPBOOK_CLASS))
            i = 0;
    }
    sroom.rtype = SHOPBASE + i;

    topologize_wire(sroom);

    /* stocked later, with the other special rooms, at the end of makelevel */
    sroom.needfill = FILL_NORMAL;
}

// src/mkroom.c:220 pick_room() — an unused room, preferably with one door.
//
// Draws even when it finds nothing: the starting index is rn2(nroom), and the
// walk spends an rn2(3) on any room holding the downstairs and an rn2(5) on
// any room with more than one door. Those are the draws the whole special-room
// chain was missing below the shop arm.
//
// The wrap is C's `if (sroom == &rooms[nroom]) sroom = &rooms[0]`, i.e. the
// scan starts at a random room and wraps once through all of them.
function pick_room(strict) {
    const nroom = game.level.nroom;
    if (nroom <= 0)
        return null;

    let idx = rn2(nroom);
    for (let i = nroom; i--; idx++) {
        if (idx === nroom)
            idx = 0;
        const sroom = game.level.rooms[idx];
        if (!sroom || sroom.hx < 0)
            return null;
        if (sroom.rtype !== OROOM)
            continue;
        if (!strict) {
            if (has_upstairs(sroom) || (has_dnstairs(sroom) && rn2(3)))
                continue;
        } else if (has_upstairs(sroom) || has_dnstairs(sroom)) {
            continue;
        }
        if (sroom.doorct === 1 || !rn2(5))
            return sroom;
    }
    return null;
}

// src/mkroom.c:244 mkzoo() — the room is only marked here. As with mkshop,
// the C's comment records that it "does not get stocked at this time - it
// will get stocked at the end of makelevel()".
function mkzoo(type) {
    const sroom = pick_room(false);
    if (sroom) {
        sroom.rtype = type;
        sroom.needfill = FILL_NORMAL;
    }
}

// src/mkroom.c:530 mkswamp() — turn up to five rooms swampy.
//
// Note the loop shape: it runs five times unconditionally and spends an
// rn2(nroom) on EVERY pass, including passes whose room is rejected. It can
// also pick the same room twice. Both are the C's behaviour, not an accident,
// and a "cleaner" loop that draws only for eligible rooms would desync.
//
// Only fires at u_depth > 15, so it is rare in the public sessions.
function mkswamp() {
    let eelct = 0;

    for (let i = 0; i < 5; i++) {       /* turn up to 5 rooms swampy */
        const idx = rn2(game.level.nroom);
        const sroom = game.level.rooms[idx];
        if (!sroom || sroom.hx < 0 || sroom.rtype !== OROOM
            || has_upstairs(sroom) || has_dnstairs(sroom))
            continue;

        const rmno = idx + ROOMOFFSET;

        /* satisfied; make a swamp */
        sroom.rtype = SWAMP;
        for (let sx = sroom.lx; sx <= sroom.hx; sx++)
            for (let sy = sroom.ly; sy <= sroom.hy; sy++) {
                const lev = game.level.at(sx, sy);
                if (!lev || !IS_ROOM(lev.typ) || lev.roomno !== rmno)
                    continue;
                if (!OBJ_AT(sx, sy) && !m_at(sx, sy) && !t_at(sx, sy)
                    && !nexttodoor(sx, sy)) {
                    if ((sx + sy) % 2) {
                        note_unported_mkroom('mkswamp:del_engr_at');
                        lev.typ = POOL;
                        if (!eelct || !rn2(4)) {
                            /* mkclass() won't do, as we might get kraken */
                            makemon(game.mons[rn2(5)
                                        ? PMNAMES.PM_GIANT_EEL
                                        : rn2(2)
                                            ? PMNAMES.PM_PIRANHA
                                            : PMNAMES.PM_ELECTRIC_EEL],
                                    sx, sy, NO_MM_FLAGS);
                            eelct++;
                        }
                    } else if (!rn2(4)) {   /* swamps tend to be moldy */
                        makemon(mkclass(MONSYMS.S_FUNGUS, 0), sx, sy,
                                NO_MM_FLAGS);
                    }
                }
            }
        game.level.flags.has_swamp = 1;
    }
}

// src/mkroom.c:623 nexttodoor()
function nexttodoor(sx, sy) {
    for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++) {
            if (!isok(sx + dx, sy + dy))
                continue;
            const lev = game.level.at(sx + dx, sy + dy);
            if (lev && (IS_DOOR(lev.typ) || lev.typ === SDOOR))
                return true;
        }
    return false;
}

// src/mkroom.c:640 has_dnstairs()
export function has_dnstairs(sroom) {
    for (let s = game.stairs; s; s = s.next)
        if (!s.up && inside_room(sroom, s.sx, s.sy))
            return true;
    return false;
}

// src/mkroom.c:653 has_upstairs()
export function has_upstairs(sroom) {
    for (let s = game.stairs; s; s = s.next)
        if (s.up && inside_room(sroom, s.sx, s.sy))
            return true;
    return false;
}

// src/mkroom.c:1050 invalid_shop_shape() — a shopkeeper standing just inside
// the door needs somewhere to step aside to.
function invalid_shop_shape(sroom) {
    const door = game.level.doors?.[sroom.fdoor];
    if (!door)
        return true;
    const doorx = door.x, doory = door.y;
    let insidex = 0, insidey = 0, insidect = 0;

    /* squares inside the room and next to the door */
    for (let x = Math.max(doorx - 1, sroom.lx);
         x <= Math.min(doorx + 1, sroom.hx); x++)
        for (let y = Math.max(doory - 1, sroom.ly);
             y <= Math.min(doory + 1, sroom.hy); y++)
            if (game.level.at(x, y)?.typ === ROOM) {
                insidex = x; insidey = y; insidect++;
            }

    if (insidect < 1)
        return true;        /* impossible() in C */

    /* insidect > 1 means the shopkeeper already has somewhere to go */
    if (insidect === 1) {
        insidect = 0;
        for (let x = Math.max(insidex - 1, sroom.lx);
             x <= Math.min(insidex + 1, sroom.hx); x++)
            for (let y = Math.max(insidey - 1, sroom.ly);
                 y <= Math.min(insidey + 1, sroom.hy); y++) {
                if (x === insidex && y === insidey)
                    continue;
                if (game.level.at(x, y)?.typ === ROOM)
                    insidect++;
            }
        if (insidect === 1)
            return true;    /* only one square to move to; not a shop */
    }
    return false;
}

/* topologize() lives in js/mklev.js, which imports this file; the wire keeps
   the cycle from forming, following the sp_lev_wire pattern already here. */
let _topologize = null;
export function mkroom_wire(fns) { _topologize = fns.topologize; }
function topologize_wire(croom) {
    if (_topologize) _topologize(croom);
    else note_unported_mkroom('topologize:unwired');
}
