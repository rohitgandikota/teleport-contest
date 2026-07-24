// makemon.js — monster selection and creation.
// C ref: src/makemon.c
//
// rndmonst_adj() is the highest-volume function in the recorded corpus:
// 204,394 PRNG calls across the 44 public sessions. It is weighted reservoir
// sampling — one rn2(totalweight) per *eligible* monster — so the draw count
// depends on exactly which monsters pass the filters. Getting a filter wrong
// changes the number of draws, not just their values.

import { game } from './gstate.js';
import { rn2, rnd, d } from './rng.js';
import {
    mons as MONS_INIT, PMNAMES, NUMMONS, MONSYMS, MSOUND, ATTKS, MFLAGS,
    MMFLAGS, LIMITS, STRAT,
} from './monst_data.js';
import { ONAMES, OCLASSES } from './objects_data.js';
import { depth } from './dungeon.js';
import { next_ident, mksobj, mkobj } from './mkobj.js';
import { sgn, isok } from './hacklib.js';
import { ACCESSIBLE, POOL, LAVAPOOL } from './const.js';

// include/permonst.h:15,23
const NON_PM = -1;
const LOW_PM = NON_PM + 1;                 /* first monster in mons[] */
const SPECIAL_PM = PMNAMES.PM_LONG_WORM_TAIL;  /* [normal] < ~ < [special] */

// include/monflag.h — taken from the generated table, never written out by
// hand. There are two disjoint G_ families: the `geno` field bits (G_FREQ ..
// G_UNIQ) and the mvitals.mvflags bits (G_GENOD 0x02, G_EXTINCT 0x01). They
// overlap numerically — 0x0080 is G_SGROUP in the first family — so a
// hand-copied constant from the wrong family reads as a real flag and fails
// silently. See CLAUDE.md on hardcoded constants.
const {
    G_FREQ, G_NOGEN, G_HELL, G_NOHELL, G_UNIQ, G_SGROUP, G_LGROUP,
    G_GENOD, G_EXTINCT, G_NOCORPSE,
    M2_MALE, M2_FEMALE, M2_NEUTER, M2_HOSTILE, M2_PEACEFUL, M2_MINION,
    M2_GREEDY, M2_DOMESTIC, M2_STRONG,
    M3_WAITFORU, M3_CLOSE, M3_COVETOUS,
} = MFLAGS;
const G_GONE = G_GENOD | G_EXTINCT;

const { S_GOLEM, S_DRAGON, S_MIMIC, S_SPIDER, S_SNAKE, S_LIGHT, S_ELEMENTAL,
        S_EEL, S_LEPRECHAUN, S_JABBERWOCK, S_NYMPH, S_ORC, S_UNICORN, S_BAT,
        S_HUMAN, S_GIANT, S_WRAITH, S_LICH, S_MUMMY, S_QUANTMECH,
        S_DEMON, S_GNOME } = MONSYMS;
const { MS_LEADER, MS_GUARDIAN, MS_NEMESIS, MS_PRIEST } = MSOUND;
const { AT_WEAP, AD_ANY } = ATTKS;

// include/global.h:411, include/align.h:22
const ALIGNWEIGHT = 4;
const A_NEUTRAL = 0;
const AM_NONE = 0, AM_LAWFUL = 4, AM_NEUTRAL = 2, AM_CHAOTIC = 1;

// include/global.h — MAXMONNO, the default per-species birth limit.
const { MAXMONNO } = LIMITS;

// include/hack.h — mmflags, makemon()'s behaviour switches. Re-exported so
// callers name them instead of writing bit literals.
export const {
    NO_MM_FLAGS, NO_MINVENT, MM_NOWAIT, MM_NOCOUNTBIRTH, MM_IGNOREWATER,
    MM_ADJACENTOK, MM_ANGRY, MM_NONAME, MM_EGD, MM_EPRI, MM_ESHK, MM_EMIN,
    MM_EDOG, MM_ASLEEP, MM_NOGRP, MM_NOTAIL, MM_MALE, MM_FEMALE, MM_NOMSG,
    MM_MINVIS,
} = MMFLAGS;

