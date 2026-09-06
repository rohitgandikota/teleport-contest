// pickup.js — picking things up off the floor, and looking at what is there.
// C ref: src/pickup.c
//
// Manual and automatic floor pickup share the same carry-limit machinery.
// Rare artifact, fatal-corpse, and remote-shop branches remain
// explicit recorded gaps.

import { self_lookat } from './pager.js';
import { digests } from './mondata.js';
import { engulfing_u } from './const.js';
import { PICK_ANY } from './const.js';
import { CONTAINED_SYM } from './const.js';
import { OBJ_MINVENT, OBJ_FLOOR } from './const.js';
import { AUTOSELECT_SINGLE } from './const.js';
import { USE_INVLET } from './const.js';
import { SIGNAL_NOMENU, SIGNAL_ESCAPE } from './const.js';
import { INCLUDE_HERO } from './const.js';
import { MAY_HIT, MAY_DESTROY } from './const.js';
import { scatter } from './explode.js';
import { def_oc_syms } from './drawing_data.js';
import { game } from './gstate.js';
import { addinv, prinv, obj_extract_self, inv_order, let_to_name,
         freeinv, getobj, update_inventory, loot_classify, weight, mergable, merged, money_cnt,
         useup, useupf, obfree, stackobj, count_unpaid, count_buc, is_worn,
         tally_BUCX, askchain, display_pickinv, currency, obj_here,
         carrying, merge_choice, nxtobj,
         GETOBJ_ALLOWCNT, GETOBJ_DOWNPLAY, GETOBJ_EXCLUDE,
         GETOBJ_EXCLUDE_SELECTABLE, GETOBJ_PROMPT, GETOBJ_SUGGEST }
    from './invent.js';
import { observe_object } from './o_init.js';
import { doname, xname, cxname, the, yname, singular, an, corpse_xname,
         CXN_ARTICLE, CXN_SINGULAR, otense, vtense, safe_qbuf,
         ysimple_name, Ysimple_name2, Yname2, Tobjnam, thesimpleoname,
         ansimpleoname } from './objnam.js';
import { Is_container, Has_contents, carried, SchroedingersBox,
         age_is_relative } from './obj.js';
import { AUTOUNLOCK_UNTRAP, AUTOUNLOCK_APPLY_KEY,
         AUTOUNLOCK_FORCE } from './const.js';
import { check_capacity, in_rooms, losehp } from './hack.js';
import { ECMD_OK, ECMD_TIME, ECMD_CANCEL, IS_FURNITURE, ICE, POOL, MOAT, WATER,
         LAVAPOOL, nothing_happens, nothing_seems_to_happen } from './const.js';
import { upstart, trycall } from './do_name.js';

/* src/hacklib.c The() — the() with the first letter capitalised. */
const The = (s2) => upstart(the(s2));
import { ONAMES, OCLASSES } from './objects_data.js';
import { newsym, pline, bot, display_nhwindow_message,
         tty_clear_nhwindow_message, urgent_pline }
    from './display.js';
import { UNENCUMBERED, SLT_ENCUMBER, MOD_ENCUMBER, HVY_ENCUMBER,
         EXT_ENCUMBER, SHOPBASE, invlet_basic, HAND, KILLED_BY_AN,
         DOOR, D_CLOSED, D_LOCKED, IS_SINK, ZAP_POS, isok, xdir, ydir,
         LOST_DROPPED, LOST_THROWN, LOST_STOLEN, LOST_EXPLODING, A_WIS, st_all }
    from './const.js';
import { addtobill, costly_spot, doname_with_price, sellobj,
         sellobj_state } from './shk.js';
import { calc_capacity, exercise, max_capacity, near_capacity, Role_if } from './attrib.js';
import { In_sokoban, surface } from './dungeon.js';
import { Is_mbag, splitobj, unbless, place_object, add_to_container,
         start_corpse_timeout, start_glob_timeout, set_bknown }
    from './mkobj.js';
import { PARANOID_AUTOALL } from './const.js';
import { paranoia_bits, boolean_option } from './options.js';
import { PMNAMES } from './monst_data.js';
import { def_char_to_objclass } from './sp_lev.js';
import { read_engr_at } from './engrave.js';
import { rn2, rnd, d } from './rng.js';
import { OBJ_AT, LOOKHERE_NOFLAGS, LOOKHERE_PICKED_SOME, LOOKHERE_SKIP_DFEATURE } from './const.js';
import { NO_COLOR } from './terminal.js';
import { There, You, Your } from './pline.js';
import { flush_screen } from './display.js';
import { look_here } from './invent.js';
import { nomul } from './hack.js';
import { t_at, is_pool, is_lava, m_at, touch_artifact } from './mon.js';
import { unconscious, uteetering_at_seen_pit, uescaped_shaft } from './trap.js';
import { sticks, attacktype, ceiling_hider } from './mondata.js';
import { P_SKILL } from './weapon.js';
import { P_RIDING, P_BASIC, Is_airlevel, Is_waterlevel } from './const.js';
import { ATTKS, MFLAGS } from './monst_data.js';
import { is_pit } from './const.js';
import { Blind, Levitation, Stone_resistance, Flying } from './youprop.js';
import { st_gloves, st_corpse, st_petrifies, st_resists, W_ARMG } from './const.js';
import { worn } from './do_wear.js';
import { nohands, notake, poly_when_stoned, throws_rocks,
         touch_petrifies } from './mondata.js';
import { is_rider } from './makemon.js';
import { body_part } from './polyself.js';
import { tty_yn_function } from './tty/topl.js';
import { inv_cnt } from './hack.js';
import { freehand } from './engrave.js';
import { Norep, impossible, pline_The, livelog_printf } from './pline.js';
import { MENU_TRADITIONAL, MENU_FULL, MENU_PARTIAL, OBJ_CONTAINED,
         W_ARMOR, W_ACCESSORY, LL_ACHIEVE, NO_MINVENT, MM_ADJACENTOK,
         MM_NOMSG, FOOT, ONAME_NO_FLAGS, has_omonst, OMONST } from './const.js';
import { unsplitobj, get_mtraits, set_corpsenm } from './mkobj.js';
import { setuwep_with_feedback, setuswapwep, setuqwep, welded, weldmsg } from './wield.js';
import { bigmonst } from './mondata.js';
import { obj_is_burning } from './light.js';
import { container_contents } from './end.js';
import { docrt, canspotmon } from './display.js';
import { tty_create_nhwindow, tty_putstr, tty_display_nhwindow,
         tty_next_page, tty_destroy_nhwindow, NHW_MENU, NHW_TEXT } from './tty/wintty.js';
import { xwaitforspace } from './tty/getline.js';
import { getlin } from './cmd.js';
import { shop_keeper, stolen_value, pick_pick } from './shk.js';
import { is_pick } from './mon.js';
import { uhis } from './mhitu.js';
import { get_obj_location } from './zap.js';
import { makemon, set_malign } from './makemon.js';
import { christen_monst, Monnam, rndmonnam, oname } from './do_name.js';
import { more_experienced, newexplevel } from './exper.js';
import { Hallucination } from './youprop.js';





function note_unported_pickup(what) {
    (game.unported ||= new Set()).add(what);
}

// src/hack.c can_reach_floor() — is the floor in reach?
//
// The trap parameter widens reach inside a pit. Riding, being stuck to a
// ceiling clinger, and polyform reach limits are states that cannot occur
// yet; levitation can, via potions and rings.
export function can_reach_floor(check_pit) {
    const u = game.u;
    const youdata = game.youmonst?.data ?? game.mons[u.umonnum ?? 0];

    if (u.uswallow
        || (u.ustuck && !sticks(youdata)
            /* assume that arms are pinned rather than that the hero
               has been lifted up above the floor [doesn't explain
               how hero can attack the creature holding him or her;
               that's life in nethack...] */
            && attacktype(game.mons[u.ustuck.mnum] ?? u.ustuck.data, ATTKS.AT_HUGS))
        || (Levitation() && !(Is_airlevel(u.uz) || Is_waterlevel(u.uz))))
        return false;
    /* Restricted/unskilled riders can't reach the floor */
    if (u.usteed && (P_SKILL(P_RIDING) ?? 0) < P_BASIC)
        return false;
    if (u.uundetected && ceiling_hider(youdata))
        return false;
    if (Flying() || youdata.msize >= MFLAGS.MZ_HUGE)
        return true;
    let t;
    if (check_pit && (t = t_at(u.ux, u.uy)) != null
        && (uteetering_at_seen_pit(t) || uescaped_shaft(t)))
        return false;
    return true;
}

// src/pickup.c:75 simple_look(); preserve the unsorted chain order.
export async function simple_look(otmp, here) {
    if (!otmp?.length) {
        await impossible('simple_look(null)');
    } else if (otmp.length === 1) {
        await pline(doname(otmp[0]));
    } else {
        const tmpwin = tty_create_nhwindow(NHW_MENU);
        tty_putstr(tmpwin, 0, '');
        for (const obj of otmp)
            tty_putstr(tmpwin, 0, doname(obj));
        await tty_display_nhwindow(tmpwin);
        do {
            await xwaitforspace(' \r\n\x1b');
        } while (game.morc !== '\x1b' && tty_next_page(tmpwin));
        tty_destroy_nhwindow(tmpwin);
        await docrt();
    }
}

// src/pickup.c:101 collect_obj_classes(); lists carry nobj/nexthere order.
export function collect_obj_classes(ilets, otmp, here, filter, itemcount) {
    let iletct = 0;
    itemcount.v = 0;
    ilets.length = 0;
    for (const obj of otmp || []) {
        const c = def_oc_syms[obj.oclass];
        if (!ilets.includes(c) && (!filter || filter(obj)))
            ilets[iletct++] = c;
        itemcount.v += 1;
    }
    return iletct;
}

// src/pickup.c:141 query_classes(); traditional pickup and container selection.
export async function query_classes(oclasses, one_at_a_time, everything,
                                    action, objs, here, menu_on_demand) {
    const ilets = [], itemcount = { v: 0 };
    const bcnt = {}, ucnt = {}, ccnt = {}, xcnt = {}, ocnt = {}, jcnt = {};
    let m_seen = false;
    oclasses.length = 0;
    one_at_a_time.v = everything.v = false;
    if (menu_on_demand) menu_on_demand.v = 0;
    let iletct = collect_obj_classes(ilets, objs, here, null, itemcount);
    if (iletct === 0) return false;
    if (iletct === 1) {
        oclasses[0] = def_char_to_objclass(ilets[0]);
    } else {
        ilets[iletct++] = ' ';
        ilets[iletct++] = 'a';
        ilets[iletct++] = 'A';
        ilets[iletct++] = objs === game.invent ? 'i' : ':';
    }
    if (itemcount.v && menu_on_demand) ilets[iletct++] = 'm';
    if (count_unpaid(objs)) ilets[iletct++] = 'u';
    tally_BUCX(objs, here, bcnt, ucnt, ccnt, xcnt, ocnt, jcnt);
    if (bcnt.v) ilets[iletct++] = 'B';
    if (ucnt.v) ilets[iletct++] = 'U';
    if (ccnt.v) ilets[iletct++] = 'C';
    if (xcnt.v) ilets[iletct++] = 'X';
    if (jcnt.v) ilets[iletct++] = 'P';
    if (iletct > 1) {
        let where = null;
        ask_again: for (;;) {
            oclasses.length = 0;
            one_at_a_time.v = everything.v = false;
            let not_everything = false, filtered = false;
            const inbuf = await getlin(`What kinds of thing do you want to ${action}? [${ilets.join('')}]`);
            if (inbuf[0] === '\x1b') return false;
            for (const sym of inbuf) {
                if (sym === ' ') continue;
                else if (sym === 'A') one_at_a_time.v = true;
                else if (sym === 'a') everything.v = true;
                else if (sym === ':') {
                    await simple_look(objs, here);
                    if (objs[0].where === OBJ_CONTAINED)
                        objs[0].ocontainer.cknown = 1;
                    continue ask_again;
                } else if (sym === 'i') {
                    await display_pickinv(null, null, null, false);
                    continue ask_again;
                } else if (sym === 'm') {
                    m_seen = true;
                } else if ('uBUCXP'.includes(sym)) {
                    add_valid_menu_class(sym);
                    filtered = true;
                } else {
                    const oc_of_sym = def_char_to_objclass(sym);
                    if (ilets.includes(sym)) {
                        add_valid_menu_class(oc_of_sym);
                        oclasses.push(oc_of_sym);
                    } else {
                        if (where === null)
                            where = action === 'pick up' ? 'here'
                                : action === 'take out' ? 'inside' : '';
                        if (where) await There(`are no ${sym}'s ${where}.`);
                        else await You(`have no ${sym}'s.`);
                        not_everything = true;
                    }
                }
            }
            if (m_seen && menu_on_demand) {
                menu_on_demand.v = (everything.v || !oclasses.length) && !filtered ? -2 : -3;
                return false;
            }
            if (!oclasses.length && (!everything.v || not_everything)) {
                one_at_a_time.v = true;
                everything.v = false;
            }
            break;
        }
    }
    return true;
}

