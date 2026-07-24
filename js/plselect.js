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
import { COPYRIGHT_BANNER } from './banner_data.js';
import {
    tty_curs_base, tty_putstr_base, tty_putch_base, tty_base_cursor,
    tty_base_pos,
} from './tty/wintty.js';

const ROLE_GENDERS = 2, ROLE_ALIGNS = 3;

// win/tty/wintty.c:545 tty_init_nhwindows() — the startup banner.
//
//   tty_curs(BASE_WINDOW, 1, 4);
//   for (i = 1; i <= 4; ++i) tty_putstr(BASE_WINDOW, 0, banner_line(i));
//   tty_putstr(BASE_WINDOW, 0, "");
//   ... tty_curs(BASE_WINDOW, 1, 11);
//
// Skipped when the rc turns splash_screen off, which is why seed8000 has no
// banner and the chargen sessions do.
export function tty_init_nhwindows() {
    if (game.flags.splash_screen === false) return;
    tty_curs_base(1, 4);
    for (const line of COPYRIGHT_BANNER)
        tty_putstr_base(line);
    tty_putstr_base('');
    tty_curs_base(1, 11);
}

// win/tty/wintty.c:651 tty_askname()
//
//   tty_putstr(BASE_WINDOW, 0, "");
//   tty_putstr(BASE_WINDOW, 0, "Who are you? ");
//   tty_curs(BASE_WINDOW, sizeof who_are_you, cury - 1);
//
// `sizeof who_are_you` is 14 (13 characters plus the NUL), and tty_curs is
// 1-based, so the cursor starts at column 13 on row 12. That is exactly what
// the recordings show for the first captured frame.
const WHO_ARE_YOU = 'Who are you? ';

async function tty_askname() {
    tty_putstr_base('');
    tty_putstr_base(WHO_ARE_YOU);
    tty_curs_base(WHO_ARE_YOU.length + 1, tty_base_pos().y - 1);

    let name = '';
    for (;;) {
        tty_base_cursor();
        const c = String.fromCharCode(await nhgetch());
        if (c === '\n' || c === '\r') break;
        if (c === '\x1b') { name = ''; break; }
        if (c === '\b' || c === '\x7f') {
            if (name.length) {
                name = name.slice(0, -1);
                tty_curs_base(WHO_ARE_YOU.length + 1 + name.length,
                              tty_base_pos().y);
                tty_putch_base(' ');
                tty_curs_base(WHO_ARE_YOU.length + 1 + name.length,
                              tty_base_pos().y);
            }
            continue;
        }
        name += c;
        tty_putch_base(c);
    }
    tty_base_cursor();
    return name;
}

// src/role.c:2805 plsel_startmenu() — every menu opening re-runs the rigid
// checks first. This is the only thing in character selection that draws.
function plsel_startmenu() {
    rigid_role_checks();
}

// src/role.c:1729 role_menu_extra() — every selection menu also carries these
// entries, which JUMP to another category rather than choosing anything:
//
//     '='  name      '?'  role      '/'  race      '\"' gender      '['  alignment
//
// seed0012 uses three of them: its keys are `n [ l " m / h m y`, which is
// "pick manually, jump to ALIGNMENT, lawful, jump to GENDER, male, jump to
// RACE, human", and only then the role menu it started on, Monk.
const RS_NAME = 0, RS_ROLE = 1, RS_RACE = 2, RS_GENDER = 3, RS_ALGNMNT = 4;
const RS_MENU_LET = { '=': RS_NAME, '?': RS_ROLE, '/': RS_RACE,
                      '"': RS_GENDER, '[': RS_ALGNMNT };

// win/tty/wintty.c select_menu(win, PICK_ONE) — returns as soon as a selector
// letter is typed. Returns {kind:'pick',i} | {kind:'jump',to} |
// {kind:'random'} | {kind:'quit'}.
async function select_one(letters, valid) {
    for (;;) {
        const c = String.fromCharCode(await nhgetch());
        if (c === '\x1b' || c === 'q') return { kind: 'quit' };
        if (c === '*') return { kind: 'random' };
        if (c in RS_MENU_LET) return { kind: 'jump', to: RS_MENU_LET[c] };
        const i = letters.indexOf(c);
        if (i >= 0 && valid(i)) return { kind: 'pick', i };
        /* anything else is ignored and the menu waits for another key */
    }
}