// include/mondata.h predicates, one line each as in C.
const is_golem = (ptr) => ptr.mlet === S_GOLEM;
const is_male = (ptr) => (ptr.mflags2 & M2_MALE) !== 0;
const is_female = (ptr) => (ptr.mflags2 & M2_FEMALE) !== 0;
const is_neuter = (ptr) => (ptr.mflags2 & M2_NEUTER) !== 0;
const always_hostile = (ptr) => (ptr.mflags2 & M2_HOSTILE) !== 0;
const always_peaceful = (ptr) => (ptr.mflags2 & M2_PEACEFUL) !== 0;
const is_minion = (ptr) => (ptr.mflags2 & M2_MINION) !== 0;
const likes_gold = (ptr) => (ptr.mflags2 & M2_GREEDY) !== 0;
const is_domestic = (ptr) => (ptr.mflags2 & M2_DOMESTIC) !== 0;
const race_hostile = (ptr) => (ptr.mflags2 & (game.urace?.hatemask ?? 0)) !== 0;
const race_peaceful = (ptr) => (ptr.mflags2 & (game.urace?.lovemask ?? 0)) !== 0;
const likes_gems = (ptr) => (ptr.mflags2 & MFLAGS.M2_JEWELS) !== 0;
const is_unicorn = (ptr) => ptr.mlet === S_UNICORN && likes_gems(ptr);
const is_demon = (ptr) => (ptr.mflags2 & MFLAGS.M2_DEMON) !== 0;
const is_ndemon = (ptr) =>
    is_demon(ptr) && (ptr.mflags2 & (MFLAGS.M2_LORD | MFLAGS.M2_PRINCE)) === 0;
const is_shapeshifter = (ptr) => (ptr.mflags2 & MFLAGS.M2_SHAPESHIFTER) !== 0;
const verysmall = (ptr) => ptr.msize < 1;        /* MZ_SMALL */
const nohands = (ptr) => (ptr.mflags1 & MFLAGS.M1_NOHANDS) !== 0;
const is_animal = (ptr) => (ptr.mflags1 & MFLAGS.M1_ANIMAL) !== 0;
const mindless = (ptr) => (ptr.mflags1 & MFLAGS.M1_MINDLESS) !== 0;
const { STRAT_WAITFORU, STRAT_CLOSE, STRAT_APPEARMSG } = STRAT;
const { M3_WAITMASK } = MFLAGS;
const is_rider = (ptr) => ptr.pmidx === PMNAMES.PM_DEATH
                       || ptr.pmidx === PMNAMES.PM_FAMINE
                       || ptr.pmidx === PMNAMES.PM_PESTILENCE;
// src/mondata.c attacktype_fordmg() — is_armed(ptr) is attacktype(ptr, AT_WEAP)
const attacktype = (ptr, atyp) =>
    ptr.mattk.some(a => a[0] === atyp);
const is_armed = (ptr) => attacktype(ptr, AT_WEAP);

// include/monst.h:259-265
const monmax_difficulty = (levdif) => Math.trunc((levdif + (game.u?.ulevel ?? 0)) / 2);
const monmin_difficulty = (levdif) => Math.trunc(levdif / 6);
const montoostrong = (mndx, lev) => game.mons[mndx].difficulty > lev;
const montooweak = (mndx, lev) => game.mons[mndx].difficulty < lev;

// src/dungeon.c level_difficulty() — the ordinary-dungeon case.
export function level_difficulty() {
    return depth(game.u.uz);
}

function Inhell() {
    return game.dungeons?.[game.u?.uz?.dnum]?.flags?.hellish === true;
}

// src/makemon.c:1593 uncommon()
function uncommon(mndx) {
    const m = game.mons[mndx];
    if (m.geno & (G_NOGEN | G_UNIQ))
        return true;
    if ((game.mvitals?.[mndx]?.mvflags ?? 0) & G_GONE)
        return true;
    if (Inhell())
        return m.maligntyp > A_NEUTRAL;
    else
        return (m.geno & G_HELL) !== 0;
}

// src/makemon.c:1611 align_shift()
function align_shift(ptr) {
    /* the C caches Is_special() per move; with no special levels reached the
       dungeon's own alignment is what applies */
    const dgnAlign = game.dungeons?.[game.u?.uz?.dnum]?.flags?.align ?? AM_NONE;
    let alshift;

    switch (dgnAlign) {
    default:
    case AM_NONE:
        alshift = 0;
        break;
    case AM_LAWFUL:
        alshift = Math.trunc((ptr.maligntyp + 20) / (2 * ALIGNWEIGHT));
        break;
    case AM_NEUTRAL:
        alshift = Math.trunc((20 - Math.abs(ptr.maligntyp)) / ALIGNWEIGHT);
        break;
    case AM_CHAOTIC:
        alshift = Math.trunc((-(ptr.maligntyp - 20)) / (2 * ALIGNWEIGHT));
        break;
    }
    return alshift;
}