// src/pickup.c:272 u_safe_from_fatal_corpse() — can the hero touch this
// (cockatrice) corpse and live? 'tests' selects which outs apply (st_all
// checks gloves, corpse-ness, petrification and stoning resistance).
export function u_safe_from_fatal_corpse(obj, tests) {
    if (((tests & st_gloves) && worn(W_ARMG))
        || ((tests & st_corpse) && obj.otyp !== ONAMES.CORPSE)
        || ((tests & st_petrifies)
            && !touch_petrifies(game.mons[obj.corpsenm]))
        || ((tests & st_resists) && Stone_resistance()))
        return true;
    return false;
}

// src/pickup.c:285 fatal_corpse_mistake().
async function fatal_corpse_mistake(obj, remotely) {
    if (u_safe_from_fatal_corpse(obj, st_all) || remotely)
        return false;

    if (poly_when_stoned(game.youmonst.data)) {
        const { polymon } = await import('./polyself.js');
        if (await polymon(PMNAMES.PM_STONE_GOLEM)) {
            await display_nhwindow_message();
            return false;
        }
    }

    await pline(`Touching ${corpse_xname(
        obj, null, CXN_SINGULAR | CXN_ARTICLE)} is a fatal mistake.`);
    const { instapetrify } = await import('./trap.js');
    await instapetrify(corpse_xname(obj, null, CXN_SINGULAR));
    return true;
}

// src/pickup.c:303 rider_corpse_revival().
export async function rider_corpse_revival(obj, remotely) {
    if (!obj || obj.otyp !== ONAMES.CORPSE
        || !is_rider(game.mons[obj.corpsenm]))
        return false;

    await pline(`At your ${remotely ? 'attempted acquisition' : 'touch'}, `
                + 'the corpse suddenly moves...');
    const { revive_corpse } = await import('./do.js');
    await revive_corpse(obj, false);
    exercise(A_WIS, false);
    return true;
}

// src/pickup.c:430 check_here() — look at the objects at our location.
export async function check_here(picked_some) {
    let ct = 0;
    let lhflags = picked_some ? LOOKHERE_PICKED_SOME : LOOKHERE_NOFLAGS;

    if (game.flags?.mention_decor) {
        if (await describe_decor())
            lhflags |= LOOKHERE_SKIP_DFEATURE;
    }

    /* count the objects here */
    for (const obj of game.level?.objects || []) {
        if (obj.ox === game.u.ux && obj.oy === game.u.uy
            && obj !== game.uchain)
            ct++;
    }

    /* If there are objects here, take a look. */
    if (ct) {
        if (game.context.run)
            nomul(0);
        await flush_screen(1);
        await look_here(ct, lhflags);
    } else {
        await read_engr_at(game.u.ux, game.u.uy);
    }
}

// src/pickup.c:475 pickup() — main pickup routine.
//
// `what` > 0 means autopickup is in progress; < 0 means "pick N"; 0 is the
// explicit ',' command. With flags.pickup off (the recorded rc default —
// optlist.h initval is Off in 5.0), an autopickup call lands in the
// check_here() arm and only looks. The true picking flows are recorded.
/* iflags.prev_decor — terrain type of the previous decor mention */
// src/pickup.c:353 describe_decor() — 'mention_decor' feedback when walking
// onto a dungeon feature. Ordinary open doors and doorways are skipped;
// broken (and closed, via Passes_walls) doors are mentioned. Returns true
// when it printed, so check_here can skip look_here's duplicate line.
export async function describe_decor() {
    /* the fumbling deferral needs the Fumbling timeout; recorded */
    const { dfeature_at } = await import('./invent.js');
    const loc = game.level?.at(game.u.ux, game.u.uy);
    const ltyp = loc?.typ ?? 0;
    let dfeature = dfeature_at(game.u.ux, game.u.uy);
    let res = true;

    const doorhere = dfeature && (dfeature === 'open door'
                                  || dfeature === 'doorway');
    const waterhere = dfeature && dfeature === 'pool of water';
    if (doorhere || game.u.uprops?.UNDERWATER)
        dfeature = null;

    const prev = game.iflags.prev_decor ?? 0 /* STONE */;
    if (ltyp === prev && !IS_FURNITURE(ltyp)) {
        res = false;
    } else if (dfeature) {
        if (waterhere) {
            const { waterbody_name } = await import('./pager.js');
            dfeature = waterbody_name(game.u.ux, game.u.uy);
        }
        if (dfeature !== 'swamp' && ltyp !== ICE)
            dfeature = an(dfeature);

        if (game.flags?.verbose !== false) {
            await pline(`There is ${dfeature} here.`);
        } else {
            await pline(`${dfeature[0].toUpperCase()}${dfeature.slice(1)}.`);
        }
    } else if (!game.u.uprops?.UNDERWATER) {
        /* the back-on-ground arm keys on prev_decor being pool/lava/ice */
        if (is_pool_typ(prev) || prev === LAVAPOOL_TYP || prev === ICE)
            note_unported_pickup('describe_decor:back_on_ground');
    }
    /* only adapt the next describe_decor() when the option is On */
    game.iflags.prev_decor = game.flags?.mention_decor ? ltyp : 0;
    return res;
}

// src/pickup.c:317 force_decor() makes probing describe the current ice or
// furniture even when mention_decor is disabled or the same terrain was just
// described. The override flags in C only bypass deferred flavor checks that
// this port does not model yet.
export async function force_decor(via_probing = false) {
    game.iflags ||= {};
    game.iflags.prev_decor = 0; /* STONE */
    const described = await describe_decor();
    game.iflags.prev_decor = game.level?.at(game.u.ux, game.u.uy)?.typ ?? 0;
    void via_probing;
    return described;
}

const is_pool_typ = (t) => t === POOL || t === MOAT || t === WATER;
const LAVAPOOL_TYP = LAVAPOOL;

// src/pickup.c:616 reset_justpicked() -- a new successful pickup attempt
// replaces the previous "just picked up" inventory group.
function reset_justpicked() {
    for (const obj of game.invent || [])
        obj.pickup_prev = 0;
}

export async function pickup(what) {
    const autopickup = what > 0;

    /* we might have arrived here while fainted or sleeping */
    if (autopickup && game.multi < 0 && unconscious()) {
        return 0;
    }

    /* src/pickup.c:691: only the first object that changes encumbrance in
       this pickup operation gets the verbose lifting prefix. */
    game.pickup_encumbrance = 0;

    if (!game.u.uswallow) {
        /* no auto-pick if no-pick move, nothing there, or in a pool */
        if (autopickup && (game.context.nopick || !OBJ_AT(game.u.ux, game.u.uy)
                           || (is_pool(game.u.ux, game.u.uy) && !game.u.uinwater)
                           || is_lava(game.u.ux, game.u.uy))) {
            if (game.flags?.mention_decor)
                await describe_decor();
            await read_engr_at(game.u.ux, game.u.uy);
            return 0;
        }
        /* no pickup if levitating & not on air or water level */
        const t = t_at(game.u.ux, game.u.uy);
        if (!can_reach_floor(!!(t && is_pit(t.ttyp)))) {
            note_unported_pickup('pickup:cant_reach_floor');
            return 0;
        }
        const cannotTake = notake(game.youmonst.data);
        if ((game.multi && !game.context.run)
            || (autopickup && !game.flags?.autopickup)
            || cannotTake) {
            await check_here(false);
            if (cannotTake && OBJ_AT(game.u.ux, game.u.uy)
                && (autopickup || game.flags?.autopickup))
                await You('are physically incapable of picking anything up.');
            return 0;
        }

        /* if there's anything here, stop running */
        if (OBJ_AT(game.u.ux, game.u.uy) && game.context.run
            && game.context.run !== 8 && !game.context.nopick)
            nomul(0);
    }

    /* src/pickup.c:1085 query_objlist() — with AUTOSELECT_SINGLE set, a
       single candidate is taken WITHOUT a menu; two or more raise one. */
    let here = (game.level?.objects || [])
        .filter(o => o.ox === game.u.ux && o.oy === game.u.uy
                     && o !== game.uchain);
    /* src/pickup.c:975 autopick() — autopickup takes the eligible objects
       with no menu at all, so the class filter has to run here or every
       object on the square gets grabbed regardless of pickup_types. */
    if (autopickup)
        here = autopick(here);
    let n_picked = 0, n_tried = 0;
    if (here.length > 1 && !autopickup) {
        const picked = await query_objlist('Pick up what?', here, INVORDER_SORT, PICK_ANY, allow_all);
        if (picked.length)
            reset_justpicked();
        for (const obj of picked) {
            n_tried++;
            const count = picked.counts?.get(obj) ?? obj.quan;
            if ((await pickup_object(obj, count, false)) > 0)
                n_picked++;
        }
    } else {
        /* autopick(): no menu, take every eligible object */
        if (here.length)
            reset_justpicked();
        for (const obj of here) {
            n_tried++;
            if ((await pickup_object(obj, obj.quan, false)) > 0)
                n_picked++;
        }
    }

    /* src/pickup.c:903 — check if there's anything else here after
       auto-pickup is done; this is what prints "You see here a jackal
       corpse." when autopickup took nothing */
    if (autopickup && !game.u.uswallow)
        await check_here(n_picked > 0);

    game.pickup_encumbrance = 0;
    return n_tried > 0 ? 1 : 0;
}

// src/pickup.c:934 autopick_testobj()'s cached cost applies to the whole pile.
let autopick_costly = false;

// src/pickup.c:930 autopick_testobj(), shop and origin guards precede types.
export function autopick_testobj(otmp, calc_costly) {
    const otypes = game.flags?.pickup_types || '';
    if (calc_costly)
        autopick_costly = otmp.where === OBJ_FLOOR && costly_spot(otmp.ox, otmp.oy);
    if (autopick_costly && !otmp.no_charge)
        return false;
    if ((game.flags.pickup_thrown !== false && otmp.how_lost === LOST_THROWN)
        || (game.flags.pickup_stolen !== false && otmp.how_lost === LOST_STOLEN))
        return true;
    if (game.flags.dropped_nopick !== false && otmp.how_lost === LOST_DROPPED)
        return false;
    if (otmp.how_lost === LOST_EXPLODING)
        return false;
    if (game.apelist)
        note_unported_pickup('autopick_testobj:exceptions');
    return !otypes || otypes.includes(def_oc_syms[otmp.oclass]);
}

// src/pickup.c:979 autopick(). Arrays already carry the requested chain order.
function autopick(olist) {
    let n = 0, check_costly = true;
    for (const curr of olist) {
        if (autopick_testobj(curr, check_costly))
            n++;
        check_costly = false;
    }
    const picks = [];
    if (n)
        for (const curr of olist)
            if (autopick_testobj(curr, false))
                picks.push(curr);
    return picks;
}

// src/pickup.c allow_all(); query_objlist() filter that accepts everything
export function allow_all(obj) {
    return true;
}

