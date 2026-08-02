// dbridge.js — drawbridges and the water/lava terrain tests that live with them.
// C ref: src/dbridge.c
//
// Only is_pool_or_lava() so far, which lookaround() and
// avoid_moving_on_liquid() both need. The drawbridge machinery itself is not
// ported.

import { is_pool, is_lava } from './mon.js';
import { game } from './gstate.js';
import { isok, MOAT, DRAWBRIDGE_UP, DB_UNDER, DB_MOAT, Is_juiblex_level } from './const.js';

// src/dbridge.c:77 is_pool_or_lava()
export function is_pool_or_lava(x, y) {
    return !!(is_pool(x, y) || is_lava(x, y));
}

// src/dbridge.c:100 is_moat()
export function is_moat(x, y) {
    if (!isok(x, y))
        return false;
    const ltyp = game.level.at(x, y).typ;
    if (!Is_juiblex_level(game.u.uz)
        && (ltyp === MOAT
            || (ltyp === DRAWBRIDGE_UP
                && ((game.level.at(x, y).drawbridgemask ?? 0) & DB_UNDER) === DB_MOAT)))
        return true;
    return false;
}