// src/makemon.c:1640 temperature_shift()
function temperature_shift(ptr) {
    /* level.flags.temperature is 0 on ordinary levels, so this contributes
       nothing there; the branch is kept so hot/cold levels behave as C does
       once pm_resistance lands. */
    if (!game.level?.flags?.temperature)
        return 0;
    return 0;
}

// src/makemon.c:1659 rndmonst_adj()
//
// Weighted reservoir sampling: each eligible monster with weight > 0 adds to
// totalweight and then draws rn2(totalweight). Monsters filtered out draw
// nothing, which is why the filters decide the call count.
export function rndmonst_adj(minadj, maxadj) {
    let ptr;
    let weight, totalweight, selected_mndx, zlevel, minmlev, maxmlev;

    zlevel = level_difficulty();
    minmlev = monmin_difficulty(zlevel) + minadj;
    maxmlev = monmax_difficulty(zlevel) + maxadj;
    const upper = false;      /* Is_rogue_level */
    const elemlevel = false;  /* In_endgame && !Is_astralevel */

    totalweight = 0;
    selected_mndx = NON_PM;

    for (let mndx = LOW_PM; mndx < SPECIAL_PM; ++mndx) {
        ptr = game.mons[mndx];

        if (montooweak(mndx, minmlev) || montoostrong(mndx, maxmlev))
            continue;
        if (upper)      /* !isupper(monsym(ptr)) */
            continue;
        if (elemlevel)  /* wrong_elem_type(ptr) */
            continue;
        if (uncommon(mndx))
            continue;
        if (Inhell() && (ptr.geno & G_NOHELL))
            continue;

        weight = (ptr.geno & G_FREQ) + align_shift(ptr);
        weight += temperature_shift(ptr);
        if (weight < 0 || weight > 127)
            weight = 0;

        /* was unconditional, but if weight==0, rn2() < 0 always fails; also
           avoids rn2(0) while totalweight is still 0 */
        if (weight > 0) {
            totalweight += weight;
            if (rn2(totalweight) < weight)
                selected_mndx = mndx;
        }
    }

    if (selected_mndx === NON_PM || uncommon(selected_mndx))
        return null;
    return game.mons[selected_mndx];
}

// src/makemon.c:1651 rndmonst()
export function rndmonst() {
    return rndmonst_adj(0, 0);
}

// src/mkobj.c:395 rndmonnum_adj() — Plan A is a level-appropriate common
// monster; the fallback paths are not ported yet.
export function rndmonnum_adj(minadj, maxadj) {
    const ptr = rndmonst_adj(minadj, maxadj);
    if (ptr)
        return monsndx(ptr);
    return NON_PM;
}

// src/mkobj.c:387 rndmonnum()
export function rndmonnum() {
    return rndmonnum_adj(0, 0);
}

// src/mon.c monsndx() — index of a permonst within mons[].
export function monsndx(ptr) {
    return ptr.pmidx !== undefined && typeof ptr.pmidx === 'number'
        ? ptr.pmidx
        : game.mons.indexOf(ptr);
}

// src/allmain.c:780 — newgame() seeds every mvitals entry from the species'
// permanent G_NOCORPSE bit. mvflags and geno share the 0x0010 bit but nothing
// else, so this does not collide with G_GENOD|G_EXTINCT.
export function reset_mvitals() {
    game.mvitals = Array.from({ length: NUMMONS + 1 }, (_, i) => ({
        mvflags: (MONS_INIT[i]?.geno ?? 0) & G_NOCORPSE,
        born: 0,
        died: 0,
    }));
}

// src/makemon.c:1542 mbirth_limit()
function mbirth_limit(mndx) {
    return mndx === PMNAMES.PM_NAZGUL ? 9
         : mndx === PMNAMES.PM_ERINYS ? 3
         : MAXMONNO;
}

// src/makemon.c:959 propagate() — birth accounting. Draws nothing, but it is
// what eventually sets G_EXTINCT, and G_EXTINCT is what removes a species from
// rndmonst_adj()'s eligible set. Skipping it keeps uniques eligible forever and
// silently changes the draw count of every later rndmonst_adj().
function propagate(mndx, tally, ghostly) {
    const mv = game.mvitals[mndx];
    const lim = mbirth_limit(mndx);
    const gone = (mv.mvflags & G_GONE) !== 0;
    const result = (mv.born < lim && !gone);

    /* if it's unique, don't ever make it again */
    if ((game.mons[mndx].geno & G_UNIQ) !== 0 && mndx !== PMNAMES.PM_HIGH_CLERIC)
        mv.mvflags |= G_EXTINCT;

    if (mv.born < 255 && tally && (!ghostly || result))
        mv.born++;
    if (mv.born >= lim
        && !(game.mons[mndx].geno & G_NOGEN)
        && !(mv.mvflags & G_EXTINCT))
        mv.mvflags |= G_EXTINCT;

    return result;
}