// src/pickup.c:1025 query_objlist() — the PICK_ANY menu over a pile.
//
// C sorts the list into class order with a heading per class, exactly as the
// inventory menu does, and assigns a,b,c... down the list rather than reusing
// any inventory letter. Returns the chosen objects in menu order.
export async function query_objlist(qstr,   /* query string */
                                    olist,  /* the list to pick from */
                                    qflags = INVORDER_SORT, /* options to control the query */
                                    how = PICK_ANY,         /* type of query */
                                    allow = allow_all)      /* allow function */
{
    const use_invlet = (qflags & USE_INVLET) !== 0;
    const sorted = (qflags & INVORDER_SORT) !== 0,
          engulfer = (qflags & INCLUDE_HERO) !== 0;
    let engulfer_minvent;
    let n, last;

    if (!olist.length && !engulfer)
        return [];

    /* count the number of items allowed */
    n = 0, last = null;
    for (const curr of olist)
        if (allow(curr)) {
            last = curr;
            n++;
        }
    /* can't depend upon 'engulfer' because that's used to indicate whether
       hero should be shown as an extra, fake item */
    engulfer_minvent = (olist.length && olist[0].where === OBJ_MINVENT
                        && engulfing_u(olist[0].ocarry));
    if (engulfer_minvent && n === 1 && olist[0].owornmask) {
        qflags &= ~AUTOSELECT_SINGLE;
    }
    if (engulfer) {
        ++n;
        /* don't autoselect swallowed hero if it's the only choice */
        qflags &= ~AUTOSELECT_SINGLE;
    }

    if (n === 0) /* nothing to pick here */
        return (qflags & SIGNAL_NOMENU) ? -1 : [];

    if (n === 1 && (qflags & AUTOSELECT_SINGLE)) {
        const picks = [last];
        Object.defineProperty(picks, 'counts', { value: new Map([[last, last.quan]]) });
        return picks;
    }
    olist = olist.filter(allow);

    const { tty_create_nhwindow, tty_start_menu, tty_add_menu, tty_end_menu,
            tty_display_nhwindow, tty_select_menu, tty_destroy_nhwindow,
            ATR_NONE, ATR_INVERSE, NHW_MENU } = await import('./tty/wintty.js');
    const { MENU_BEHAVE_STANDARD, MENU_ITEMFLAGS_NONE, PICK_ANY }
        = await import('./const.js');
    const { docrt } = await import('./display.js');

    const win = tty_create_nhwindow(NHW_MENU);
    tty_start_menu(win, MENU_BEHAVE_STANDARD);

    /* sortloot's class grouping: C walks flags.inv_order and emits a heading
       for each class that has anything in the pile */
    const bylet = new Map();
    let let_ = 'a';
    let id = 1;
    const byid = new Map();
    const sortlootMode = String(game.flags?.sortloot ?? 'loot')
        .charAt(0).toLowerCase();
    const sortByLootName = sortlootMode === 'l' || sortlootMode === 'f';
    for (const oclass of inv_order()) {
        const items = olist.filter(o => o.oclass === oclass);
        if (use_invlet) {
            items.sort((a, b) => ((a.invlet.charCodeAt(0) ^ 0o40)
                                  - (b.invlet.charCodeAt(0) ^ 0o40)));
        } else {
            items.splice(0, items.length,
                         ...sortloot_items(items, sortByLootName));
        }
        if (!items.length)
            continue;
        tty_add_menu(win, null, 0, 0, 0, ATR_INVERSE, NO_COLOR,
                     let_to_name(oclass), MENU_ITEMFLAGS_NONE);
        let first_of_class = true;
        for (const o of items) {
            if (!game.u?.ublind)
                observe_object(o);
            byid.set(id, o);
            /* the first coin entry keeps GOLD_SYM as its selector
               (query_objlist: "(first && oclass == COIN_CLASS) ?
               GOLD_SYM : 0"); everything else auto-assigns letters */
            const sel = use_invlet ? o.invlet
                        : (first_of_class && oclass === OCLASSES.COIN_CLASS)
                          ? '$' : let_;
            tty_add_menu(win, null, id, sel, 0, ATR_NONE,
                         NO_COLOR, doname_with_price(o),
                         MENU_ITEMFLAGS_NONE);
            if (!use_invlet && sel !== '$')
                let_ = String.fromCharCode(let_.charCodeAt(0) + 1);
            first_of_class = false;
            id++;
        }
    }
    if (engulfer) {
        if (sorted && n > 1) {
            tty_add_menu(win, null, 0, 0, 0, ATR_INVERSE, NO_COLOR,
                         `${digests(game.u.ustuck.data) ? 'Swallowed' : 'Engulfed'} Creatures`,
                         MENU_ITEMFLAGS_NONE);
        }
        /* fake inventory letter, no group accelerator */
        tty_add_menu(win, null, 0, CONTAINED_SYM, 0, ATR_NONE, NO_COLOR,
                     an(self_lookat()), MENU_ITEMFLAGS_NONE);
    }

    tty_end_menu(win, qstr);
    await tty_display_nhwindow(win);

    const ids = await tty_select_menu(win, how);
    tty_destroy_nhwindow(win);
    await docrt();

    if (ids.cancelled && (qflags & SIGNAL_ESCAPE))
        return -2;

    const picks = [];
    const counts = new Map();
    for (const id of ids) {
        const obj = byid.get(id);
        if (!obj)
            continue;
        let count = ids.counts?.get(id) ?? -1;
        if (count < 0 || count > obj.quan)
            count = obj.quan;
        picks.push(obj);
        counts.set(obj, count);
    }
    Object.defineProperty(picks, 'counts', { value: counts });
    return picks;
}

const gold_weight = (amount) => Math.trunc((amount + 50) / 100);

// src/pickup.c:1544 delta_cwt(); measure the carried container's weight change.
export function delta_cwt(container, obj) {
    if (container.otyp !== ONAMES.BAG_OF_HOLDING) return obj.owt;
    const owt = container.owt;
    const index = container.cobj.indexOf(obj);
    if (index < 0) throw new Error('delta_cwt: obj not inside container?');
    container.cobj.splice(index, 1);
    const nwt = weight(container);
    container.cobj.splice(index, 0, obj);
    return owt - nwt;
}

// src/pickup.c:1570 carry_count()
export async function carry_count(obj, container, count, telekinesis, wt_before, wt_after) {
    const adjust_wt = container && carried(container);
    const is_gold = obj.oclass === OCLASSES.COIN_CLASS;
    const savequan = obj.quan, saveowt = obj.owt;
    const umoney = money_cnt(game.invent);
    let iw = max_capacity();
    if (count !== savequan) {
        obj.quan = count;
        obj.owt = weight(obj);
    }
    let wt = iw + obj.owt;
    if (adjust_wt) wt -= delta_cwt(container, obj);
    if (is_gold) wt -= gold_weight(umoney) + gold_weight(count) - gold_weight(umoney + count);
    if (count !== savequan) {
        obj.quan = savequan;
        obj.owt = saveowt;
    }
    wt_before.v = iw;
    wt_after.v = wt;
    if (wt < 0) return count;
    let qq;
    if (is_gold) {
        iw -= gold_weight(umoney);
        if (!adjust_wt) {
            qq = iw * -100 - (umoney + 50) - 1;
        } else {
            let oow = 0;
            qq = 50 - (umoney % 100) - 1;
            if (qq < 0) qq += 100;
            for (; qq <= count; qq += 100) {
                obj.quan = qq;
                obj.owt = gold_weight(qq);
                let ow = gold_weight(umoney + qq);
                ow -= delta_cwt(container, obj);
                if (iw + ow >= 0) break;
                oow = ow;
            }
            iw -= oow;
            qq -= 100;
        }
        if (qq < 0) qq = 0;
        else if (qq > count) qq = count;
        wt = iw + gold_weight(umoney + qq);
    } else if (count > 1 || count < obj.quan) {
        for (qq = 1; qq <= count; ++qq) {
            obj.quan = qq;
            let ow = obj.owt = weight(obj);
            if (adjust_wt) ow -= delta_cwt(container, obj);
            if (iw + ow >= 0) break;
            wt = iw + ow;
        }
        --qq;
    } else qq = 0;
    obj.quan = savequan;
    obj.owt = saveowt;
    let obj_nambuf = '', where = '', verb = '';
    if (qq < count) {
        obj_nambuf = doname(obj);
        if (container) {
            where = `in ${the(xname(container))}`;
            verb = 'carry';
        } else {
            where = 'lying here';
            verb = telekinesis ? 'acquire' : 'lift';
        }
    }
    if (qq > 0) {
        if (qq < count)
            await You(`can only ${verb} ${qq === 1 ? 'one' : 'some'} of the ${obj_nambuf} ${where}.`);
        wt_after.v = wt;
        return qq;
    }
    if (!container) where = 'here';
    let prefx1, prefx2, suffx;
    if (game.invent?.length || umoney) {
        prefx1 = 'you cannot ';
        prefx2 = '';
        suffx = ' any more';
    } else {
        prefx1 = obj.quan === 1 ? 'it ' : 'even one ';
        prefx2 = 'is too heavy for you to ';
        suffx = '';
    }
    await There(`${otense(obj, 'are')} ${obj_nambuf} ${where}, but ${prefx1}${prefx2}${verb}${suffx}.`);
    return 0;
}

// src/pickup.c:1705 lift_object()
export async function lift_object(obj, container, cnt_p, telekinesis) {
    let result;
    if (obj.otyp === ONAMES.BOULDER && In_sokoban(game.u.uz)) {
        await You(`cannot get your ${body_part(HAND)} around this ${xname(obj)}.`);
        return -1;
    }
    if (obj.otyp === ONAMES.LOADSTONE
        || (obj.otyp === ONAMES.BOULDER && throws_rocks(game.youmonst.data))) {
        if (inv_cnt(false) < invlet_basic || !carrying(obj.otyp) || merge_choice(game.invent, obj))
            return 1;
        await You(`are carrying too much stuff to pick up ${obj.quan === 1 ? 'another' : 'more'} ${xname(obj)}.`);
        return -1;
    }
    const old_wt = {}, new_wt = {};
    cnt_p.v = await carry_count(obj, container, cnt_p.v, telekinesis, old_wt, new_wt);
    if (cnt_p.v < 1) {
        result = -1;
    } else if (obj.oclass !== OCLASSES.COIN_CLASS && inv_cnt(false) >= invlet_basic
               && !merge_choice(game.invent, obj)) {
        await Your(`knapsack cannot accommodate any more items${
            nxtobj(obj, ONAMES.GOLD_PIECE, obj.where === OBJ_FLOOR) ? ' (except gold)' : ''}.`);
        result = -1;
    } else {
        result = 1;
        let prev_encumbr = near_capacity();
        if (prev_encumbr < (game.flags.pickup_burden ?? MOD_ENCUMBER))
            prev_encumbr = game.flags.pickup_burden ?? MOD_ENCUMBER;
        const next_encumbr = calc_capacity(new_wt.v - old_wt.v);
        if (next_encumbr > prev_encumbr) {
            if (telekinesis) result = 0;
            else {
                const savequan = obj.quan;
                obj.quan = cnt_p.v;
                const prefix = next_encumbr >= EXT_ENCUMBER ? 'You have extreme difficulty'
                    : next_encumbr >= HVY_ENCUMBER ? 'You have much trouble'
                    : next_encumbr >= MOD_ENCUMBER ? 'You have trouble' : 'You have a little trouble';
                const qbuf = safe_qbuf(`${prefix} ${!container ? 'lifting' : 'removing'} `,
                    '.  Continue?', obj, doname, ansimpleoname, 'something');
                obj.quan = savequan;
                const answer = await tty_yn_function(qbuf, 'ynq', 'q');
                if (answer === 'q') result = -1;
                else if (answer === 'n') result = 0;
                tty_clear_nhwindow_message(game._topl_cury || 0);
                game._pending_message = '';
            }
        }
    }
    if (obj.otyp === ONAMES.SCR_SCARE_MONSTER && result <= 0 && !container)
        obj.spe = 0;
    return result;
}

