// shknam.js — shop types, shopkeeper names, and shop stocking.
// C ref: src/shknam.c
//
// shtypes[] lived in js/mkroom.js while mkshop() was its only consumer. It
// belongs here, next to get_shop_item(), which is the other half of the table:
// mkshop reads .prob to pick the SHOP, get_shop_item reads .iprobs to pick each
// ITEM in it.

import { rnd } from './rng.js';
import { OCLASSES, ONAMES } from './objects_data.js';

// src/shknam.c:19 VEGETARIAN_CLASS — not a real object class, a marker the
// health food store uses to route through mkveggy_at().
export const VEGETARIAN_CLASS = OCLASSES.MAXOCLASSES + 1;

/* A negative itype is a specific object type rather than a class; C writes
   them as -POT_BOOZE and tests `atype < 0` before negating. */
const T = (name) => -ONAMES[name];

// src/shknam.c:209 shtypes[]
//
// `prob` picks the shop and `iprobs` picks each item; BOTH sum to 100 per
// entry, which is what makes the two rnd(100) walks terminate without a bound
// check. The shopkeeper name lists and the shdist field are not carried yet.
export const shtypes = [
    { name: 'general store', symb: OCLASSES.RANDOM_CLASS, prob: 42,
      iprobs: [[100, OCLASSES.RANDOM_CLASS]] },
    { name: 'used armor dealership', symb: OCLASSES.ARMOR_CLASS, prob: 14,
      iprobs: [[90, OCLASSES.ARMOR_CLASS], [10, OCLASSES.WEAPON_CLASS]] },
    { name: 'second-hand bookstore', symb: OCLASSES.SCROLL_CLASS, prob: 10,
      iprobs: [[90, OCLASSES.SCROLL_CLASS], [10, OCLASSES.SPBOOK_CLASS]] },
    { name: 'liquor emporium', symb: OCLASSES.POTION_CLASS, prob: 10,
      iprobs: [[100, OCLASSES.POTION_CLASS]] },
    { name: 'antique weapons outlet', symb: OCLASSES.WEAPON_CLASS, prob: 5,
      iprobs: [[90, OCLASSES.WEAPON_CLASS], [10, OCLASSES.ARMOR_CLASS]] },
    { name: 'delicatessen', symb: OCLASSES.FOOD_CLASS, prob: 5,
      iprobs: [[83, OCLASSES.FOOD_CLASS], [5, T('POT_FRUIT_JUICE')],
               [4, T('POT_BOOZE')], [5, T('POT_WATER')], [3, T('ICE_BOX')]] },
    { name: 'jewelers', symb: OCLASSES.RING_CLASS, prob: 3,
      iprobs: [[85, OCLASSES.RING_CLASS], [10, OCLASSES.GEM_CLASS],
               [5, OCLASSES.AMULET_CLASS]] },
    { name: 'quality apparel and accessories', symb: OCLASSES.WAND_CLASS, prob: 3,
      iprobs: [[90, OCLASSES.WAND_CLASS], [5, T('LEATHER_GLOVES')],
               [5, T('ELVEN_CLOAK')]] },
    { name: 'hardware store', symb: OCLASSES.TOOL_CLASS, prob: 3,
      iprobs: [[100, OCLASSES.TOOL_CLASS]] },
    { name: 'rare books', symb: OCLASSES.SPBOOK_CLASS, prob: 3,
      iprobs: [[90, OCLASSES.SPBOOK_CLASS], [10, OCLASSES.SCROLL_CLASS]] },
    { name: 'health food store', symb: OCLASSES.FOOD_CLASS, prob: 2,
      iprobs: [[70, VEGETARIAN_CLASS], [20, T('POT_FRUIT_JUICE')],
               [4, T('POT_HEALING')], [3, T('POT_FULL_HEALING')],
               [2, T('SCR_FOOD_DETECTION')], [1, T('LUMP_OF_ROYAL_JELLY')]] },
    { name: 'lighting store', symb: OCLASSES.TOOL_CLASS, prob: 0,
      iprobs: [[30, T('WAX_CANDLE')], [44, T('TALLOW_CANDLE')],
               [5, T('BRASS_LANTERN')], [9, T('OIL_LAMP')],
               [3, T('MAGIC_LAMP')], [5, T('POT_OIL')],
               [2, T('WAN_LIGHT')], [1, T('SCR_LIGHT')], [1, T('SPE_LIGHT')]] },
];

// src/shknam.c:465 get_shop_item() — pick one item type for a shop square.
//
// Same walk shape as mkshop's shop-type pick: rnd(100), then subtract each
// probability in table order until the running total goes non-positive.
export function get_shop_item(type) {
    const shp = shtypes[type];
    let i, j;

    /* select an appropriate object type at random */
    for (j = rnd(100), i = 0; (j -= shp.iprobs[i][0]) > 0; i++)
        continue;

    return shp.iprobs[i][1];
}