// src/makemon.c:2016 adj_lev() — the monster's effective level.
//
// Depends on u.ulevel, which C sets to 1 inside u_init_misc() *before* mklev()
// runs. Getting that ordering wrong shifts every monster's level and therefore
// newmonhp()'s dice.
export function adj_lev(ptr) {
    let tmp, tmp2;

    if (ptr.pmidx === PMNAMES.PM_WIZARD_OF_YENDOR) {
        tmp = ptr.mlevel + game.mvitals[PMNAMES.PM_WIZARD_OF_YENDOR].died;
        if (tmp > 49)
            tmp = 49;
        return tmp;
    }

    if ((tmp = ptr.mlevel) > 49)
        return 50; /* "special" demons/devils */
    tmp2 = (level_difficulty() - tmp);
    if (tmp2 < 0)
        tmp--; /* if mlevel > u.uz decrement tmp */
    else
        tmp += Math.trunc(tmp2 / 5); /* else increment 1 per five diff */

    tmp2 = (game.u.ulevel - ptr.mlevel); /* adjust vs. the player */
    if (tmp2 > 0)
        tmp += Math.trunc(tmp2 / 4);

    tmp2 = Math.trunc((3 * ptr.mlevel) / 2); /* crude upper limit */
    if (tmp2 > 49)
        tmp2 = 49;
    return (tmp > tmp2) ? tmp2 : (tmp > 0 ? tmp : 0);
}

// src/makemon.c:2233 golemhp()
function golemhp(type) {
    const P = PMNAMES;
    switch (type) {
    case P.PM_STRAW_GOLEM:   return 20;
    case P.PM_PAPER_GOLEM:   return 20;
    case P.PM_ROPE_GOLEM:    return 30;
    case P.PM_LEATHER_GOLEM: return 40;
    case P.PM_GOLD_GOLEM:    return 60;
    case P.PM_WOOD_GOLEM:    return 50;
    case P.PM_FLESH_GOLEM:   return 40;
    case P.PM_CLAY_GOLEM:    return 70;
    case P.PM_STONE_GOLEM:   return 100;
    case P.PM_GLASS_GOLEM:   return 80;
    case P.PM_IRON_GOLEM:    return 120;
    default:                 return 0;
    }
}

function In_endgame() {
    return game.dungeons?.[game.u?.uz?.dnum]?.dname === 'The Elemental Planes';
}

function is_home_elemental(/* ptr */) {
    /* only true in the endgame planes, which no public session reaches */
    return false;
}

// src/makemon.c:1012 newmonhp() — the monster's level and hit points.
export function newmonhp(mon, mndx) {
    const ptr = game.mons[mndx];
    let basehp = 0;

    mon.m_lev = adj_lev(ptr);
    if (is_golem(ptr)) {
        mon.mhpmax = mon.mhp = golemhp(mndx);
    } else if (is_rider(ptr)) {
        basehp = 10;
        mon.mhpmax = mon.mhp = d(basehp, 8);
    } else if (ptr.mlevel > 49) {
        mon.mhpmax = mon.mhp = 2 * (ptr.mlevel - 6);
        mon.m_lev = Math.trunc(mon.mhp / 4);
    } else if (ptr.mlet === S_DRAGON && mndx >= PMNAMES.PM_GRAY_DRAGON) {
        basehp = mon.m_lev;
        mon.mhpmax = mon.mhp = In_endgame() ? (8 * basehp)
                             : (4 * basehp + d(basehp, 4));
    } else if (!mon.m_lev) {
        basehp = 1;
        mon.mhpmax = mon.mhp = rnd(4);
    } else {
        basehp = mon.m_lev;
        mon.mhpmax = mon.mhp = d(basehp, 8);
        if (is_home_elemental(ptr))
            mon.mhpmax = (mon.mhp *= 3);
    }

    /* if d(X,8) rolled a 1 all X times, give a boost */
    if (mon.mhpmax === basehp) {
        mon.mhpmax += 1;
        mon.mhp = mon.mhpmax;
    }
}

