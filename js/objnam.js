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
import { is_ammo, is_missile } from './wield.js';
import { is_weptool, is_rustprone, is_corrodeable, is_flammable,
         is_crackable, is_rottable } from './mkobj.js';
import { bimanual } from './obj.js';
import { W_ARMOR, W_QUIVER, W_WEP, plur, P_BOW, W_SWAPWEP } from './const.js';
import { mons, PMNAMES } from './monst_data.js';
import { observe_object } from './o_init.js';
const mons_PM_SAMURAI = PMNAMES.PM_SAMURAI;
import { OCLASSES, ONAMES, MATERIALS, obj_descr } from './objects_data.js';

const {
    COIN_CLASS, POTION_CLASS, SCROLL_CLASS, WAND_CLASS, SPBOOK_CLASS,
    RING_CLASS, AMULET_CLASS, ARMOR_CLASS, GEM_CLASS, WEAPON_CLASS,
    TOOL_CLASS, FOOD_CLASS, VENOM_CLASS, CHAIN_CLASS, ROCK_CLASS,
} = OCLASSES;

// include/objclass.h:190-191
/* The generated obj_descr table stores 0 (a NUMBER) for absent strings, and
   `?? null` passes 0 through — which made "has a description" tests true for
   every descriptionless item the moment one entered the discoveries list. */
export const OBJ_NAME = (ocl) => obj_descr[ocl.oc_name_idx]?.oc_name || null;
export const OBJ_DESCR = (ocl) => obj_descr[ocl.oc_descr_idx]?.oc_descr || null;

// include/objclass.h:38-44 — armour category, stored in oc_subtyp.
export const ARM_SUIT = 0, ARM_SHIELD = 1, ARM_HELM = 2, ARM_GLOVES = 3,
             ARM_BOOTS = 4, ARM_CLOAK = 5, ARM_SHIRT = 6;

// src/objnam.c:98 GemStone() — gems whose identified name takes " stone".
// The old form tested oc_material === 8 with a MINERAL comment; 8 is WOOD
// (MINERAL is 21), and C's macro keys on GEMSTONE anyway, minus the seven
// jewels whose names stand alone.
const GemStone = (typ) =>
    typ === ONAMES.FLINT
    || (game.objects[typ].oc_material === MATERIALS.GEMSTONE
        && typ !== ONAMES.DILITHIUM_CRYSTAL && typ !== ONAMES.RUBY
        && typ !== ONAMES.DIAMOND && typ !== ONAMES.SAPPHIRE
        && typ !== ONAMES.BLACK_OPAL && typ !== ONAMES.EMERALD
        && typ !== ONAMES.OPAL);