// src/pickup.c:1803 pickup_object() -- take one object off the floor.
// Artifact touch, fatal corpse contact, and Rider revival are checked before
// the ordinary lift path.
export async function pickup_object(obj, count, telekinesis) {
    if (obj.quan < count)
        return 0;                       /* impossible() in C */

    if (!Blind())
        observe_object(obj);

    if (obj === game.uchain)
        return 0;                       /* do not pick up attached chain */
    if (obj.oartifact && !await touch_artifact(obj, game.youmonst))
        return 0;
    if (obj.otyp === ONAMES.SCR_SCARE_MONSTER) {
        count = await carry_count(obj, null, count ? count : obj.quan,
                                  telekinesis, {}, {});
        if (count < 1)
            return -1;
        if (count < obj.quan)
            obj = splitobj(obj, count);

        if (obj.blessed) {
            await unbless(obj);
        } else if (!obj.spe && !obj.cursed) {
            obj.spe = 1;
        } else {
            const scroll = `scroll${obj.quan === 1 ? '' : 's'}`;
            await pline(`The ${scroll} ${otense(obj, 'turn')} to dust as you ${
                telekinesis ? 'raise' : 'pick'} ${
                obj.quan === 1 ? 'it' : 'them'} up.`);
            await trycall(obj);
            await useupf(obj, obj.quan);
            return 1;
        }
    }
    if (obj.otyp === ONAMES.CORPSE
        && (await fatal_corpse_mistake(obj, telekinesis)
            || await rider_corpse_revival(obj, telekinesis)))
        return -1;

    const cnt_p = { v: count };
    const res = await lift_object(obj, null, cnt_p, telekinesis);
    if (res <= 0) return res;
    count = cnt_p.v;

    if (obj.quan !== count && obj.otyp !== ONAMES.LOADSTONE)
        obj = splitobj(obj, count);
    obj = await pick_obj(obj);
    await pickup_prinv(obj, count, 'lifting');
    return 1;
}

// src/pickup.c:1897 pick_obj() — off the floor and into inventory.
async function pick_obj(otmp) {
    const ox = otmp.ox, oy = otmp.oy;
    let robshop = !game.u.uswallow && otmp !== game.uball
               && costly_spot(ox, oy);

    obj_extract_self(otmp);
    newsym(ox, oy);
    if (robshop) {
        const saveushops = game.u.ushops || '';
        const fakeshop = in_rooms(ox, oy, SHOPBASE).charAt(0);
        game.u.ushops = fakeshop;
        try {
            await addtobill(otmp, true, false, false);
        } finally {
            game.u.ushops = saveushops;
        }
        robshop = !!otmp.unpaid && !saveushops.includes(fakeshop);
    }

    const oldcap = near_capacity();
    const result = await addinv(otmp);
    if (near_capacity() !== oldcap)
        game._encumber_status_stale = true;
    if (robshop)
        note_unported_pickup('pick_obj:remote_burglary');
    return result;
}

// src/pickup.c:1948 pickup_prinv() limits encumbrance feedback to the first
// item in one pickup operation that changes the current load category.
export async function pickup_prinv(obj, count, verb) {
    const nearload = near_capacity();
    let prefix = '';
    if (nearload !== game.pickup_encumbrance) {
        prefix = nearload >= EXT_ENCUMBER ? 'You have extreme difficulty'
               : nearload >= HVY_ENCUMBER ? 'You have much trouble'
                 : nearload >= MOD_ENCUMBER ? 'You have trouble'
                   : nearload >= SLT_ENCUMBER ? 'You have a little trouble'
                     : '';
        game.pickup_encumbrance = nearload;
    }
    await prinv(prefix ? `${prefix} ${verb}` : null, obj, count);
}


// src/pickup.c:2075 do_loot_cont() / loot_container() — open one container.
//
// The locked arm is what a chest the hero has not opened before hits: the
// message differs by whether its locked state was already known, and either
// way lknown becomes set. autounlock, the chest trap and use_container's
// menu are recorded.
async function do_loot_cont(cobj, ccount, ci) {
    if (!cobj)
        return false;
    if (cobj.olocked) {
        let res = false;
        if (cobj.lknown)
            await pline(`${The(xname(cobj))} is locked.`);
        else
            await pline(`Hmmm, ${the(xname(cobj))} turns out to be locked.`);
        cobj.lknown = 1;

        /* src/pickup.c:2112 — flags.autounlock defaults to APPLY_KEY */
        const autounlock = game.flags?.autounlock ?? AUTOUNLOCK_APPLY_KEY;
        if (autounlock) {
            const { autokey, pick_lock } = await import('./lock.js');
            const ox = cobj.ox, oy = cobj.oy;
            let unlocktool = null;

            game.u.dz = 0; /* #loot isn't a move command; pick_lock cares */
            if (((autounlock & AUTOUNLOCK_APPLY_KEY) !== 0
                 && (unlocktool = autokey(true)) != null)
                || (autounlock & AUTOUNLOCK_UNTRAP) !== 0) {
                /* pass ox and oy to avoid direction prompt */
                if (await pick_lock(unlocktool, ox, oy, cobj))
                    res = true;
                return res;
            }
            if ((autounlock & AUTOUNLOCK_FORCE) !== 0)
                note_unported_pickup('do_loot_cont:autounlock_force');
        }
        return res;
    }
    cobj.lknown = 1; /* floor container, so no need for update_inventory() */

    if (cobj.otyp === ONAMES.BAG_OF_TRICKS) {
        /* "It develops a huge set of teeth and bites you!" rnd(10) losehp */
        note_unported_pickup('do_loot_cont:bag_of_tricks');
        return true;
    }
    return ((await use_container({ o: cobj }, false, ci < ccount)) !== ECMD_OK);
}

// src/pickup.c:2166 doloot() — the #loot command.
//
// The container-underfoot path and ordinary directional tail are ported. The
// confused arm, blind cockatrice check, multi-container menu, grave digging,
// and saddle removal are recorded.
export async function doloot() {
    game.loot_reset_justpicked = true;
    try {
        return await doloot_core();
    } finally {
        game.loot_reset_justpicked = false;
    }
}

async function doloot_core() {
    if (await check_capacity(null))
        return ECMD_OK;

    if (nohands(game.youmonst.data)) {
        await You('have no hands!');
        return ECMD_OK;
    }

    if (game.u.uprops?.CONFUSION) {
        note_unported_pickup('doloot:confused');
        return ECMD_OK;
    }

    const here = (game.level?.objects || [])
        .filter(o => o.ox === game.u.ux && o.oy === game.u.uy
                     && Is_container(o));

    if (here.length > 1) {
        note_unported_pickup('doloot:multiple_containers');
        return ECMD_OK;
    }
    if (here.length === 1) {
        const timepassed = await do_loot_cont(here[0], 1, 1);
        return timepassed ? ECMD_TIME : ECMD_OK;
    }

    let monBeside = false;
    for (let dx = -1; dx <= 1 && !monBeside; ++dx)
        for (let dy = -1; dy <= 1; ++dy)
            if (m_at(game.u.ux + dx, game.u.uy + dy)) {
                monBeside = true;
                break;
            }

    if (monBeside || game.iflags.menu_requested) {
        const cc = { x: game.u.ux, y: game.u.uy };
        const { get_adjacent_loc } = await import('./cmd.js');
        if (!await get_adjacent_loc('Loot in what direction?',
                                    'Invalid loot location',
                                    game.u.ux, game.u.uy, cc))
            return ECMD_OK;

        const underfoot = cc.x === game.u.ux && cc.y === game.u.uy;
        const mtmp = m_at(cc.x, cc.y);
        if (mtmp)
            note_unported_pickup('doloot:loot_mon_saddle');
        await You(`don't find anything ${underfoot ? 'here' : 'there'} to loot.`);
        return ECMD_OK;
    }

    await You("don't find anything here to loot.");
    return ECMD_OK;
}

function tip_ok(obj) {
    if (!obj || obj.oclass === OCLASSES.COIN_CLASS)
        return GETOBJ_EXCLUDE;
    if (Is_container(obj)
        || (obj.otyp === ONAMES.HORN_OF_PLENTY && obj.dknown
            && game.objects[obj.otyp].oc_name_known))
        return GETOBJ_SUGGEST;
    return GETOBJ_DOWNPLAY;
}

async function choose_tip_target(box, includeTargets = false) {
    const { tty_create_nhwindow, tty_start_menu, tty_add_menu,
            tty_add_menu_str, tty_end_menu, tty_display_nhwindow,
            tty_select_menu, tty_destroy_nhwindow, ATR_NONE, NHW_MENU }
        = await import('./tty/wintty.js');
    const { MENU_BEHAVE_STANDARD, MENU_ITEMFLAGS_NONE,
            MENU_ITEMFLAGS_SELECTED, PICK_ONE }
        = await import('./const.js');
    const { docrt } = await import('./display.js');
    const targets = includeTargets
        ? (game.invent || []).filter(obj => obj !== box && Is_container(obj)
            && !(obj.otyp === ONAMES.BAG_OF_TRICKS && obj.dknown
                 && game.objects[obj.otyp].oc_name_known))
        : [];

    const win = tty_create_nhwindow(NHW_MENU);
    tty_start_menu(win, MENU_BEHAVE_STANDARD);
    tty_add_menu(win, null, 1, '-', 0, ATR_NONE, NO_COLOR,
                 'on the floor', MENU_ITEMFLAGS_SELECTED);
    tty_add_menu_str(win, '');
    for (let i = 0; i < targets.length; ++i) {
        const target = targets[i];
        const excluded = target.olocked && target.lknown;
        tty_add_menu(win, null, excluded ? null : i + 2,
                     excluded ? 0 : target.invlet, 0, ATR_NONE, NO_COLOR,
                     `${excluded ? '    ' : ''}${doname(target)}`,
                     MENU_ITEMFLAGS_NONE);
    }
    tty_end_menu(win, `Where to tip the contents of ${doname(box)}`);
    await tty_display_nhwindow(win);
    const picks = await tty_select_menu(win, PICK_ONE);
    tty_destroy_nhwindow(win);
    await docrt();
    if (!picks.length)
        return { accepted: false, target: null };
    let picked = picks[0];
    if (picks.length > 1 && picked === 1)
        picked = picks[1];
    return {
        accepted: true,
        target: picked === 1 ? null : targets[picked - 2] || null,
    };
}

async function tip_horn(box) {
    if (!(await choose_tip_target(box)).accepted)
        return ECMD_OK;
    box.lknown = 1;
    const oldSpe = box.spe;
    const { hornoplenty } = await import('./apply.js');
    do {
        if (!await hornoplenty(box, true))
            break;
    } while (box.spe > 0);

    if (box.spe < oldSpe) {
        box.spe = oldSpe;
        const { check_unpaid_usage } = await import('./shk.js');
        await check_unpaid_usage(box, true);
        box.spe = 0;
        box.cknown = 1;
        update_inventory();
    }
    return ECMD_TIME;
}

async function trigger_tip_trap(box) {
    const { chest_trap } = await import('./trap.js');
    await chest_trap(box, HAND, false);
    if ((game.multi ?? 0) >= 0) {
        nomul(-1);
        game.multi_reason = 'tipping a container';
        game.nomovemsg = '';
    }
}

async function tip_bag_of_tricks(box) {
    const oldSpe = box.spe;
    const seen = { count: 0 };
    const { bagotricks } = await import('./apply.js');
    do {
        if (!await bagotricks(box, true, seen))
            break;
    } while (box.spe > 0);

    if (box.spe < oldSpe) {
        if (!seen.count)
            await pline(nothing_seems_to_happen);
        box.spe = oldSpe;
        const { check_unpaid_usage } = await import('./shk.js');
        await check_unpaid_usage(box, true);
        box.spe = 0;
        box.cknown = 1;
        update_inventory();
    }
}