// src/makemon.c:1573 peace_minded()
//
// Most monsters return before drawing anything; the two rn2() calls at the end
// only fire for co-aligned non-minions, which is why a level's worth of
// monsters usually shows no peace_minded entries in the log at all.
export function peace_minded(ptr) {
    const mal = ptr.maligntyp, ual = game.u.ualign.type;

    if (always_peaceful(ptr))
        return true;
    if (always_hostile(ptr))
        return false;
    if (ptr.msound === MS_LEADER || ptr.msound === MS_GUARDIAN)
        return true;
    if (ptr.msound === MS_NEMESIS)
        return false;
    if (ptr.pmidx === PMNAMES.PM_ERINYS)
        return !game.u.ualign.abuse;

    if (race_peaceful(ptr))
        return true;
    if (race_hostile(ptr))
        return false;

    /* hostile if its alignment differs from the player's */
    if (sgn(mal) !== sgn(ual))
        return false;

    /* negative monster hostile to player with Amulet */
    if (mal < A_NEUTRAL && game.u.uhave?.amulet)
        return false;

    /* minions are hostile to players that have strayed at all */
    if (is_minion(ptr))
        return game.u.ualign.record >= 0;

    const rec = game.u.ualign.record;
    return !!rn2(16 + (rec < -15 ? -15 : rec)) && !!rn2(2 + Math.abs(mal));
}

// src/makemon.c:900 mongets() — create otyp and hand it to the monster.
// The blessing/curse fixups below need object subsystems that are not ported;
// none of them draw, so the RNG stream is unaffected by their absence.
export function mongets(mtmp, otyp) {
    if (!otyp)
        return null;
    const otmp = mksobj(otyp, true, false);
    if (otmp)
        mpickobj(mtmp, otmp);
    return otmp;
}

// src/mon.c mpickobj() — returns true when otmp was freed by merging.
function mpickobj(mtmp, otmp) {
    if (!mtmp.minvent) mtmp.minvent = [];
    mtmp.minvent.push(otmp);
    return false;
}

// src/makemon.c:589 m_initinv() — species-specific starting inventory.
//
// PORTED: the generic tail (the three draws every monster makes) and the
// branches that need nothing beyond mksobj(). The mlet switch's remaining arms
// are noted where they belong; each is reached only by a species that cannot
// yet be generated, and reaching one is recorded rather than approximated.
function m_initinv(mtmp) {
    const ptr = mtmp.data;

    switch (ptr.mlet) {
    case S_NYMPH:
        if (!rn2(2))
            mongets(mtmp, ONAMES.MIRROR);
        if (!rn2(2))
            mongets(mtmp, ONAMES.POT_OBJECT_DETECTION);
        break;
    case S_MUMMY:
        if (rn2(7))
            mongets(mtmp, ONAMES.MUMMY_WRAPPING);
        break;
    case S_LEPRECHAUN:
        mkmonmoney(mtmp, d(level_difficulty(), 30));
        break;
    case S_HUMAN:
    case S_GIANT:
    case S_WRAITH:
    case S_LICH:
    case S_QUANTMECH:
    case S_DEMON:
    case S_GNOME:
        /* src/makemon.c:601-711 — mercenaries, shopkeepers, priests, giants,
           Nazgul, liches, Schroedinger's box, devils, and mine candles. Each
           arm needs a subsystem that is not ported (mkmonmoney variants,
           curse(), rnd_class(), containers). None can be generated yet. */
        note_unported(`m_initinv mlet=${ptr.mlet}`);
        break;
    default:
        break;
    }

    /* ordinary soldiers rarely have access to magic (or gold :-) */
    if (ptr.pmidx === PMNAMES.PM_SOLDIER && rn2(13))
        return;

    /* src/makemon.c:826-831 — the generic tail. These two draws happen for
       every monster regardless of species, and are the only RNG most
       level-generated monsters spend here. */
    if (mtmp.m_lev > rn2(50))
        mongets(mtmp, rnd_defensive_item(mtmp));
    if (mtmp.m_lev > rn2(100))
        mongets(mtmp, rnd_misc_item(mtmp));
    if (likes_gold(ptr) && !findgold(mtmp.minvent) && !rn2(5))
        mkmonmoney(mtmp, d(level_difficulty(), mtmp.minvent?.length ? 5 : 10));
}

// src/muse.c rnd_defensive_item() / rnd_misc_item() — both return 0 for
// monsters that cannot use items, and 0 makes mongets() a no-op that draws
// nothing. Everything above that gate is unported; note_unported() records a
// reach so it shows up in tooling instead of quietly skewing the stream.
function rnd_defensive_item(mtmp) {
    if (!is_mplayer_or_user(mtmp))
        return 0;
    note_unported('rnd_defensive_item');
    return 0;
}