// src/objnam.c:220 obj_typename()
export function obj_typename(otyp) {
    const ocl = game.objects[otyp];
    let actualn = OBJ_NAME(ocl) ?? 'object?';
    let dn = OBJ_DESCR(ocl);
    /* src/objnam.c:211 — the Samurai substitution applies here too */
    if (game.urole?.mnum === 'PM_SAMURAI'
        || game.urole?.mnum === PMNAMES.PM_SAMURAI) {
        actualn = Japanese_item_name(otyp, actualn);
        if (otyp === ONAMES.WOODEN_HARP || otyp === ONAMES.MAGIC_HARP)
            dn = 'koto';
    }
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

// ---------------------------------------------------------------------------
// xname / doname
// ---------------------------------------------------------------------------

// src/objnam.c:437 just_an() — "", "a " or "an ".
//
// Chosen from the string that FOLLOWS it, which is why doname_base() sets
// prefix to "a " early and then recomputes it at the end once "uncursed ",
// "+0 " and friends have been prepended: "a uncursed" would be wrong but
// "an uncursed" is right, and only the final string knows.
const VOWELS = 'aeiou';
export function just_an(str) {
    if (!str) return '';
    const c0 = str[0].toLowerCase();
    if (!str[1] || str[1] === ' ')
        return 'aefhilmnosx'.includes(c0) ? 'an ' : 'a ';
    if (/^the /i.test(str) || /^molten lava$/i.test(str)
        || /^iron bars$/i.test(str) || /^ice$/i.test(str))
        return '';
    const exception = /^one/i.test(str) && (!str[3] || '-_ '.includes(str[3]));
    if ((VOWELS.includes(c0) && !exception
         && !/^eu/i.test(str) && !/^uke/i.test(str) && !/^ukulele/i.test(str)
         && !/^unicorn/i.test(str) && !/^uranium/i.test(str)
         && !/^useful/i.test(str))
        || (c0 === 'x' && !VOWELS.includes((str[1] || '').toLowerCase())))
        return 'an ';
    return 'a ';
}

// src/objnam.c an() / An() — just_an() picks the article, the name follows.
export function an(str) { return just_an(str) + str; }
export function An(str) {
    const t = an(str);
    return t.charAt(0).toUpperCase() + t.slice(1);
}

// src/objnam.c makeplural() — only the regular rules plus the "X of Y" case,
// which is the one that matters for object names: "scroll of magic mapping"
// pluralises the HEAD noun, giving "scrolls of magic mapping", not
// "scroll of magic mappings".
/* src/objnam.c:2689 as_is[] — words whose plural is spelled the same.
   Only the tail word is tested, matching singplur_lookup's endstring. */
const as_is = [
    'boots', 'shoes', 'gloves', 'lenses', 'scales',
    'eyes', 'gauntlets', 'iron bars',
    'bison', 'deer', 'elk', 'fish', 'fowl',
    'tuna', 'yaki', '-hai', 'krill', 'manes',
    'moose', 'ninja', 'sheep', 'ronin', 'roshi',
    'shito', 'tengu', 'ki-rin', 'Nazgul', 'gunyoki',
    'piranha', 'samurai', 'shuriken', 'haggis', 'Bordeaux',
];

export function makeplural(s) {
    const of = s.indexOf(' of ');
    if (of > 0)
        return makeplural(s.slice(0, of)) + s.slice(of);

    /* src/objnam.c:2911 singplur_lookup + :2916 — "ya" (alone or as the
       last word) stays "ya"; the as_is[] words are already plural-shaped */
    const low = s.toLowerCase();
    for (const w of as_is)
        if (low.endsWith(w.toLowerCase()))
            return s;
    if (low === 'ya' || low.endsWith(' ya'))
        return s;

    const sp = s.lastIndexOf(' ');
    const head = sp >= 0 ? s.slice(0, sp + 1) : '';
    let w = sp >= 0 ? s.slice(sp + 1) : s;

    if (/(s|x|z|ch|sh)$/i.test(w)) w += 'es';
    else if (/[^aeiou]y$/i.test(w)) w = w.slice(0, -1) + 'ies';
    else if (/(f)$/i.test(w)) w = w.slice(0, -1) + 'ves';
    else w += 's';
    return head + w;
}

/* src/objnam.c:105 Japanese_items[] — a Samurai sees these names. */
const Japanese_items = {
    SHORT_SWORD: 'wakizashi', BROADSWORD: 'ninja-to', FLAIL: 'nunchaku',
    GLAIVE: 'naginata', LOCK_PICK: 'osaku', WOODEN_HARP: 'koto',
    MAGIC_HARP: 'magic koto', KNIFE: 'shito', PLATE_MAIL: 'tanko',
    HELMET: 'kabuto', LEATHER_GLOVES: 'yugake', FOOD_RATION: 'gunyoki',
    POT_BOOZE: 'sake',
};

// src/objnam.c:5422 Japanese_item_name()
export function Japanese_item_name(otyp, ordinaryname) {
    for (const [key, jname] of Object.entries(Japanese_items))
        if (ONAMES[key] === otyp)
            return jname;
    return ordinaryname;
}

// src/objnam.c:820 xname() — the object's name without quantity or BUC.
export function xname(obj) {
    const ocl = game.objects[obj.otyp];
    const nn = ocl.oc_name_known;
    let actualn = OBJ_NAME(ocl) ?? 'object?';
    let dn = OBJ_DESCR(ocl) ?? actualn;
    /* src/objnam.c:605 — a Samurai reads these items in Japanese */
    if (game.urole?.mnum === 'PM_SAMURAI'
        || game.urole?.mnum === mons_PM_SAMURAI) {
        actualn = Japanese_item_name(obj.otyp, actualn);
        if (obj.otyp === ONAMES.WOODEN_HARP || obj.otyp === ONAMES.MAGIC_HARP)
            dn = 'koto';
    }
    const un = ocl.oc_uname || null;
    const pluralize = obj.quan !== 1;
    const dknown = obj.dknown;
    let buf = '';

    switch (obj.oclass) {
    case COIN_CLASS:
    case CHAIN_CLASS:
        buf = actualn;
        break;
    case WEAPON_CLASS:
        if (obj.opoisoned) buf = 'poisoned ';
        /* FALLTHRU */
    case VENOM_CLASS:
    case TOOL_CLASS:
        buf += !dknown ? dn : nn ? actualn : un ? `${dn} called ${un}` : dn;
        break;
    case ARMOR_CLASS:
        if (ocl.oc_subtyp === ARM_BOOTS || ocl.oc_subtyp === ARM_GLOVES)
            buf = 'pair of ';
        buf += nn ? actualn : un ? `${dn} called ${un}` : dn;
        break;
    case POTION_CLASS:
        /* NOT obj_typename(): xname() omits the parenthesised appearance once
           the type is known, so it is "potion of extra healing", not
           "potion of extra healing (murky)". */
        if (obj.odiluted && dknown) buf = 'diluted ';
        buf += 'potion';
        if (dknown) {
            if (nn) buf += ` of ${actualn}`;
            else if (un) buf += ` called ${un}`;
            else buf = `${dn} potion`;
        }
        break;
    case SCROLL_CLASS:
        buf = 'scroll';
        if (dknown) {
            if (nn) buf += ` of ${actualn}`;
            else if (un) buf += ` called ${un}`;
            else if (ocl.oc_magic) buf += ` labeled ${dn}`;
            else buf = `${dn} scroll`;
        }
        break;
    case FOOD_CLASS:
        buf = actualn;
        /* src/objnam.c tin_details(): a tin names its contents once known */
        if (obj.otyp === ONAMES.TIN && obj.known)
            buf += tin_details(obj);
        break;
    case AMULET_CLASS:
        if (!dknown)
            buf = 'amulet';
        else if (obj.otyp === ONAMES.AMULET_OF_YENDOR
                 || obj.otyp === ONAMES.FAKE_AMULET_OF_YENDOR)
            /* each must be identified individually */
            buf = obj.known ? actualn : dn;
        else if (nn)
            buf = actualn;
        else if (un)
            buf = `amulet called ${un}`;
        else
            buf = `${dn} amulet`;
        break;
    case WAND_CLASS:
        if (!dknown)
            buf = 'wand';
        else if (nn)
            buf = `wand of ${actualn}`;
        else if (un)
            buf = `wand called ${un}`;
        else
            buf = `${dn} wand`;
        break;
    case SPBOOK_CLASS:
        if (obj.otyp === ONAMES.SPE_NOVEL) { /* 3.6 tribute */
            if (!dknown)
                buf = 'book';
            else if (nn)
                buf = actualn;
            else if (un)
                buf = `novel called ${un}`;
            else
                buf = `${dn} book`;
        } else if (!dknown) {
            buf = 'spellbook';
        } else if (nn) {
            buf = (obj.otyp !== ONAMES.SPE_BOOK_OF_THE_DEAD
                   ? 'spellbook of ' : '') + actualn;
        } else if (un) {
            buf = `spellbook called ${un}`;
        } else
            buf = `${dn} spellbook`;
        break;
    case RING_CLASS:
        if (!dknown)
            buf = 'ring';
        else if (nn)
            buf = `ring of ${actualn}`;
        else if (un)
            buf = `ring called ${un}`;
        else
            buf = `${dn} ring`;
        break;
    case GEM_CLASS: {
        const rock = (ocl.oc_material === MATERIALS.MINERAL) ? 'stone' : 'gem';

        if (!dknown) {
            buf = rock;
        } else if (!nn) {
            if (un)
                buf = `${rock} called ${un}`;
            else
                buf = `${dn} ${rock}`;
        } else {
            buf = actualn;
            if (GemStone(obj.otyp))
                buf += ' stone';
        }
        break;
    } /* gem */
    case ROCK_CLASS:
    default:
        buf = obj_typename(obj.otyp);
        break;
    }

    return pluralize ? makeplural(buf) : buf;
}

// src/eat.c tin_details() — " of <monster>" or " of spinach".
// src/objnam.c singular() — name one item of a stack.
// The CORPSE arm redirects xname to cxname for the monster type; corpses on
// this tree go through the same xname, so the redirect has nothing to change.
export function singular(otmp, func) {
    const savequan = otmp.quan;
    otmp.quan = 1;
    const nam = func(otmp);
    otmp.quan = savequan;
    return nam;
}

function tin_details(obj) {
    if (obj.spe === 1) return ' of spinach';
    if (obj.corpsenm !== undefined && obj.corpsenm >= 0) {
        const m = game.mons[obj.corpsenm];
        const nm = m && (m.pmnames[2] ?? m.pmnames[0] ?? m.pmnames[1]);
        if (nm) return ` of ${nm}`;
    }
    return '';
}

// src/objnam.c:1063 doname_base()
//
// Builds a prefix (quantity or article, BUC, enchantment) and appends the
// worn/wielded suffixes. The BUC rule is the subtle one: with
// flags.implicit_uncursed on, "uncursed " is omitted for an item whose charge
// or enchantment is KNOWN and which is oc_charged — unless it is armour or a
// ring. That is why a +2 dart and an expensive camera show no BUC while a
// credit card and a food ration do.
export function doname(obj) {
    const ocl = game.objects[obj.otyp];
    const known = obj.known, bknown = obj.bknown, dknown = obj.dknown;
    let bp = xname(obj);
    let prefix = '';

    if (obj.quan !== 1)
        prefix = `${obj.quan} `;
    else if (obj.otyp === ONAMES.CORPSE)
        ;                              /* no article */
    else
        prefix = 'a ';                 /* recomputed at the end */

    if (bknown && obj.oclass !== COIN_CLASS) {
        if (obj.cursed) prefix += 'cursed ';
        else if (obj.blessed) prefix += 'blessed ';
        else if (!game.flags.implicit_uncursed
                 || ((!known || !ocl.oc_charged
                      || obj.oclass === ARMOR_CLASS
                      || obj.oclass === RING_CLASS)))
            prefix += 'uncursed ';
    }

    /* src/objnam.c:1183 add_erosion_words — erodeproofing shows once rknown.
       The eroded (rusty/burnt) words precede this in C; no session carries
       an eroded item yet. */
    if (obj.rknown && obj.oerodeproof)
        prefix += is_rustprone(obj, game.objects) ? 'rustproof '
                  : is_corrodeable(obj, game.objects) ? 'corrodeproof '
                    : is_flammable(obj, game.objects) ? 'fireproof '
                      : is_crackable(obj, game.objects) ? 'tempered '
                        : is_rottable(obj, game.objects) ? 'rotproof '
                          : '';

    switch (obj.oclass) {
    case ARMOR_CLASS:
        if (obj.owornmask & W_ARMOR) bp += ' (being worn)';
        /* FALLTHRU */
    case WEAPON_CLASS:
        if (known) prefix += `${obj.spe >= 0 ? '+' : ''}${obj.spe} `;
        break;
    case TOOL_CLASS:
        /* charged tools show "(0:n)" once the count is known */
        if (ocl.oc_charged && known)
            bp += ` (${obj.recharged || 0}:${obj.spe})`;
        break;
    case WAND_CLASS:
        /* src/objnam.c:1483 — a wand always shows its charges once known;
           unlike tools there is no oc_charged gate. */
        if (known)
            bp += ` (${obj.recharged || 0}:${obj.spe})`;
        break;
    default:
        break;
    }

    /* src/objnam.c:1560-1646 — the wield/swap/quiver suffixes. twoweap and
       the tether/Sting-glow/artifact-light decorations need state this tree
       does not track; u.twoweap stays falsy throughout. body_part(HAND) is
       "hand" for every un-polymorphed form and polyself is not ported. */
    if (obj.owornmask & W_WEP) {
        /* use alternate phrasing for non-weapons and for wielded ammo
           (arrows, bolts), or missiles (darts, shuriken, boomerangs) */
        if (obj.quan !== 1
            || ((obj.oclass === OCLASSES.WEAPON_CLASS)
                ? (is_ammo(obj) || is_missile(obj))
                : !is_weptool(obj, game.objects))) {
            bp += ' (wielded)';
        } else {
            const hand_s = bimanual(obj) ? 'hands'
                : `${((game.u.uhandedness ?? 0) === 0) ? 'right' : 'left'} hand`; /* URIGHTY; RIGHT_HANDED == 0 */
            bp += ` (weapon in ${hand_s})`;
        }
    }
    if (obj.owornmask & W_SWAPWEP) {
        bp += ` (alternate weapon${plur(obj.quan)}; not wielded)`;
    }
    if (obj.owornmask & W_QUIVER) {
        let Qtyp;
        switch (obj.oclass) {
        case OCLASSES.WEAPON_CLASS:
            Qtyp = !is_ammo(obj) ? 3 /* not ammo: "at the ready" */
                   : (game.objects[obj.otyp].oc_skill !== -P_BOW) ? 2 /* non-bow */
                     : 1; /* ammo for a bow: "in quiver" */
            break;
        case OCLASSES.RING_CLASS:
        case OCLASSES.AMULET_CLASS:
        case OCLASSES.WAND_CLASS:
        case OCLASSES.COIN_CLASS:
        case OCLASSES.GEM_CLASS:
            Qtyp = 2; /* small, non-bow: "in quiver pouch" */
            break;
        default: /* odd things */
            Qtyp = 3; /* "at the ready" */
            break;
        }
        bp += ` (${(Qtyp === 1) ? 'in quiver'
                 : (Qtyp === 2) ? 'in quiver pouch'
                   : 'at the ready'})`;
    }

    /* src/objnam.c:1527 — recompute the article now that the prefix is
       complete, so "a uncursed" becomes "an uncursed". */
    if (prefix.startsWith('a ')) {
        const rest = prefix.slice(2);
        prefix = just_an(rest || bp) + rest;
    }
    return prefix + bp;
}

// include/prop.h