// src/pickup.c tipcontainer() - tip a container onto the floor or into another
// container. Ice boxes and shop billing stay explicit until each has a C
// oracle.
async function tipcontainer(box) {
    const choice = await choose_tip_target(box, true);
    if (!choice.accepted)
        return;
    let targetbox = choice.target;

    if (targetbox?.otyp === ONAMES.BAG_OF_TRICKS) {
        const { bagotricks } = await import('./apply.js');
        await bagotricks(targetbox);
        return;
    }

    if (!box.lknown) {
        box.lknown = 1;
        if (carried(box))
            update_inventory();
    }
    if (box.olocked) {
        await pline(`${The(xname(box))} is locked.`);
        return;
    }
    if (box.otrapped) {
        await trigger_tip_trap(box);
        return;
    }
    if (targetbox && !targetbox.lknown) {
        targetbox.lknown = 1;
        if (carried(targetbox))
            update_inventory();
    }
    if (targetbox?.olocked) {
        await pline(`${The(xname(targetbox))} is locked.`);
        return;
    }
    if (targetbox?.otrapped) {
        await trigger_tip_trap(targetbox);
        return;
    }
    if (box.otyp === ONAMES.BAG_OF_TRICKS) {
        await tip_bag_of_tricks(box);
        return;
    }
    if (!Has_contents(box)) {
        box.cknown = 1;
        await pline(`${The(xname(box))} is empty.`);
        return;
    }
    if ((game.level?.flags?.has_shop)
        && costly_spot(game.u.ux, game.u.uy)) {
        note_unported_pickup('tipcontainer:shop-billing');
        return;
    }

    const contents = [...box.cobj];
    const sourceHeld = carried(box);
    const targetHeld = targetbox && carried(targetbox);
    const cursedMbag = Is_mbag(box) && box.cursed;
    let terse = true;
    box.cknown = 1;
    if (targetbox)
        await pline(`${contents.length > 1 ? 'Objects tumble' : 'An object tumbles'} into ${
            the(xname(targetbox))}.`);
    else
        await pline(`${contents.length > 1 ? 'Objects spill' : 'An object spills'} out:`);
    const { dropy } = targetbox ? {} : await import('./do.js');
    for (let i = 0; i < contents.length; ++i) {
        const obj = contents[i];
        obj_extract_self(obj);
        obj.ox = game.u.ux;
        obj.oy = game.u.uy;
        if (box.otyp === ONAMES.ICE_BOX) {
            await removed_from_icebox(obj);
        } else if (cursedMbag && !rn2(13)) {
            await mbag_item_gone(sourceHeld, obj, false);
            terse = false;
            continue;
        }
        if (targetbox) {
            if (Is_mbag(targetbox) && mbag_explodes(obj, 0)) {
                await urgent_pline(`As ${doname(obj)} ${otense(obj, 'tumble')} inside, you are blasted by a magical explosion!`);
                if (obj.otyp === ONAMES.BAG_OF_HOLDING)
                    await do_boh_explosion(obj, !sourceHeld);
                obfree(obj);

                await do_boh_explosion(targetbox, !targetHeld);
                if (targetHeld)
                    useup(targetbox);
                else
                    await useupf(targetbox, targetbox.quan);
                targetbox = null;

                await losehp(d(6, 6), 'magical explosion', KILLED_BY_AN);
                break;
            }
            add_to_container(targetbox, obj);
        } else {
            if (terse) {
                await pline(`${doname(obj)}${i + 1 < contents.length ? ',' : '.'}`);
            } else {
                await pline(`${upstart(doname(obj))} ${otense(obj, 'drop')} to the ${
                    surface(game.u.ux, game.u.uy)}.`);
            }
            obj.how_lost = LOST_DROPPED;
            await dropy(obj);
        }
    }
    box.owt = weight(box);
    if (targetbox)
        targetbox.owt = weight(targetbox);
    if (sourceHeld || targetHeld)
        update_inventory();
}

// src/pickup.c:3562 dotip(): floor-container selection and carried horn of
// plenty emptying.
export async function dotip() {
    const here = (game.level?.objects || [])
        .filter(o => o.ox === game.u.ux && o.oy === game.u.uy
                     && Is_container(o));
    if (here.length === 1) {
        const { tty_yn_function } = await import('./tty/topl.js');
        const c = await tty_yn_function(
            `There is ${doname(here[0])} here, tip it?`, 'ynq', 'q');
        if (c === 'q')
            return ECMD_OK;
        if (c === 'y') {
            await tipcontainer(here[0]);
            return ECMD_TIME;
        }
    }

    const cobj = await getobj('tip', tip_ok, GETOBJ_PROMPT);
    if (!cobj)
        return ECMD_CANCEL;
    if (cobj.otyp === ONAMES.HORN_OF_PLENTY)
        return await tip_horn(cobj);
    if (Is_container(cobj)) {
        await tipcontainer(cobj);
        return ECMD_TIME;
    }

    let spillage = null;
    if (cobj.otyp === ONAMES.CAN_OF_GREASE && cobj.spe > 0) {
        spillage = 'grease';
    } else if (cobj.otyp === ONAMES.FOOD_RATION
               || cobj.otyp === ONAMES.CRAM_RATION
               || cobj.otyp === ONAMES.LEMBAS_WAFER) {
        spillage = 'crumbs';
    } else if (cobj.oclass === OCLASSES.VENOM_CLASS) {
        spillage = 'venom';
    }
    if (spillage) {
        let suffix = '';
        if (is_pool(game.u.ux, game.u.uy))
            suffix = ` and gradually ${vtense(spillage, 'dissipate')}`;
        else if (is_lava(game.u.ux, game.u.uy))
            suffix = ` and immediately ${vtense(spillage, 'burn')} away`;
        await pline(`Some ${spillage} ${vtense(spillage, 'spill')} onto the ${
            surface(game.u.ux, game.u.uy)}${suffix}.`);
        if (cobj.otyp === ONAMES.CAN_OF_GREASE) {
            const { consume_obj_charge } = await import('./apply.js');
            await consume_obj_charge(cobj, true);
        }
        return ECMD_TIME;
    }

    if (cobj.oclass === OCLASSES.POTION_CLASS) {
        await pline(`${The(xname(cobj))} ${otense(cobj, 'are')} securely sealed.`);
    } else if (cobj.otyp === ONAMES.STATUE) {
        await pline('Nothing interesting happens.');
    } else {
        await pline(nothing_happens);
    }
    return ECMD_OK;
}

/* ================================================================== *
 * Container interaction: src/pickup.c:2558-3480.
 * ================================================================== */


// src/pickup.c:469 menu_class_present()
export function menu_class_present(c) {
    return !!(c && (game.valid_menu_classes || '').includes(
        typeof c === 'number' ? String.fromCharCode(c) : c));
}

// src/pickup.c:475 add_valid_menu_class()
export function add_valid_menu_class(c) {
    if (c === 0) { /* reset */
        game.valid_menu_classes = '';
        game.class_filter = game.bucx_filter = game.shop_filter = false;
        game.picked_filter = false;
    } else if (!menu_class_present(c)) {
        const ch = typeof c === 'number' ? String.fromCharCode(c) : c;
        game.valid_menu_classes = (game.valid_menu_classes || '') + ch;
        switch (ch) {
        case 'B': case 'U': case 'C': case 'X':
            game.bucx_filter = true;
            break;
        case 'P':
            game.picked_filter = true;
            break;
        case 'u':
            game.shop_filter = true;
            break;
        default:
            game.class_filter = true;
            break;
        }
    }
}

/* src/pickup.c:523 allow_category() — see the C's long comment: with more
   than one filter TYPE active, an object must match one entry of EACH type */
export function allow_category(obj) {
    if (!game.class_filter && !game.shop_filter && !game.bucx_filter
        && !game.picked_filter && !(paranoia_bits() & PARANOID_AUTOALL))
        return false;

    if (obj.oclass === OCLASSES.COIN_CLASS && game.class_filter)
        return menu_class_present(OCLASSES.COIN_CLASS);

    /* Role_if(PM_CLERIC): priests automatically sense bless/curse state */
    if (Role_if(PMNAMES.PM_CLERIC) && !obj.bknown)
        set_bknown(obj, 1);

    if (game.class_filter && !menu_class_present(obj.oclass))
        return false;
    if (game.shop_filter && !obj.unpaid
        && !(Has_contents(obj) && count_unpaid(obj.cobj) > 0))
        return false;
    if (game.bucx_filter) {
        let bucx = !obj.bknown ? 'X'
                   : obj.blessed ? 'B' : obj.cursed ? 'C' : 'U';
        /* coins get treated as either 'U' or 'X' depending on goldX */
        if (obj.oclass === OCLASSES.COIN_CLASS)
            bucx = game.flags?.goldX ? 'X' : 'U';
        if (!menu_class_present(bucx))
            return false;
    }
    if (game.picked_filter && !obj.pickup_prev)
        return false;
    return true;
}

// src/pickup.c:609 is_worn_by_type()
export function is_worn_by_type(otmp) {
    return is_worn(otmp) && allow_category(otmp);
}

// src/pickup.c:635 count_justpicked()
export function count_justpicked(olist) {
    let cnt = 0;
    for (const otmp of olist || [])
        if (otmp.pickup_prev) ++cnt;
    return cnt;
}

// src/pickup.c:650 find_justpicked()
export function find_justpicked(olist) {
    for (const otmp of olist || [])
        if (otmp.pickup_prev) return otmp;
    return null;
}

/* src/pickup.c:1511 count_categories() */
function count_categories(olist, filter = null) {
    let ccount = 0;
    const seen = new Set();
    for (const curr of olist || []) {
        if (filter && !filter(curr))
            continue;
        if (!seen.has(curr.oclass)) {
            seen.add(curr.oclass);
            ccount++;
        }
    }
    return ccount;
}

/* include/hack.h query_category qflags */
import { BILLED_TYPES } from './const.js';
const ALL_TYPES = 0x0020, UNPAID_TYPES = 0x0004, WORN_TYPES = 0x0010,
      CHOOSE_ALL = 0x0080,
      BUC_BLESSED = 0x0100, BUC_CURSED = 0x0200, BUC_UNCURSED = 0x0400,
      BUC_UNKNOWN = 0x0800, BUCX_TYPES = 0x0f00, JUSTPICKED = 0x1000,
      INCLUDE_VENOM = 0x0002, INVORDER_SORT = 0x0010;
const ALL_TYPES_SELECTED = -2;