function rnd_misc_item(mtmp) {
    if (!is_mplayer_or_user(mtmp))
        return 0;
    note_unported('rnd_misc_item');
    return 0;
}

/* src/muse.c gates both item pickers behind these tests; a monster failing
   them returns 0 without drawing. */
function is_mplayer_or_user(mtmp) {
    const ptr = mtmp.data;
    return !(ptr.mflags1 & (MFLAGS.M1_ANIMAL | MFLAGS.M1_MINDLESS))
        && ptr.mlet !== S_GNOME
        && (ptr.mflags2 & M2_STRONG) !== 0;
}

function findgold(minvent) {
    return (minvent || []).some(o => o.oclass === OCLASSES.COIN_CLASS);
}

// src/mon.c mkmonmoney()
function mkmonmoney(mtmp, amount) {
    mtmp.mgold = (mtmp.mgold || 0) + amount;
}

// Reached-but-unported sites, surfaced by tooling rather than papered over
// with an invented draw. See docs/plan/STATUS.md.
function note_unported(what) {
    (game.unported ||= new Set()).add(what);
}

// src/mon.c m_at() / MON_AT(). C keeps svl.level.monsters[x][y] for the
// positional lookup and the fmon chain for iteration; js/game.js already owns
// `level.monsters` as the chain, so the grid lives alongside it as `monAt`.
function m_at(x, y) {
    return game.level?.monAt?.get(`${x},${y}`) ?? null;
}

// src/mon.c place_monster()
function place_monster(mtmp, x, y) {
    mtmp.mx = x;
    mtmp.my = y;
    (game.level.monAt ||= new Map()).set(`${x},${y}`, mtmp);
    (game.level.monsters ||= []).push(mtmp);
}

// src/teleport.c goodpos() — can this monster stand here?
//
// The only draw is the S_EEL rn2(13). Everything else is terrain and occupancy,
// so a wrong answer costs a whole extra rndmonst() block (9 draws) rather than
// a single call — which is exactly how a mis-ported goodpos announces itself.
function goodpos(x, y, ptr, gpflags = 0) {
    const ignorewater = (gpflags & MM_IGNOREWATER) !== 0;

    if (!isok(x, y))
        return false;

    if (game.u.ux === x && game.u.uy === y)
        return false;
    if (m_at(x, y))
        return false;

    const loc = game.level?.at(x, y);
    if (!loc)
        return false;

    if (ptr) {
        if (loc.typ === POOL && !ignorewater) {
            return is_swimmer(ptr);
        } else if (ptr.mlet === S_EEL && rn2(13) && !ignorewater) {
            return false;
        } else if (loc.typ === LAVAPOOL) {
            return false;
        }
        if (passes_walls(ptr) && may_passwall(x, y))
            return true;
    }
    if (!ACCESSIBLE(loc.typ))
        return false;
    /* src/teleport.c also rejects boulder squares for non-rock-throwers;
       sobj_at() is not ported, so that rejection cannot be evaluated yet. */
    return true;
}

const is_swimmer = (ptr) => (ptr.mflags1 & MFLAGS.M1_SWIM) !== 0;
const passes_walls = (ptr) => (ptr.mflags1 & MFLAGS.M1_WALLWALK) !== 0;
const may_passwall = () => false;   /* needs level.flags.noteleport wall data */

// src/quest.c quest_info() — the quest leader/nemesis for the hero's role.
// Both are G_NOGEN, so neither can appear from rndmonst(); the lookups exist so
// the gender branches read as C does.
const quest_info_leader = () => pmIndexOf(game.urole?.ldrnum);
const quest_info_nemesis = () => pmIndexOf(game.urole?.neminum);
function pmIndexOf(name) {
    if (typeof name === 'number') return name;
    return (name && PMNAMES[name] !== undefined) ? PMNAMES[name] : NON_PM;
}

// src/align.c set_malign() — recomputes malign from peacefulness. No draw.
function set_malign(mtmp) {
    const mal = mtmp.data.maligntyp;
    const coaligned = (sgn(mal) === sgn(game.u.ualign.type));

    if (mtmp.data.msound === MS_LEADER) {
        mtmp.malign = -20;
    } else if (mal === A_NONE_VALUE) {
        mtmp.malign = mtmp.mpeaceful ? 0 : 20;
    } else if (coaligned) {
        const absmal = Math.abs(mal);
        mtmp.malign = mtmp.mpeaceful ? -3 * Math.max(5 - absmal, 1)
                                     : Math.max(5 - absmal, 1);
    } else {
        const absmal = Math.abs(mal);
        mtmp.malign = mtmp.mpeaceful ? 0 : Math.max(20 - absmal, 6);
    }
}
const A_NONE_VALUE = -128;   /* include/align.h A_NONE */