// src/role.c:2206 genl_player_setup()
export async function player_selection() {
    const f = game.flags;
    f.initrole ??= ROLE_NONE;
    f.initrace ??= ROLE_NONE;
    f.initgend ??= ROLE_NONE;
    f.initalign ??= ROLE_NONE;

    if (!game.plname) game.plname = await tty_askname();

    rigid_role_checks();

    let pick4u = 'n';
    if (f.initrole === ROLE_NONE || f.initrace === ROLE_NONE
        || f.initgend === ROLE_NONE || f.initalign === ROLE_NONE) {
        for (;;) {
            const c = String.fromCharCode(await nhgetch()).toLowerCase();
            if (c === '\x1b' || c === 'q') return false;
            if (c === ' ' || c === '\n' || c === '\r') { pick4u = 'y'; break; }
            if (c === '@' || c === '*') { pick4u = 'a'; break; }
            if (c === 'y' || c === 'n' || c === 'a') { pick4u = c; break; }
        }
    }

    let auto = () => (pick4u === 'y' || pick4u === 'a');

    /* One category. Returns false to abort, otherwise sets the facet and
       possibly redirects `nextpick`. */
    const doCategory = async (which) => {
        if (which === RS_ROLE) {
            if (auto()) {
                let k = pick_role(f.initrace, f.initgend, f.initalign,
                                  PICK_RANDOM);
                if (k < 0) k = randrole();
                f.initrole = k;
                return RS_RACE;
            }
            if (f.initrole >= 0) return RS_RACE;
            plsel_startmenu();
            const r = await select_one(rolemenu_letters(),
                (i) => ok_role(i, f.initrace, f.initgend, f.initalign));
            if (r.kind === 'quit') return -1;
            if (r.kind === 'jump') { clearFacet(r.to); return r.to; }
            f.initrole = (r.kind === 'random')
                ? pickOr(pick_role(f.initrace, f.initgend, f.initalign,
                                   PICK_RANDOM), randrole())
                : r.i;
            return RS_RACE;
        }
        if (which === RS_RACE) {
            const after = (f.initrole < 0) ? RS_ROLE : RS_GENDER;
            if (auto()) {
                let k = pick_race(f.initrole, f.initgend, f.initalign,
                                  PICK_RANDOM);
                f.initrace = (k < 0) ? 0 : k;
                return after;
            }
            if (f.initrace >= 0) return after;
            plsel_startmenu();
            const r = await select_one(racemenu_letters(),
                (i) => ok_race(f.initrole, i, f.initgend, f.initalign));
            if (r.kind === 'quit') return -1;
            if (r.kind === 'jump') { clearFacet(r.to); return r.to; }
            f.initrace = (r.kind === 'random')
                ? pickOr(pick_race(f.initrole, f.initgend, f.initalign,
                                   PICK_RANDOM), 0)
                : r.i;
            return after;
        }
        if (which === RS_GENDER) {
            const after = (f.initrole < 0) ? RS_ROLE
                        : (f.initrace < 0) ? RS_RACE : RS_ALGNMNT;
            if (auto()) {
                let k = pick_gend(f.initrole, f.initrace, f.initalign,
                                  PICK_RANDOM);
                f.initgend = (k < 0) ? 0 : k;
                return after;
            }
            if (f.initgend >= 0) return after;
            plsel_startmenu();
            const r = await select_one(gendmenu_letters(),
                (i) => ok_gend(f.initrole, f.initrace, i, f.initalign));
            if (r.kind === 'quit') return -1;
            if (r.kind === 'jump') { clearFacet(r.to); return r.to; }
            f.initgend = (r.kind === 'random')
                ? pickOr(pick_gend(f.initrole, f.initrace, f.initalign,
                                   PICK_RANDOM), 0)
                : r.i;
            return after;
        }
        /* RS_ALGNMNT */
        const after = (f.initrole < 0) ? RS_ROLE
                    : (f.initrace < 0) ? RS_RACE : RS_GENDER;
        if (auto()) {
            let k = pick_align(f.initrole, f.initrace, f.initgend,
                               PICK_RANDOM);
            f.initalign = (k < 0) ? 1 : k;
            return after;
        }
        if (f.initalign >= 0) return after;
        /* src/role.c:2564 — count first. The menu, and therefore
           plsel_startmenu()'s rigid_role_checks(), only happens when more than
           one alignment is valid. Calling it unconditionally makes a facet that
           C fills silently draw an extra rn2(1). */
        let n = 0, k = 0;
        for (let i = 0; i < ROLE_ALIGNS; i++)
            if (ok_align(f.initrole, f.initrace, f.initgend, i)) { n++; k = i; }
        if (n > 1) {
            plsel_startmenu();
            const r = await select_one(algnmenu_letters(),
                (i) => ok_align(f.initrole, f.initrace, f.initgend, i));
            if (r.kind === 'quit') return -1;
            if (r.kind === 'jump') { clearFacet(r.to); return r.to; }
            k = (r.kind === 'random')
                ? pickOr(pick_align(f.initrole, f.initrace, f.initgend,
                                    PICK_RANDOM), k)
                : r.i;
        }
        f.initalign = k;
        return after;
    };

    const clearFacet = (which) => {
        if (which === RS_ROLE) f.initrole = ROLE_NONE;
        else if (which === RS_RACE) f.initrace = ROLE_NONE;
        else if (which === RS_GENDER) f.initgend = ROLE_NONE;
        else if (which === RS_ALGNMNT) f.initalign = ROLE_NONE;
    };
    const pickOr = (v, fallback) => (v < 0 ? fallback : v);

    /* src/role.c:2288 `makepicks:` — the confirmation's 'n' jumps BACK HERE,
       not to the start: the name is kept and the "[ynaq]" prompt is not asked
       again, but pick4u becomes 'n' so the rest is chosen by menu. Restarting
       the whole function instead re-ran the random picks. */
    /* makepicks */
    for (;;) {
        let nextpick = RS_ROLE;
        do {
            const r = await doCategory(nextpick);
            if (r === -1) return false;
            nextpick = r;
        } while (f.initrole < 0 || f.initrace < 0
                 || f.initgend < 0 || f.initalign < 0);

        /* "Is this ok? [ynaq]" is itself a menu */
        let again = false;
        while (!again) {
            plsel_startmenu();
            const c = String.fromCharCode(await nhgetch()).toLowerCase();
            if (c === '\x1b' || c === 'q') return false;
            if (c === 'y' || c === ' ' || c === '\r' || c === '\n') return true;
            if (c === 'a') {
                /* src/role.c:2686 "choose another name": the four facets are
                   saved, plname cleared, askname() run, then restored, and the
                   confirmation menu shown again. */
                const save = [f.initrole, f.initrace, f.initgend, f.initalign];
                game.plname = await tty_askname();
                [f.initrole, f.initrace, f.initgend, f.initalign] = save;
                continue;
            }
            if (c === 'n') {
                pick4u = 'n';
                f.initrole = f.initrace = f.initgend = f.initalign = ROLE_NONE;
                again = true;
            }
        }
    }
}