// src/pickup.c:1226 query_category() — the "what type of objects?" menu.
// Returns the list of picked category codes ('A', class symbols' char
// codes, ALL_TYPES_SELECTED, 'B'/'U'/'C'/'X'). Identifiers in the tty
// menu are the codes themselves (offset by +1000 to keep them non-zero
// is unnecessary: all are non-zero already).
async function query_category(qstr, olist, qflags, how = null) {
    const { tty_create_nhwindow, tty_start_menu, tty_add_menu,
            tty_add_menu_str, tty_end_menu, tty_display_nhwindow,
            tty_select_menu, tty_destroy_nhwindow, ATR_NONE, ATR_INVERSE,
            NHW_MENU } = await import('./tty/wintty.js');
    const { MENU_BEHAVE_STANDARD, MENU_ITEMFLAGS_NONE,
            MENU_ITEMFLAGS_SKIPINVERT, PICK_ONE, PICK_ANY }
        = await import('./const.js');
    if (!olist || !olist.length)
        return [];

    const do_worn = (qflags & WORN_TYPES) !== 0;
    const ofilter = do_worn ? (obj) => !!obj.owornmask : null;
    const do_unpaid = (qflags & UNPAID_TYPES) !== 0 && count_unpaid(olist);
    const do_usedup = (qflags & BILLED_TYPES) !== 0;
    let num_buc_types = 0;
    const do_blessed = (qflags & BUC_BLESSED) !== 0
                       && count_buc(olist, BUC_BLESSED, ofilter) && ++num_buc_types;
    const do_cursed = (qflags & BUC_CURSED) !== 0
                      && count_buc(olist, BUC_CURSED, ofilter) && ++num_buc_types;
    const do_uncursed = (qflags & BUC_UNCURSED) !== 0
                        && count_buc(olist, BUC_UNCURSED, ofilter) && ++num_buc_types;
    const do_buc_unknown = (qflags & BUC_UNKNOWN) !== 0
                           && count_buc(olist, BUC_UNKNOWN, ofilter) && ++num_buc_types;
    const num_justpicked = (qflags & JUSTPICKED) !== 0
        ? olist.filter(o => o.pickup_prev).length : 0;

    const ccount = count_categories(olist, ofilter);
    /* no point in actually showing a menu for a single category */
    if (ccount === 1 && !do_unpaid && !do_usedup && num_buc_types <= 1) {
        const curr = olist.find((obj) => !ofilter || ofilter(obj));
        return curr ? [curr.oclass] : [];
    }

    const win = tty_create_nhwindow(NHW_MENU);
    tty_start_menu(win, MENU_BEHAVE_STANDARD);

    const pack = inv_order();
    const show_a = (qflags & ALL_TYPES) !== 0 && ccount > 1;

    if ((qflags & CHOOSE_ALL) !== 0) {
        tty_add_menu(win, null, 'A'.charCodeAt(0), 'A', 0, ATR_NONE,
                     NO_COLOR, do_worn
                         ? 'Auto-select every item being worn or wielded'
                         : 'Auto-select every relevant item',
                     MENU_ITEMFLAGS_SKIPINVERT);
        /* verify_All needs paranoid_confirm:A which defaults off */
        tty_add_menu_str(win,
            '    (ignored unless some other choices are also picked)');
        tty_add_menu_str(win, '');
    }

    /* C assigns invlet explicitly, 'a' for All types then b,c,... for
       each class present */
    let invlet = 'a';
    if (show_a) {
        tty_add_menu(win, null, ALL_TYPES_SELECTED, invlet, 0, ATR_NONE,
                     NO_COLOR, do_worn ? 'All worn and wielded types' : 'All types',
                     MENU_ITEMFLAGS_SKIPINVERT);
        invlet = String.fromCharCode(invlet.charCodeAt(0) + 1);
    }

    /* one entry per class present, in packorder (inv_order() already
       yields class numbers) */
    for (const oclass of pack) {
        if (!olist.some(o => o.oclass === oclass
                             && (!ofilter || ofilter(o))))
            continue;
        tty_add_menu(win, null, oclass, invlet, def_oc_syms[oclass],
                     ATR_NONE, NO_COLOR,
                     let_to_name(oclass), MENU_ITEMFLAGS_NONE);
        invlet = String.fromCharCode(invlet.charCodeAt(0) + 1);
    }

    if (do_unpaid || do_usedup || num_buc_types > 0 || num_justpicked)
        tty_add_menu_str(win, '');
    if (do_unpaid)
        tty_add_menu(win, null, 'u'.charCodeAt(0), 'u', 0, ATR_NONE,
                     NO_COLOR, 'Unpaid items', MENU_ITEMFLAGS_SKIPINVERT);
    if (do_usedup)
        tty_add_menu(win, null, 'x'.charCodeAt(0), 'x', 0, ATR_NONE,
                     NO_COLOR, 'Unpaid items already used up', MENU_ITEMFLAGS_SKIPINVERT);
    /* the BUCX cluster is in alphabetical order (B, C, U, X), reversing
       the usual U/C sequence, and every entry skips bulk inverts */
    if (do_blessed)
        tty_add_menu(win, null, 'B'.charCodeAt(0), 'B', 0, ATR_NONE,
                     NO_COLOR, 'Items known to be Blessed',
                     MENU_ITEMFLAGS_SKIPINVERT);
    if (do_cursed)
        tty_add_menu(win, null, 'C'.charCodeAt(0), 'C', 0, ATR_NONE,
                     NO_COLOR, 'Items known to be Cursed',
                     MENU_ITEMFLAGS_SKIPINVERT);
    if (do_uncursed)
        tty_add_menu(win, null, 'U'.charCodeAt(0), 'U', 0, ATR_NONE,
                     NO_COLOR, 'Items known to be Uncursed',
                     MENU_ITEMFLAGS_SKIPINVERT);
    if (do_buc_unknown)
        tty_add_menu(win, null, 'X'.charCodeAt(0), 'X', 0, ATR_NONE,
                     NO_COLOR, 'Items of unknown Bless/Curse status',
                     MENU_ITEMFLAGS_SKIPINVERT);
    if (num_justpicked) {
        const jp = olist.find(o => o.pickup_prev);
        const buf = (num_justpicked === 1 && jp)
                    ? `Just picked up: ${doname(jp)}`
                    : 'Items you just picked up';
        tty_add_menu(win, null, 'P'.charCodeAt(0), 'P', 0, ATR_NONE,
                     NO_COLOR, buf, MENU_ITEMFLAGS_SKIPINVERT);
    }
    tty_end_menu(win, qstr);
    await tty_display_nhwindow(win);
    const picks = await tty_select_menu(win, how ?? PICK_ANY);
    tty_destroy_nhwindow(win);
    /* tty_select_menu() already dismisses the window while status output is
       suppressed. A second docrt() here would repaint status cells which C
       deliberately leaves cleared after a tall category menu. */
    return picks;
}

// src/invent.c dotypeinv(), default MENU_FULL category prompt. Unlike the
// drop and loot callers this accepts exactly one class or BUC filter.
export async function query_inventory_category(olist, billx = false) {
    return query_category(
        'What type of object do you want an inventory of?', olist,
        UNPAID_TYPES | BUC_BLESSED | BUC_CURSED | BUC_UNCURSED | BUC_UNKNOWN
        | JUSTPICKED | INCLUDE_VENOM | (billx ? BILLED_TYPES : 0),
        1 /* PICK_ONE */);
}

// src/do_wear.c menu_remarm(), default MENU_FULL category prompt.
export async function query_remove_categories(olist) {
    return query_category(
        'What type of things do you want to take off?', olist,
        WORN_TYPES | ALL_TYPES | UNPAID_TYPES | BUCX_TYPES,
        2 /* PICK_ANY */);
}

// src/do.c:994 menu_drop() category flags for MENU_FULL.
export async function query_drop_categories(olist) {
    return query_category(
        'Drop what type of items?', olist,
        UNPAID_TYPES | ALL_TYPES | CHOOSE_ALL | BUC_BLESSED | BUC_CURSED
        | BUC_UNCURSED | BUC_UNKNOWN | JUSTPICKED | INCLUDE_VENOM);
}

// src/pickup.c:2488 mbag_explodes() -- recursively decide whether an object
// placed into a magical bag triggers an explosion.
function mbag_explodes(obj, depthin) {
    if ((obj.otyp === ONAMES.WAN_CANCELLATION
         || obj.otyp === ONAMES.BAG_OF_TRICKS)
        && obj.spe <= 0)
        return false;

    if ((Is_mbag(obj) || obj.otyp === ONAMES.WAN_CANCELLATION)
        && rn2(1 << Math.min(depthin, 7)) <= depthin)
        return true;

    for (const contained of (obj.cobj || []))
        if (mbag_explodes(contained, depthin + 1))
            return true;

    return false;
}


// src/pickup.c:2510 is_boh_item_gone()
export function is_boh_item_gone() {
    return !rn2(13);
}

// src/pickup.c:2518 do_boh_explosion() -- remove a magical bag's contents,
// destroying a small random fraction and scattering everything else.
async function do_boh_explosion(boh, onFloor) {
    boh.in_use = 1;
    for (const obj of [...(boh.cobj || [])]) {
        if (is_boh_item_gone()) {
            obj_extract_self(obj);
            await mbag_item_gone(!onFloor, obj, true);
        } else {
            obj.ox = game.u.ux;
            obj.oy = game.u.uy;
            await scatter(game.u.ux, game.u.uy, 4, MAY_HIT | MAY_DESTROY, obj);
        }
    }
}

// src/pickup.c:2537 boh_loss() -- opening a cursed magical bag gives every
// contained object an independent one-in-thirteen chance to vanish.
async function boh_loss(container, held) {
    let loss = 0;
    if (Is_mbag(container) && container.cursed && Has_contents(container)) {
        for (const item of [...container.cobj]) {
            if (is_boh_item_gone()) {
                obj_extract_self(item);
                loss += await mbag_item_gone(held, item, false);
            }
        }
    }
    return loss;
}

// src/pickup.c:2558 in_container()
export async function in_container(obj) {
    const floor_container = !game.current_container || !carried(game.current_container);
    let was_unpaid = false;
    if (!game.current_container) {
        await impossible('<in> no gc.current_container?');
        return 0;
    } else if (obj === game.uball || obj === game.uchain) {
        await You('must be kidding.');
        return 0;
    } else if (obj === game.current_container) {
        await pline('That would be an interesting topological exercise.');
        return 0;
    } else if (obj.owornmask & (W_ARMOR | W_ACCESSORY)) {
        await Norep(`You cannot ${game.current_container.otyp === ONAMES.ICE_BOX ? 'refrigerate' : 'stash'} something you are wearing.`);
        return 0;
    } else if (obj.otyp === ONAMES.LOADSTONE && obj.cursed) {
        set_bknown(obj, 1);
        await pline_The(`stone${obj.quan === 1 ? '' : 's'} won't leave your person.`);
        return 0;
    } else if (obj.otyp === ONAMES.AMULET_OF_YENDOR
        || obj.otyp === ONAMES.CANDELABRUM_OF_INVOCATION
        || obj.otyp === ONAMES.BELL_OF_OPENING
        || obj.otyp === ONAMES.SPE_BOOK_OF_THE_DEAD) {
        await pline(`${The(xname(obj))} cannot be confined in such trappings.`);
        return 0;
    } else if (obj.otyp === ONAMES.LEASH && obj.leashmon) {
        await pline(`${Tobjnam(obj, 'are')} attached to your pet.`);
        return 0;
    } else if (obj === game.u.uwep) {
        if (welded(obj)) {
            await weldmsg(obj);
            return 0;
        }
        await setuwep_with_feedback(null);
        if (game.u.uwep) return 0;
    } else if (obj === game.u.uswapwep) {
        setuswapwep(null);
    } else if (obj === game.u.uquiver) {
        setuqwep(null);
    }
    if (await fatal_corpse_mistake(obj, false)) return -1;
    if (obj.otyp === ONAMES.ICE_BOX || Is_box_p(obj) || obj.otyp === ONAMES.BOULDER
        || (obj.otyp === ONAMES.STATUE && bigmonst(game.mons[obj.corpsenm]))) {
        const buf = the(xname(obj));
        await You(`cannot fit ${buf} into ${the(xname(game.current_container))}.`);
        return 0;
    }
    freeinv(obj);
    if (obj_is_burning(obj)) {
        const { snuff_lit } = await import('./apply.js');
        await snuff_lit(obj);
    }
    if (floor_container && costly_spot(game.u.ux, game.u.uy)) {
        if (obj.oclass !== OCLASSES.COIN_CLASS) {
            was_unpaid = !!obj.unpaid;
            if (game.sellobj_first) {
                sellobj_state(game.current_container.no_charge ? 2 : 1);
                game.sellobj_first = false;
            }
            await sellobj(obj, game.u.ux, game.u.uy);
        }
    }
    if (game.current_container.otyp === ONAMES.ICE_BOX && !age_is_relative(obj)) {
        obj.age = game.moves - obj.age;
        const { stop_timer, ROT_CORPSE, REVIVE_MON, SHRINK_GLOB } = await import('./timeout.js');
        if (obj.otyp === ONAMES.CORPSE) {
            if (obj.timed) {
                stop_timer(ROT_CORPSE, obj);
                stop_timer(REVIVE_MON, obj);
            }
            if (obj.corpsenm === PMNAMES.PM_ICE_TROLL && has_omonst(obj))
                OMONST(obj).mcan = 0;
        } else if (obj.globby && obj.timed) {
            stop_timer(SHRINK_GLOB, obj);
        }
    } else if (Is_mbag(game.current_container) && mbag_explodes(obj, 0)) {
        livelog_printf(LL_ACHIEVE, `just blew up ${uhis()} bag of holding`);
        await urgent_pline(`As you put ${doname(obj)} inside, you are blasted by a magical explosion!`);
        if (was_unpaid) await addtobill(obj, false, false, true);
        if (obj.otyp === ONAMES.BAG_OF_HOLDING)
            await do_boh_explosion(obj, obj.where === OBJ_FLOOR);
        obfree(obj);
        if (floor_container && costly_spot(game.current_container.ox, game.current_container.oy)) {
            const save_no_charge = game.current_container.no_charge;
            await addtobill(game.current_container, false, false, false);
            game.current_container.no_charge = save_no_charge;
        }
        await do_boh_explosion(game.current_container, floor_container);
        if (!floor_container) useup(game.current_container);
        else if (obj_here(game.current_container, game.u.ux, game.u.uy))
            await useupf(game.current_container, game.current_container.quan);
        else throw new Error('in_container:  bag not found.');
        await losehp(d(6, 6), 'magical explosion', KILLED_BY_AN);
        game.current_container = null;
    }
    if (game.current_container) {
        const buf = the(xname(game.current_container));
        await You(`put ${doname(obj)} into ${buf}.`);
        if (floor_container && obj.oclass === OCLASSES.COIN_CLASS)
            await sellobj(obj, game.current_container.ox, game.current_container.oy);
        add_to_container(game.current_container, obj);
        game.current_container.owt = weight(game.current_container);
    }
    await bot();
    return game.current_container ? 1 : -1;
}