// src/mkobj.c mkobj_at() — used by the S_SPIDER/S_SNAKE arm of makemon().
function mkobj_at(oclass, x, y, artif) {
    const otmp = mkobj(oclass, artif);
    otmp.ox = x; otmp.oy = y;
    (game.level.objects ||= []).push(otmp);
    return otmp;
}

// src/mon.c hideunder() — positional only during mklev (seeit is 0), no draw.
function hideunder(mtmp) {
    mtmp.mundetected = 0;
}

// The remaining makemon() callees all draw, and none can be reached by a
// monster that rndmonst() can currently produce. Each records itself rather
// than inventing a draw, so `game.unported` names the exact next thing to port.
function set_mimic_sym(mtmp) { note_unported('set_mimic_sym'); }
function m_initweap(mtmp) { note_unported(`m_initweap mlet=${mtmp.data.mlet}`); }
function m_initsgrp(mtmp) { note_unported('m_initsgrp'); }
function m_initlgrp(mtmp) { note_unported('m_initlgrp'); }
function can_saddle(mtmp) { return mtmp.data.msize >= 2; /* MZ_MEDIUM */ }

// src/worn.c m_dowear() — walks the monster's inventory looking for armor to
// put on. A monster with nothing to wear draws nothing, which is the case for
// every monster level generation currently produces.
function m_dowear(mtmp, creation) {
    const ptr = mtmp.data;
    if (verysmall(ptr) || nohands(ptr) || is_animal(ptr))
        return;
    if (mindless(ptr)
        && (!creation || (ptr.mlet !== S_MUMMY
                          && ptr.pmidx !== PMNAMES.PM_SKELETON)))
        return;
    if (!mtmp.minvent || mtmp.minvent.length === 0)
        return;   /* nothing to wear, nothing to draw */
    note_unported('m_dowear with inventory');
}

