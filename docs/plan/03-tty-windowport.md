# M3 — The tty windowport

**Goal:** every byte that reaches the 24x80 grid goes through a faithful port of
NetHack's tty window layer, so that "what the screen looks like" is decided by
ported C code rather than by our judgement.

**Why it matters more than it looks:** the score is screens. The README says most
contestants' time goes here. Game logic can be perfect and score zero if the
message line wraps at the wrong column or a `--More--` appears one key early.

**C files in scope:** `win/tty/wintty.c`, `win/tty/topl.c`, `win/tty/getline.c`,
`win/tty/termcap.c`, plus `src/windows.c`, `src/pline.c`, `src/drawing.c`,
`src/symbols.c`, `src/glyphs.c`, `src/coloratt.c`.

**JS targets:** `js/tty/wintty.js`, `js/tty/topl.js`, `js/tty/getline.js`,
`js/tty/termcap.js`, `js/windows.js`, `js/pline.js`, `js/drawing.js`,
`js/symbols.js`, `js/glyphs.js`, `js/coloratt.js`.

`js/terminal.js` is frozen and sits *underneath* this layer: our windowport
writes into it exactly as C's writes into the patched terminal capture.

---

## Items

### 3.1 Understand the capture boundary first

Before porting anything, establish precisely when C captures a frame. `docs/API.md`
says: every time `tty_nhgetch()` blocks for a key, plus one initial frame. The
nomux patches (`006-008` in `nethack-c/patches/`) implement the capture.

- [ ] Read the three nomux patches (they are small) and write down, in this file,
      exactly where the capture hook fires
- [ ] Confirm against a real session: frame count == number of keys + 1, or
      document why it differs

**Verify:** for three sessions of different lengths, our predicted frame count
matches the recorded one.

### 3.2 termcap / escape sequence layer

- [ ] Port `win/tty/termcap.c` cursor movement, clear, and SGR emission for the
      terminal type the recorder used
- [ ] Confirm which TERM the recorder assumes (check the nomux patches and
      `nethack-c/README.md`) — this determines the exact escape vocabulary

The comparator canonicalises SGR and cursor-forward escapes, so we do not need
byte-identical escapes, only identical resulting cells. But getting the layer
right is still cheaper than fighting it later.

### 3.3 Core window management

`win/tty/wintty.c` is the big one: window creation, `tty_curs`, `tty_putstr`,
`tty_clear_nhwindow`, `tty_display_nhwindow`, `tty_print_glyph`, menu handling,
and the `--More--` machinery.

- [ ] `tty_init_nhwindows`, `tty_create_nhwindow`, `tty_destroy_nhwindow`
- [ ] `tty_curs`, `tty_putsym`, `tty_print_glyph`
- [ ] `tty_putstr` for each window type (NHW_MESSAGE, NHW_STATUS, NHW_MAP,
      NHW_MENU, NHW_TEXT)
- [ ] `tty_display_nhwindow` including the `--More--` prompt path
- [ ] Menu rendering: `tty_start_menu`, `tty_add_menu`, `tty_end_menu`,
      `tty_select_menu`, including page breaks, selector letters, and the
      count-prefix and search behaviours

Menus are heavily exercised: `seed0108-wizard-extcmd-wishlist`,
`seed0106-priest-extcmd-sweep`, `seed0107-samurai-twoweapon-enhance`,
`seed0116-wizard-wear-shop`.

### 3.4 The top line (message window)

`win/tty/topl.c`. Message truncation, `--More--` insertion, message combining,
the `msg_window` option, and history recall.

- [ ] `putsyms`, `topl_putsym`, `remember_topl`, `update_topl`, `more()`
- [ ] Line-wrap and truncation rules at column 80, exactly as C does them
- [ ] `pline` / `You` / `verbalize` families from `src/pline.c`, including
      suppression and duplicate-message rules

A wrong `--More--` boundary desynchronises the rest of the session. This is the
single highest-value item in the milestone.

### 3.5 Prompts and line input

`win/tty/getline.c`: `tty_getlin`, `tty_get_ext_cmd`, the yn/ynq prompts, and
character-count prompts.

- [ ] `tty_getlin` with editing keys and the cancel path
- [ ] `tty_get_ext_cmd` including the extended-command completion behaviour
      (`seed0106-priest-extcmd-sweep` and `seed0108-wizard-extcmd-wishlist`
      depend on this)
- [ ] `yn_function` variants from `src/cmd.c` / `src/windows.c`

`seed0102-ranger-name-cancel` exercises the cancel path during chargen.

### 3.6 Symbols, glyphs, colours

- [ ] Port `src/drawing.c` default symbol sets and `src/symbols.c` symset loading
- [ ] Port `src/glyphs.c` glyph-to-symbol mapping
- [ ] Port `src/coloratt.c` colour and attribute resolution
- [ ] DEC line-drawing handling — the comparator translates DEC glyphs to
      Unicode during decode, so we must emit the same *glyph identity*, not
      necessarily the same bytes

**Verify:** a generated level renders with the same wall, floor, door, and
corridor glyphs and colours as the recorded frame, checked with
`tools/screendiff.mjs`.

---

## Done when

- Frame boundaries match C for every public session prefix we can reach
- `--More--` appears in the same places
- Menus paginate identically
- Map cells carry the same glyph, colour, and attribute as C
- `tools/screendiff.mjs` reports zero differing cells on the frames we reach

## Notes

Do M3 concurrently with M4 if two agents are available: M3 owns `js/tty/**` and
the drawing files, M4 owns `js/mklev.js` and friends. They do not overlap. But do
not let one agent try to hold both in context at once.