// src/pickup.c:2721 ck_bag()
export function ck_bag(obj) {
    return !!game.current_container && obj !== game.current_container;
}

// src/pickup.c:2727 out_container()
export async function out_container(obj) {
    const is_gold = obj.oclass === OCLASSES.COIN_CLASS;
    if (!game.current_container) {
        await impossible('<out> no gc.current_container?');
        return -1;
    } else if (is_gold) obj.owt = weight(obj);
    if (obj.oartifact && !await touch_artifact(obj, game.youmonst)) return 0;
    if (await fatal_corpse_mistake(obj, false)) return -1;
    const count = { v: obj.quan };
    const res = await lift_object(obj, game.current_container, count, false);
    if (res <= 0) return res;
    if (obj.quan !== count.v && obj.otyp !== ONAMES.LOADSTONE)
        obj = splitobj(obj, count.v);
    obj_extract_self(obj);
    game.current_container.owt = weight(game.current_container);
    if (game.current_container.otyp === ONAMES.ICE_BOX) await removed_from_icebox(obj);
    if (!obj.unpaid && !carried(game.current_container)
        && costly_spot(game.current_container.ox, game.current_container.oy)) {
        obj.ox = game.current_container.ox;
        obj.oy = game.current_container.oy;
        await addtobill(obj, false, false, false);
    }
    if (is_pick(obj)) await pick_pick(obj);
    const otmp = await addinv(obj);
    await pickup_prinv(otmp, count.v, 'removing');
    if (is_gold) await bot();
    return 1;
}

// src/pickup.c:2781 removed_from_icebox()
export async function removed_from_icebox(obj) {
    if (!age_is_relative(obj)) {
        obj.age = game.moves - obj.age;
        if (obj.otyp === ONAMES.CORPSE) {
            const m = get_mtraits(obj, false);
            const iceT = m ? m.data === game.mons[PMNAMES.PM_ICE_TROLL]
                : obj.corpsenm === PMNAMES.PM_ICE_TROLL;
            obj.norevive = iceT ? 0 : 1;
            start_corpse_timeout(obj);
        } else if (obj.globby) start_glob_timeout(obj, 0);
    }
}

// src/pickup.c:2803 mbag_item_gone() -- finish deleting one object lost from
// a cursed or exploding magical bag. Shop billing remains explicit.
async function mbag_item_gone(held, item, silent) {
    let loss = 0;
    if (!silent) {
        if (item.dknown) {
            await pline(`${upstart(doname(item))} ${otense(item, 'have')} vanished!`);
        } else {
            await You(`${Blind() ? 'notice' : 'see'} ${doname(item)} disappear!`);
        }
    }
    const shkp = game.u.ushops && shop_keeper(game.u.ushops.charCodeAt(0));
    if (shkp && (held ? !!item.unpaid : costly_spot(game.u.ux, game.u.uy)))
        loss = await stolen_value(item, game.u.ux, game.u.uy, !!shkp.mpeaceful, true);
    obfree(item);
    return loss;
}

// src/pickup.c:2826 observe_quantum_cat()
export async function observe_quantum_cat(box, makecat, givemsg) {
    const sc = "Schroedinger's Cat", cc = {};
    let livecat = null;
    const itsalive = !rn2(2);
    if (get_obj_location(box, cc, 0)) {
        box.ox = cc.x;
        box.oy = cc.y;
    }
    let deadcat = box.cobj?.[0];
    if (itsalive) {
        if (makecat)
            livecat = makemon(game.mons[PMNAMES.PM_HOUSECAT], box.ox, box.oy,
                              NO_MINVENT | MM_ADJACENTOK | MM_NOMSG);
        if (livecat) {
            livecat.mpeaceful = 1;
            set_malign(livecat);
            if (givemsg) {
                if (!canspotmon(livecat)) await You(`think something brushed your ${body_part(FOOT)}.`);
                else await pline(`${Monnam(livecat)} inside the box is still alive!`);
            }
            christen_monst(livecat, sc);
            if (deadcat) {
                obj_extract_self(deadcat);
                obfree(deadcat);
                deadcat = null;
            }
            box.owt = weight(box);
            box.spe = 0;
            if (!game.context.mon_moving) {
                more_experienced(10, 20);
                await newexplevel();
            }
        }
    } else {
        box.spe = 0;
        if (givemsg) await pline_The(`${Hallucination() ? rndmonnam(null) : 'housecat'} inside the box is dead!`);
        if (deadcat) {
            deadcat.age = game.moves;
            set_corpsenm(deadcat, PMNAMES.PM_HOUSECAT);
            deadcat = oname(deadcat, sc, ONAME_NO_FLAGS);
            if (!game.context.mon_moving) {
                more_experienced(20, 10);
                await newexplevel();
            }
        }
    }
}

// src/pickup.c:2903 container_gone()
export function container_gone(fn) {
    return (fn === in_container || fn === out_container) && !game.current_container;
}

/* include/obj.h Is_box() — the local ONAMES spelling */
const Is_box_p = (o) => o.otyp === ONAMES.LARGE_BOX
                        || o.otyp === ONAMES.CHEST;

// src/pickup.c:2911 explain_container_prompt()
export async function explain_container_prompt(more_containers) {
    const explaintext = [
        'Container actions:', '',
        ' : -- Look: examine contents',
        ' o -- Out: take things out',
        ' i -- In: put things in',
        ' b -- Both: first take things out, then put things in',
        ' r -- Reversed: put things in, then take things out',
        ' s -- Stash: put one item in', '',
        ' n -- Next: loot next selected container',
        ' q -- Quit: finished',
        ' ? -- Help: display this text.', '',
    ];
    const win = tty_create_nhwindow(NHW_TEXT);
    for (const text of explaintext) {
        if (!more_containers && text.startsWith(' n ')) continue;
        tty_putstr(win, 0, text);
    }
    await tty_display_nhwindow(win);
    do {
        await xwaitforspace(' \r\n\x1b');
    } while (game.morc !== '\x1b' && tty_next_page(win));
    tty_destroy_nhwindow(win);
    await docrt();
}

// src/pickup.c:2943 u_handsy(); the hero has hands and one of them is free
export async function u_handsy() {
    if (nohands(game.youmonst.data)) {
        await You('have no hands!'); /* not `body_part(HAND)' */
        return false;
    } else if (!freehand()) {
        await You(`have no free ${body_part(HAND)}.`);
        return false;
    }
    return true;
}

// src/pickup.c:2957 stash_ok()
function stash_ok(obj) {
    if (!obj)
        return GETOBJ_EXCLUDE;
    if (!ck_bag(obj))
        return GETOBJ_EXCLUDE_SELECTABLE;
    return GETOBJ_SUGGEST;
}

// src/pickup.c:2972 use_container(); objp.o can be cleared by an explosion.
export async function use_container(objp, held, more_containers) {
    const obj = objp.o;
    let used = ECMD_OK, emptymsg = '';
    game.abort_looting = false;
    game.sellobj_first = true;
    if (!await u_handsy()) return ECMD_OK;
    if (!obj.lknown) {
        obj.lknown = 1;
        if (held) update_inventory();
    }
    if (obj.olocked) {
        await pline(`${Tobjnam(obj, 'are')} locked.`);
        if (held) await You('must put it down to unlock.');
        return ECMD_OK;
    } else if (obj.otrapped) {
        if (held) await You(`open ${the(xname(obj))}...`);
        const { chest_trap } = await import('./trap.js');
        await chest_trap(obj, HAND, false);
        if ((game.multi ?? 0) >= 0) {
            nomul(-1);
            game.multi_reason = 'opening a container';
            game.nomovemsg = '';
        }
        game.abort_looting = true;
        return ECMD_TIME;
    }
    game.current_container = obj;
    const quantum_cat = SchroedingersBox(game.current_container);
    if (quantum_cat) {
        await observe_quantum_cat(game.current_container, true, true);
        used = ECMD_TIME;
    }
    const cursed_mbag = Is_mbag(game.current_container)
        && game.current_container.cursed && Has_contents(game.current_container);
    let loss;
    if (cursed_mbag && (loss = await boh_loss(game.current_container, held)) !== 0) {
        used = ECMD_TIME;
        await You(`owe ${loss} ${currency(loss)} for lost merchandise.`);
        game.current_container.owt = weight(game.current_container);
    }
    let inokay = !!(game.invent?.length
        && (game.invent[0] !== game.current_container || game.invent.length > 1));
    const outokay = Has_contents(game.current_container);
    if (!outokay)
        emptymsg = `${Ysimple_name2(game.current_container)} is ${quantum_cat || cursed_mbag ? 'now ' : ''}empty.`;
    let c;
    for (;;) {
        const outmaybe = outokay || !game.current_container.cknown;
        const qbuf = !outmaybe
            ? safe_qbuf(null, ' is empty.  Do what with it?', game.current_container,
                        Yname2, Ysimple_name2, 'This')
            : safe_qbuf('Do what with ', '?', game.current_container,
                        yname, ysimple_name, 'it');
        if (game.flags.menu_style === MENU_PARTIAL || game.flags.menu_style === MENU_FULL) {
            if (!inokay && !outmaybe) c = 'b';
            else c = await in_or_out_menu(qbuf, game.current_container, outmaybe,
                                          inokay, used !== ECMD_OK, more_containers);
        } else {
            let pbuf = ':', xbuf = '';
            if (outmaybe) pbuf += 'o'; else xbuf += 'o';
            if (inokay) pbuf += 'i'; else xbuf += 'i';
            if (outmaybe) pbuf += 'b'; else xbuf += 'b';
            if (inokay) pbuf += 'rs'; else xbuf += 'rs';
            pbuf += ' ';
            if (more_containers) pbuf += 'n'; else xbuf += 'n';
            pbuf += 'q';
            if (boolean_option('cmdassist')) pbuf += ' or ?';
            else xbuf += '?';
            if (xbuf) pbuf += '\x1b' + xbuf;
            c = await tty_yn_function(qbuf, pbuf, more_containers ? 'n' : 'q', true);
        }
        if (c === '?') {
            await explain_container_prompt(more_containers);
        } else if (c === ':') {
            if (!game.current_container.cknown) used = ECMD_TIME;
            await container_contents([game.current_container], false, false, true);
        } else break;
    }
    if (c === 'q') game.abort_looting = true;
    containerdone: {
        if (c === 'n' || c === 'q') break containerdone;
        let loot_out = c === 'o' || c === 'b' || c === 'r';
        let loot_in = c === 'i' || c === 'b' || c === 'r';
        const loot_in_first = c === 'r';
        let stash_one = c === 's';
        if (loot_out && !loot_in_first) {
            if (!Has_contents(game.current_container)) {
                await pline(emptymsg);
                if (!game.current_container.cknown) used = ECMD_TIME;
                game.current_container.cknown = 1;
            } else {
                add_valid_menu_class(0);
                if (game.flags.menu_style === MENU_TRADITIONAL)
                    used |= await traditional_loot(false);
                else used |= (await menu_loot(0, false)) > 0 ? 1 : 0;
                add_valid_menu_class(0);
            }
            inokay = !!(game.invent?.length
                && (game.invent[0] !== game.current_container || game.invent.length > 1));
        }
        if ((loot_in || stash_one) && !inokay) {
            await You(`don't have anything${game.invent?.length ? ' else' : ''} to ${stash_one ? 'stash' : 'put in'}.`);
            loot_in = stash_one = false;
        }
        if (loot_in) {
            add_valid_menu_class(0);
            if (game.flags.menu_style === MENU_TRADITIONAL)
                used |= await traditional_loot(true);
            else used |= (await menu_loot(0, true)) > 0 ? 1 : 0;
            add_valid_menu_class(0);
        } else if (stash_one) {
            const otmp = await getobj('stash', stash_ok, GETOBJ_PROMPT | GETOBJ_ALLOWCNT);
            if (otmp) {
                if (await in_container(otmp)) used = 1;
                else await unsplitobj(otmp);
            }
        }
        if (!game.current_container) loot_out = false;
        if (loot_out && loot_in_first) {
            if (!Has_contents(game.current_container)) {
                await pline(emptymsg);
                if (!game.current_container.cknown) used = 1;
                game.current_container.cknown = 1;
            } else {
                add_valid_menu_class(0);
                if (game.flags.menu_style === MENU_TRADITIONAL)
                    used |= await traditional_loot(false);
                else used |= (await menu_loot(0, false)) > 0 ? 1 : 0;
                add_valid_menu_class(0);
            }
        }
    }
    if (used) {
        if (game.current_container) game.current_container.cknown = 1;
        update_inventory();
    }
    sellobj_state(0); /* SELL_NORMAL */
    objp.o = game.current_container;
    if (game.current_container) game.current_container = null;
    else game.abort_looting = true;
    return used;
}