// src/makemon.c:1180 makemon()
//
// The RNG order for the common level-generation case — makemon(NULL, x, y,
// MM_NOGRP) from fill_ordinary_room — is exactly:
//   rndmonst()  ->  next_ident()  ->  newmonhp()  ->  [rn2(2) gender]
//   ->  [peace_minded]  ->  m_initinv()  ->  rn2(100) saddle
// Verified against seed8000 calls 1428-1441.
export function makemon(ptr, x, y, mmflags) {
    let mndx, mitem;
    const anymon = !ptr;
    const allow_minvent = ((mmflags & NO_MINVENT) === 0);
    const countbirth = ((mmflags & MM_NOCOUNTBIRTH) === 0);

    if (game.iflags?.debug_mongen || (!game.level?.flags?.rndmongen && !ptr))
        return null;

    if (!isok(x, y))
        return null;

    if (ptr) {
        mndx = monsndx(ptr);
        if (game.mvitals[mndx].mvflags & G_GENOD)
            return null;
    } else {
        /* make a random (common) monster that can survive here */
        let tryct = 0;
        do {
            if (!(ptr = rndmonst()))
                return null;
        } while (++tryct <= 50 && !goodpos(x, y, ptr));
        mndx = monsndx(ptr);
    }
    propagate(mndx, countbirth, false);

    const mtmp = {
        mx: 0, my: 0, m_lev: 0, mhp: 0, mhpmax: 0,
        female: 0, msleeping: 0, mpeaceful: 0, mtame: 0,
        minvent: null, mgold: 0, data: ptr, mnum: mndx,
        cham: NON_PM, mstrategy: 0,
    };
    if (mmflags & MM_ASLEEP)
        mtmp.msleeping = 1;
    mtmp.m_id = next_ident();

    /* set up level and hit points */
    newmonhp(mtmp, mndx);

    const femaleok = (!is_male(ptr) && !is_neuter(ptr));
    const maleok = (!is_female(ptr) && !is_neuter(ptr));
    if (is_female(ptr) || ((mmflags & MM_FEMALE) !== 0 && femaleok))
        mtmp.female = 1;
    else if (is_male(ptr) || ((mmflags & MM_MALE) !== 0 && maleok))
        mtmp.female = 0;
    else if (ptr.msound === MS_LEADER && quest_info_leader() === mndx)
        mtmp.female = game.quest_ldrgend;
    else if (ptr.msound === MS_NEMESIS && quest_info_nemesis() === mndx)
        mtmp.female = game.quest_nemgend;
    else
        mtmp.female = femaleok ? rn2(2) : 0;

    place_monster(mtmp, x, y);
    mtmp.mcansee = mtmp.mcanmove = true;
    mtmp.mgenmklev = game.in_mklev;
    mtmp.mpeaceful = (mmflags & MM_ANGRY) ? false : peace_minded(ptr);

    switch (ptr.mlet) {
    case S_MIMIC:
        set_mimic_sym(mtmp);
        break;
    case S_SPIDER:
    case S_SNAKE:
        if (game.in_mklev) {
            if (x && y)
                mkobj_at(RANDOM_CLASS, x, y, true);
            hideunder(mtmp);
        }
        break;
    case S_LIGHT:
    case S_ELEMENTAL:
        if (mndx === PMNAMES.PM_STALKER || mndx === PMNAMES.PM_BLACK_LIGHT) {
            mtmp.perminvis = true;
            mtmp.minvis = true;
        }
        break;
    case S_EEL:
        if (game.in_mklev)
            hideunder(mtmp);
        break;
    case S_LEPRECHAUN:
        mtmp.msleeping = 1;
        break;
    case S_JABBERWOCK:
    case S_NYMPH:
        if (rn2(5) && !game.u.uhave?.amulet)
            mtmp.msleeping = 1;
        break;
    case S_ORC:
        if (game.urace?.mnum === 'PM_ELF')
            mtmp.mpeaceful = false;
        break;
    case S_UNICORN:
        if (is_unicorn(ptr) && sgn(game.u.ualign.type) === sgn(ptr.maligntyp))
            mtmp.mpeaceful = true;
        break;
    case S_BAT:
        /* Inhell only; mon_adjust_speed draws nothing */
        break;
    default:
        break;
    }

    mitem = 0; /* STRANGE_OBJECT */
    if (mndx === PMNAMES.PM_VLAD_THE_IMPALER)
        mitem = ONAMES.CANDELABRUM_OF_INVOCATION;
    else if (mndx === PMNAMES.PM_CROESUS)
        mitem = ONAMES.TWO_HANDED_SWORD;
    else if (ptr.msound === MS_NEMESIS)
        mitem = ONAMES.BELL_OF_OPENING;
    else if (mndx === PMNAMES.PM_PESTILENCE)
        mitem = ONAMES.POT_SICKNESS;

    /* pm_to_cham()/newcham() and the Wizard-of-Yendor branch sit here in C;
       every species that reaches them is G_NOGEN or G_UNIQ and so cannot be
       produced by rndmonst() during ordinary level generation. */
    if (is_shapeshifter(ptr) || mndx === PMNAMES.PM_WIZARD_OF_YENDOR)
        note_unported(`makemon shapechanger/wizard mndx=${mndx}`);

    if (mitem && allow_minvent)
        mongets(mtmp, mitem);

    if (game.in_mklev) {
        if ((is_ndemon(ptr) || mndx === PMNAMES.PM_WUMPUS
             || mndx === PMNAMES.PM_LONG_WORM || mndx === PMNAMES.PM_GIANT_EEL)
            && !game.u.uhave?.amulet && rn2(5))
            mtmp.msleeping = true;
    }

    set_malign(mtmp);

    if (anymon && !(mmflags & MM_NOGRP)) {
        if ((ptr.geno & G_SGROUP) && rn2(2)) {
            m_initsgrp(mtmp, mtmp.mx, mtmp.my, mmflags);
        } else if (ptr.geno & G_LGROUP) {
            if (rn2(3))
                m_initlgrp(mtmp, mtmp.mx, mtmp.my, mmflags);
            else
                m_initsgrp(mtmp, mtmp.mx, mtmp.my, mmflags);
        }
    }

    if (allow_minvent) {
        if (is_armed(ptr))
            m_initweap(mtmp);
        m_initinv(mtmp);
        m_dowear(mtmp, true);

        if (!rn2(100) && is_domestic(ptr) && can_saddle(mtmp))
            note_unported('put_saddle_on_mon');
    }

    if (ptr.mflags3 && !(mmflags & MM_NOWAIT)) {
        if (ptr.mflags3 & M3_WAITFORU)
            mtmp.mstrategy |= STRAT_WAITFORU;
        if (ptr.mflags3 & M3_CLOSE)
            mtmp.mstrategy |= STRAT_CLOSE;
        if (ptr.mflags3 & (M3_WAITMASK | M3_COVETOUS))
            mtmp.mstrategy |= STRAT_APPEARMSG;
    }

    return mtmp;
}
