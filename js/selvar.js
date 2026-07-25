// selvar.js — selections: a set of map squares, manipulated as a value.
// C ref: src/selvar.c
//
// This is the subsystem every themeroom fill is written against, and the
// themerooms are the entire remaining reached-but-unported list (28% of random
// games). `src/nhlsel.c` is only the Lua binding layer over this file.
//
// Only selection_filter_percent() draws, one rn2(100) per SET point inside the
// bounding box, x outer and y inner. Everything else here is bookkeeping, but
// the bookkeeping decides which points that loop visits and in what order, so
// it has to be exact.
//
// The map encoding is worth stating because it is off by one on purpose:
// selection_new() memsets every byte to 1 and selection_getpoint() returns
// `map[i] - 1`, so an unset point stores 1 and a set point stores 2. Storing
// 0/1 instead would still read "correctly" through getpoint but would break
// selection_setpoint()'s bounds_dirty test, which distinguishes a byte that is
// 0 from one that is not.

import { COLNO, ROWNO } from './const.js';
import { rn2 } from './rng.js';
import { isok } from './hacklib.js';

// src/selvar.c:15 selection_new()
export function selection_new() {
    return {
        wid: COLNO,
        hei: ROWNO,
        bounds_dirty: false,
        bounds: { lx: COLNO, ly: ROWNO, hx: 0, hy: 0 },
        map: new Uint8Array(COLNO * ROWNO).fill(1),
    };
}

// src/selvar.c:168 selection_getpoint()
export function selection_getpoint(x, y, sel) {
    if (!sel || !sel.map)
        return 0;
    if (x < 0 || y < 0 || x >= sel.wid || y >= sel.hei)
        return 0;

    return sel.map[sel.wid * y + x] - 1;
}

// src/selvar.c:181 selection_setpoint()
export function selection_setpoint(x, y, sel, c) {
    if (!sel || !sel.map)
        return;
    if (x < 0 || y < 0 || x >= sel.wid || y >= sel.hei)
        return;

    if (c && !sel.bounds_dirty) {
        if (sel.bounds.lx > x) sel.bounds.lx = x;
        if (sel.bounds.ly > y) sel.bounds.ly = y;
        if (sel.bounds.hx < x) sel.bounds.hx = x;
        if (sel.bounds.hy < y) sel.bounds.hy = y;

    /* only set bounds_dirty if changing a point from 1 to 0; if changing
       a point from 0 to 0, nothing has really changed with the bounds */
    } else if (sel.map[sel.wid * y + x] !== 0) {
        sel.bounds_dirty = true;
    }

    sel.map[sel.wid * y + x] = c + 1;
}

// src/selvar.c:99 selection_recalc_bounds() — four directional scans, each
// stopping at the first set point it meets.
export function selection_recalc_bounds(sel) {
    if (!sel.bounds_dirty)
        return;

    sel.bounds.lx = COLNO;
    sel.bounds.ly = ROWNO;
    sel.bounds.hx = sel.bounds.hy = 0;

    const r = { lx: -1, ly: -1, hx: -1, hy: -1 };

    /* left */
    for (let x = 0; x < sel.wid; x++) {
        for (let y = 0; y < sel.hei; y++)
            if (selection_getpoint(x, y, sel)) { r.lx = x; break; }
        if (r.lx > -1) break;
    }

    if (r.lx > -1) {
        /* right */
        for (let x = sel.wid - 1; x >= r.lx; x--) {
            for (let y = 0; y < sel.hei; y++)
                if (selection_getpoint(x, y, sel)) { r.hx = x; break; }
            if (r.hx > -1) break;
        }
        /* top */
        for (let y = 0; y < sel.hei; y++) {
            for (let x = r.lx; x <= r.hx; x++)
                if (selection_getpoint(x, y, sel)) { r.ly = y; break; }
            if (r.ly > -1) break;
        }
        /* bottom */
        for (let y = sel.hei - 1; y >= r.ly; y--) {
            for (let x = r.lx; x <= r.hx; x++)
                if (selection_getpoint(x, y, sel)) { r.hy = y; break; }
            if (r.hy > -1) break;
        }
        sel.bounds = r;
    }

    sel.bounds_dirty = false;
}

// src/selvar.c:77 selection_getbounds() — an EMPTY selection reports the whole
// map, not an empty rect, so an iterate over one walks every square.
export function selection_getbounds(sel, b) {
    if (!sel || !b)
        return;

    selection_recalc_bounds(sel);

    if (sel.bounds.lx >= sel.wid) {
        b.lx = 0;
        b.ly = 0;
        b.hx = COLNO - 1;
        b.hy = ROWNO - 1;
    } else {
        b.lx = sel.bounds.lx;
        b.ly = sel.bounds.ly;
        b.hx = sel.bounds.hx;
        b.hy = sel.bounds.hy;
    }
}

// src/selvar.c:224 selection_filter_percent() — the only function here that
// draws. One rn2(100) per SET point, x outer and y inner over the bounds.
export function selection_filter_percent(ov, percent) {
    if (!ov)
        return null;

    const ret = selection_new();
    const rect = { lx: 0, ly: 0, hx: 0, hy: 0 };

    selection_getbounds(ov, rect);

    for (let x = rect.lx; x <= rect.hx; x++)
        for (let y = rect.ly; y <= rect.hy; y++)
            if (selection_getpoint(x, y, ov) && (rn2(100) < percent))
                selection_setpoint(x, y, ret, 1);

    return ret;
}

// src/selvar.c:726 selection_iterate() — same walk order as filter_percent,
// with an extra isok() guard.
export function selection_iterate(ov, func, arg) {
    if (!ov)
        return;

    const rect = { lx: 0, ly: 0, hx: 0, hy: 0 };
    selection_getbounds(ov, rect);

    for (let x = rect.lx; x <= rect.hx; x++)
        for (let y = rect.ly; y <= rect.hy; y++)
            if (isok(x, y) && selection_getpoint(x, y, ov))
                func(x, y, arg);
}

// src/selvar.c:211 selection_not() — invert every square of the whole map.
export function selection_not(s) {
    for (let x = 0; x < s.wid; x++)
        for (let y = 0; y < s.hei; y++)
            selection_setpoint(x, y, s, selection_getpoint(x, y, s) ? 0 : 1);
    return s;
}

// src/nhlsel.c:203 l_selection_numpoints() — how many squares are set. It is
// in the binding layer rather than selvar.c, but the walk is the same shape.
export function selection_numpoints(sel) {
    let n = 0;
    const rect = { lx: 0, ly: 0, hx: 0, hy: 0 };

    selection_getbounds(sel, rect);
    for (let x = rect.lx; x <= rect.hx; x++)
        for (let y = rect.ly; y <= rect.hy; y++)
            if (selection_getpoint(x, y, sel))
                n++;
    return n;
}
