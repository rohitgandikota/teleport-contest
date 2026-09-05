# Compiled C constant audit

The September 5 audit compares integer exports from `js/const.js` with the
configured, pinned recorder headers. It found 45 different values and one signed
representation difference among 1,661 comparable names. This is independent of
gameplay inputs, so even unused definitions can be checked against C.

`tools/c-constant-audit.mjs` compiles the actual C expressions. It records C
values and sizes, rejects unavailable or nonconstant names with compiler reasons,
and distinguishes matching 32-bit patterns from different values. Compiler or
header failures abort the audit. Tests exercise enum aliases, an intentionally
wrong JS value, unsigned 64-bit values, signed masks, unavailable names, runtime
expressions and a broken header. No rejected name earns comparison credit.

The corrected shared definitions now have **1,666 comparable names and zero
different values**. Five previously omitted enum entries were added. Another
267 numeric exports remain outside this header comparison; they may be private
C enums, platform-specific values, or port-only definitions. Their rejection
reasons are retained for review. Noninteger exports and function-like macros are
outside this audit. It is not a completeness score for all C headers.

| Definitions | C source | Review |
|---|---|---|
| Version, edit level and release status | `patchlevel.h` | Align dormant shared metadata with the pinned 5.0 release. |
| Underline and blink | `wintype.h:132` | Correct shared values; active tty code already had correct local values. |
| `EXACT_NAME` | `hack.h:1021` | Suppress saddle and monster disguise; given-name suppression is a separate flag. |
| Status fields and condition count | `botl.h:43` | Add weapon, armor and terrain fields before version; restore the count of 30 conditions. |
| BUC filters | `hack.h:1262` | Use independent bits instead of ordinal categories; pickup already had correct local values. |
| Dig-check results | `hack.h:327` | Preserve C's numeric order and stairs/failed alias; callers use symbolic cases and bounds. |
| Explosion sources and scatter masks | `objclass.h:154`, `hack.h:1339` | Sources follow object classes; reserve scatter bit zero for visual effects. |
| Relocation flags | `hack.h:1390` | Separate error permission, messages and forced message suppression. |
| Early command-line arguments | `hack.h:433` | Include show-paths and dump-enums before glyph and monster dumps. |
| Save formats and window colors | `hack.h:975`, `flag.h:210` | Restore enum counts of three and four. |
| `NH_C` | `tradstdc.h:359` | Match the recorder's C99-or-later, pre-C23 compilation. |

`NOGARLIC` intentionally stays signed in JS. C stores `0x80000000` in a long;
JS bit operators produce a signed int32. All three current consumers in `mon.js`
use bit operations, so the bit pattern is preserved. The report lists this
representation difference explicitly. Such patterns still require caller review.

Many value changes preserve current behavior because producers and consumers
use the same symbols, or a correct local copy bypasses the shared declaration.
They are not 45 proven gameplay failures. The `constant-consumer-state-gate.mjs`
does demonstrate one effect: a real saddled pony from the mounted-jousting C
fixture has an ordinary name containing `saddled`, while `EXACT_NAME` omits that
adjective. The old mask included it. Other branches of `x_monnam` remain partial.

The current verification retains 44/44 public and 421/421 supplemental passes,
with 11,405 and 119,635 exact screens and 792,838 and 6,031,413 exact RNG entries.
Fuzz remains 101/102 with its known fixed-datetime artifact. All 44 public hang
checks, 80 role-smoke games, source audit and the collision/inventory/name state
gates pass. This audit adds no C gameplay branch-coverage credit.

```bash
node tools/c-constant-audit.mjs
node --test tools/c-constant-audit.test.mjs
node tools/constant-consumer-state-gate.mjs
```

Full reports are under `.cache/c-constants/`, with the final run in
`header-final-20260905`. The source review next returns to monster naming:
`x_monnam` still omits name suppression, disguise handling and several exact-name
rules, and the monster/type/floor/discovery branches of `docallcmd` are still
marked unported. Review those bodies and generate C inputs before editing them.
