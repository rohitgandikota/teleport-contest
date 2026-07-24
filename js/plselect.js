// plselect.js — interactive character selection.
// C ref: src/role.c genl_player_setup() (:2206) and tty_askname().
//
// Seven public sessions pin nothing in their rc and drive this with their own
// keystrokes, so until it existed they diverged at PRNG call 0.
//
// The draw is not where it looks. Choosing from a menu draws nothing; what
// draws is plsel_startmenu(), which calls rigid_role_checks() EVERY time a menu
// opens (role.c:2814). Once the role is known that fills any facet the role
// forces, and pick_align() with exactly one valid alignment still executes
// `aligns_ok = rn2(aligns_ok)` — an rn2(1).
//
// seed0077 is the clean case: "Shade\rnrhmy" is name, 'n' to pick manually,
// 'r' Rogue, 'h' human, 'm' male, 'y' confirm. A Rogue has one valid alignment
// and two valid races, so the whole pre-o_init stream is the single rn2(1)
// that fires when the RACE menu opens.

import { game } from './gstate.js';
import { nhgetch } from './input.js';
import {
    ROLE_NONE, ROLE_RANDOM, rigid_role_checks, ok_role, ok_race, ok_gend,
    ok_align, rolemenu_letters, racemenu_letters, gendmenu_letters,
    algnmenu_letters, pick_role, pick_race, pick_gend, pick_align,
    randrole, PICK_RANDOM,
} from './role.js';
import { roles, races, genders, aligns } from './role_data.js';

const ROLE_GENDERS = 2, ROLE_ALIGNS = 3;

// win/tty/wintty.c:651 tty_askname() — read the hero's name up to Enter.
async function tty_askname() {
    let name = '';
    for (;;) {
        const c = String.fromCharCode(await nhgetch());
        if (c === '\r' || c === '\n') break;
        if (c === '\x1b') break;
        if (c === '\b' || c === '\x7f') { name = name.slice(0, -1); continue; }
        name += c;
    }
    return name;
}

// src/role.c:2805 plsel_startmenu() — every menu opening re-runs the rigid
// checks first. This is the only thing in character selection that draws.
function plsel_startmenu() {
    rigid_role_checks();
}

// win/tty/wintty.c select_menu(win, PICK_ONE) — a PICK_ONE menu returns as
// soon as a selector letter is typed.
async function select_one(letters, valid) {
    for (;;) {
        const c = String.fromCharCode(await nhgetch());
        if (c === '\x1b' || c === 'q') return -1;
        const i = letters.indexOf(c);
        if (i >= 0 && valid(i)) return i;
        /* '*' is the random entry; anything else is ignored and re-read */
        if (c === '*') return ROLE_RANDOM;
    }
}

// src/role.c:2206 genl_player_setup()
export async function player_selection() {
    const f = game.flags;
    f.initrole ??= ROLE_NONE;
    f.initrace ??= ROLE_NONE;
    f.initgend ??= ROLE_NONE;
    f.initalign ??= ROLE_NONE;

    /* src/allmain.c askname() runs before selection when plname is empty */
    if (!game.plname) game.plname = await tty_askname();

    rigid_role_checks();

    let pick4u = 'n';
    if (f.initrole === ROLE_NONE || f.initrace === ROLE_NONE
        || f.initgend === ROLE_NONE || f.initalign === ROLE_NONE) {
        /* "Shall I pick a character for you? [ynaq]" */
        for (;;) {
            const c = String.fromCharCode(await nhgetch()).toLowerCase();
            if (c === '\x1b' || c === 'q') return false;
            if (c === ' ' || c === '\n' || c === '\r') { pick4u = 'y'; break; }
            if (c === '@' || c === '*') { pick4u = 'a'; break; }
            if (c === 'y' || c === 'n' || c === 'a') { pick4u = c; break; }
        }
    }

    do {
        if (f.initrole < 0) {
            if (pick4u === 'y' || pick4u === 'a') {
                /* src/role.c:2300 — the game picks: rn2(number of ok roles) */
                let k = pick_role(f.initrace, f.initgend, f.initalign,
                                  PICK_RANDOM);
                if (k < 0) k = randrole();
                f.initrole = k;
            } else {
            plsel_startmenu();
            if (f.initrole < 0) {
                const letters = rolemenu_letters();
                const k = await select_one(letters,
                    (i) => ok_role(i, f.initrace, f.initgend, f.initalign));
                if (k === -1) return false;
                f.initrole = k;
            }
            }
        }
        if (f.initrace < 0) {
            if (pick4u === 'y' || pick4u === 'a') {
                let k = pick_race(f.initrole, f.initgend, f.initalign,
                                  PICK_RANDOM);
                if (k < 0) k = randrace(f.initrole);
                f.initrace = k;
            } else {
            plsel_startmenu();
            if (f.initrace < 0) {
                const letters = racemenu_letters();
                const k = await select_one(letters,
                    (i) => ok_race(f.initrole, i, f.initgend, f.initalign));
                if (k === -1) return false;
                f.initrace = k;
            }
            }
        }
        if (f.initgend < 0) {
            if (pick4u === 'y' || pick4u === 'a') {
                let k = pick_gend(f.initrole, f.initrace, f.initalign,
                                  PICK_RANDOM);
                if (k < 0) k = randgend(f.initrole, f.initrace);
                f.initgend = k;
            } else {
            plsel_startmenu();
            if (f.initgend < 0) {
                const letters = gendmenu_letters();
                const k = await select_one(letters,
                    (i) => ok_gend(f.initrole, f.initrace, i, f.initalign));
                if (k === -1) return false;
                f.initgend = k;
            }
            }
        }
        if (f.initalign < 0) {
            if (pick4u === 'y' || pick4u === 'a') {
                let k = pick_align(f.initrole, f.initrace, f.initgend,
                                   PICK_RANDOM);
                if (k < 0) k = randalign(f.initrole, f.initrace);
                f.initalign = k;
            } else {
            plsel_startmenu();
            if (f.initalign < 0) {
                /* src/role.c:2564 — count first; a menu appears only when more
                   than one alignment is valid, and that path draws nothing */
                let n = 0, k = 0;
                for (let i = 0; i < ROLE_ALIGNS; i++)
                    if (ok_align(f.initrole, f.initrace, f.initgend, i)) {
                        n++; k = i;
                    }
                if (n > 1) {
                    const letters = algnmenu_letters();
                    const c = await select_one(letters,
                        (i) => ok_align(f.initrole, f.initrace, f.initgend, i));
                    if (c === -1) return false;
                    k = c;
                }
                f.initalign = k;
            }
            }
        }
    } while (f.initrole < 0 || f.initrace < 0
             || f.initgend < 0 || f.initalign < 0);

    /* "Is this ok? [ynaq]" — a menu, so plsel_startmenu() runs again */
    plsel_startmenu();
    for (;;) {
        const c = String.fromCharCode(await nhgetch()).toLowerCase();
        if (c === '\x1b' || c === 'q') return false;
        if (c === 'y' || c === ' ' || c === '\r' || c === '\n') break;
        if (c === 'n') {
            f.initrole = f.initrace = f.initgend = f.initalign = ROLE_NONE;
            return player_selection();
        }
    }
    return true;
}