// src/pickup.c:3230 traditional_loot()
export async function traditional_loot(put_in) {
    let action, objlist, actionfunc, checkfunc;
    const selection = [], one_by_one = {}, allflag = {}, menu_on_request = { v: 0 };
    let used = ECMD_OK;
    if (put_in) {
        action = 'put in';
        objlist = game.invent;
        actionfunc = in_container;
        checkfunc = ck_bag;
    } else {
        action = 'take out';
        objlist = game.current_container.cobj;
        actionfunc = out_container;
        checkfunc = null;
        game.pickup_encumbrance = 0;
    }
    if (await query_classes(selection, one_by_one, allflag, action, objlist, false, menu_on_request)) {
        if (await askchain(objlist, one_by_one.v ? null : selection, allflag.v,
                           actionfunc, checkfunc, 0, action))
            used = ECMD_TIME;
    } else if (menu_on_request.v < 0) {
        used = (await menu_loot(menu_on_request.v, put_in)) > 0 ? 1 : 0;
    }
    return used;
}

// src/pickup.c:3265 menu_loot()
export async function menu_loot(retry, put_in) {
    let n_looted = 0, all_categories = true, loot_everything = false, autopick = false;
    let loot_justpicked = false, count = 0;
    const action = put_in ? 'Put in' : 'Take out';
    game.pickup_encumbrance = 0;
    if (retry) {
        all_categories = retry === -2;
    } else if (game.flags.menu_style === MENU_FULL) {
        all_categories = false;
        const picks = await query_category(`${action} what type of objects?`,
            put_in ? game.invent : game.current_container.cobj,
            ALL_TYPES | UNPAID_TYPES | BUCX_TYPES | CHOOSE_ALL | JUSTPICKED);
        if (!picks.length) return ECMD_OK;
        for (const pick of picks) {
            if (pick === 'A'.charCodeAt(0)) {
                loot_everything = autopick = true;
            } else if (put_in && pick === 'P'.charCodeAt(0)) {
                loot_justpicked = true;
                count = Math.max(0, picks.counts?.get(pick) ?? -1);
                add_valid_menu_class(pick);
                loot_everything = false;
            } else if (pick === ALL_TYPES_SELECTED) {
                all_categories = true;
            } else {
                add_valid_menu_class(pick);
                loot_everything = false;
            }
        }
    }
    if (autopick) {
        let inout_func, firstobj;
        if (!put_in) {
            game.current_container.cknown = 1;
            inout_func = out_container;
            firstobj = game.current_container.cobj;
        } else {
            inout_func = in_container;
            firstobj = game.invent;
        }
        let otmp = firstobj?.[0];
        while (otmp && game.current_container) {
            const otmp2 = firstobj[firstobj.indexOf(otmp) + 1];
            if (loot_everything || all_categories || allow_category(otmp)) {
                const res = await inout_func(otmp);
                if (res < 0) break;
                n_looted += res;
            }
            otmp = otmp2;
        }
    } else if (put_in && loot_justpicked && count_justpicked(game.invent) === 1) {
        let otmp = find_justpicked(game.invent);
        if (otmp) {
            n_looted = 1;
            if (count > 0 && count < otmp.quan) otmp = splitobj(otmp, count);
            await in_container(otmp);
        }
    } else {
        let mflags = INVORDER_SORT | INCLUDE_VENOM;
        if (put_in && game.flags.fixinv !== false) mflags |= USE_INVLET;
        if (put_in && loot_justpicked) mflags |= JUSTPICKED;
        if (!put_in) game.current_container.cknown = 1;
        const picks = await query_objlist(`${action} what?`,
            put_in ? game.invent : game.current_container.cobj, mflags,
            PICK_ANY, all_categories ? allow_all : allow_category);
        if (picks.length) {
            n_looted = picks.length;
            for (const selected of picks) {
                let otmp = selected;
                count = picks.counts?.get(selected) ?? otmp.quan;
                if (count > 0 && count < otmp.quan) otmp = splitobj(otmp, count);
                const res = put_in ? await in_container(otmp) : await out_container(otmp);
                if (res <= 0) {
                    if (!game.current_container) otmp = null;
                    else if (otmp && otmp !== selected) await unsplitobj(otmp);
                    if (res < 0) break;
                }
            }
        }
    }
    return n_looted ? ECMD_TIME : ECMD_OK;
}

// src/pickup.c:3397 in_or_out_menu() — "Do what with <container>?"
async function in_or_out_menu(prompt, obj, outokay, inokay, alreadyused,
                              more_containers) {
    const { tty_create_nhwindow, tty_start_menu, tty_add_menu,
            tty_add_menu_str, tty_end_menu, tty_display_nhwindow,
            tty_select_menu, tty_destroy_nhwindow, ATR_NONE, NHW_MENU }
        = await import('./tty/wintty.js');
    const { MENU_BEHAVE_STANDARD, MENU_ITEMFLAGS_NONE,
            MENU_ITEMFLAGS_SELECTED, PICK_ONE }
        = await import('./const.js');
    const { docrt } = await import('./display.js');

    /* underscore is not a choice; it's used to skip element [0] */
    const lootchars = '_:oibrsnq', abc_chars = '_:abcdenq';
    const menuselector = game.flags?.lootabc ? abc_chars : lootchars;

    const win = tty_create_nhwindow(NHW_MENU);
    tty_start_menu(win, MENU_BEHAVE_STANDARD);

    tty_add_menu(win, null, 1, menuselector[1], 0, ATR_NONE, NO_COLOR,
                 `Look inside ${thesimpleoname(obj)}`, MENU_ITEMFLAGS_NONE);
    if (outokay)
        tty_add_menu(win, null, 2, menuselector[2], 0, ATR_NONE, NO_COLOR,
                     'take something out', MENU_ITEMFLAGS_NONE);
    if (inokay)
        tty_add_menu(win, null, 3, menuselector[3], 0, ATR_NONE, NO_COLOR,
                     'put something in', MENU_ITEMFLAGS_NONE);
    if (outokay)
        tty_add_menu(win, null, 4, menuselector[4], 0, ATR_NONE, NO_COLOR,
                     `${inokay ? 'both; ' : ''}take out, then put in`,
                     MENU_ITEMFLAGS_NONE);
    if (inokay) {
        tty_add_menu(win, null, 5, menuselector[5], 0, ATR_NONE, NO_COLOR,
                     `${outokay ? 'both reversed; ' : ''}put in, then take out`,
                     MENU_ITEMFLAGS_NONE);
        tty_add_menu(win, null, 6, menuselector[6], 0, ATR_NONE, NO_COLOR,
                     `stash one item into ${thesimpleoname(obj)}`,
                     MENU_ITEMFLAGS_NONE);
    }
    tty_add_menu_str(win, '');
    if (more_containers)
        tty_add_menu(win, null, 7, menuselector[7], 0, ATR_NONE, NO_COLOR,
                     'loot next container', MENU_ITEMFLAGS_SELECTED);
    tty_add_menu(win, null, 8, menuselector[8], 0, ATR_NONE, NO_COLOR,
                 alreadyused ? 'done' : 'do nothing',
                 more_containers ? MENU_ITEMFLAGS_NONE
                                 : MENU_ITEMFLAGS_SELECTED);

    tty_end_menu(win, prompt);
    await tty_display_nhwindow(win);
    const picks = await tty_select_menu(win, PICK_ONE);
    tty_destroy_nhwindow(win);
    await docrt();
    if (picks.length > 0) {
        let k = picks[0];
        /* preselected 'q'/'n' comes back alongside a real pick */
        if (picks.length > 1 && k === (more_containers ? 7 : 8))
            k = picks[1];
        return lootchars[k]; /* :,o,i,b,r,s,n,q */
    }
    return !picks.cancelled && more_containers ? 'n' : 'q';
}

// src/invent.c:403 sortloot_cmp(), the slice active for container and
// pile menus (SORTLOOT_LOOT|SORTLOOT_PACK, class already grouped by the
// caller): subclass, then discovery, then case-insensitive name, then
// BUCX descending.
export function sortloot_items(items, sortByLootName = true) {
    return items
        .map((obj, idx) => {
            const classified = {};
            loot_classify(classified, obj);
            return { obj, idx,
                     sub: classified.subclass,
                     disco: classified.disco,
                     nam: singular(obj, cxname).toLowerCase() };
        })
        .sort((a, b) => {
            if (a.sub !== b.sub) return a.sub - b.sub;
            if (a.disco !== b.disco) return a.disco - b.disco;
            if (!sortByLootName) return a.idx - b.idx;
            const nc = a.nam < b.nam ? -1 : a.nam > b.nam ? 1 : 0;
            if (nc) return nc;
            const v1 = a.obj.bknown ? (a.obj.blessed ? 3
                                       : !a.obj.cursed ? 2 : 1) : 0;
            const v2 = b.obj.bknown ? (b.obj.blessed ? 3
                                       : !b.obj.cursed ? 2 : 1) : 0;
            if (v1 !== v2) return v2 - v1;
            return a.idx - b.idx;   /* stable */
        })
        .map(e => e.obj);
}

// src/pickup.c:2024 container_at() — number of containers at a spot (or
// just whether there is one when !countem)
export function container_at(x, y, countem) {
    let container_count = 0;
    for (const cobj of (game.level?.objects || [])) {
        if (cobj.ox !== x || cobj.oy !== y)
            continue;
        if (Is_container(cobj)) {
            container_count++;
            if (!countem)
                break;
        }
    }
    return container_count;
}
