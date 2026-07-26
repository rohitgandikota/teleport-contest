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
import { rnd } from './rng.js';
import { OROOM, SHOPBASE, FILL_NORMAL } from './const.js';
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
        note_unported_mkroom(`do_mkroom:${roomtype}`);
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
    const door = game.doors?.[sroom.fdoor];
    if (!door)
        return true;
    const doorx = door.x, doory = door.y;
    let insidex = 0, insidey = 0, insidect = 0;
    const ROOM_TYP = 20;    /* include/rm.h ROOM */

    /* squares inside the room and next to the door */
    for (let x = Math.max(doorx - 1, sroom.lx);
         x <= Math.min(doorx + 1, sroom.hx); x++)
        for (let y = Math.max(doory - 1, sroom.ly);
             y <= Math.min(doory + 1, sroom.hy); y++)
            if (game.level.at(x, y)?.typ === ROOM_TYP) {
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
                if (game.level.at(x, y)?.typ === ROOM_TYP)
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
