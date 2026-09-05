# Monster theft and interrupted equipment removal

Source review and C recording on 2026-09-05. The full-port goal remains active.

The first twelve theft probes exposed missing delayed armor removal and
accessory effects. They matched only 2,157/2,296 screens and 28,356/37,521 RNG
entries before this pass. The full `steal` body at steal.c:343-615 is now
ported, including weighted selection, adornment priority, equipment layers,
animal refusal, punishment, leash release, billing, immediate and delayed
removal, naming after visibility changes, retaliation and petrification.

The delayed path now uses C's `stealarm`, `unstolenarm` and `thiefdead`.
Both monster death and disappearance reset the pending thief. The callback
checks the object and monster identities, distance and remaining theft attack
before transferring armor. The shared `unresponsive` helper lives in its
C module and is also used by demon seduction. The full C bodies of these
helpers and `worn_item_removal` were read. Removal calls the existing slot
handlers so levitation, blindness, ring bonuses and punishment update before
the transfer message.

Two further probe families exposed shared errors. `yname` used `xname`,
which omitted the species of a corpse and changed More boundaries. It now
uses `cxname`, `shk_your`, the artifact prefix rules and the C buffer bound.
Independent Oracle and Medusa corpse recordings verify the unique-name
cases. C really emits "the the Oracle's corpse" because both naming functions
supply an article; that behavior is preserved. `bare_artifactname` now reads
`artiname`, as C does, instead of a nonexistent record field and an `xname`
fallback. Source controls initialize valid artifact existence and await
inventory acquisition. An earlier malformed manual artifact state is not
credited as a gameplay crash reproduction.

Interrupted disrobing exposed an anonymous callback in `armoroff` and missing
named-handler comparisons in `doffing`. The full `armoroff` body now sets
C's specific callback, formats the bounded completion message, dispatches
immediate removal and clears the takeoff context. Four existing off handlers
now read their global equipment slot so the callbacks need no argument.
Their full per-item bodies remain subject to later review. `stop_donning`
preserves C's ordering: `cancel_don` zeroes `multi` before the code reads the
remaining delay. The stolen-item result is therefore zero. The C disrobing
fixture confirms that the nymph restarts the normal removal delay.

Four permanent recipes contain thirty C intent-validated cases:

| Recipe | Cases | Behavior |
|---|---:|---|
| theft-armor | 8 | Delayed and cursed mail, female seduction, immediate robe and shirt, levitation loss, interrupted dressing and disrobing |
| theft-equipment | 4 | Blindfold revealing the thief, strength ring, adornment priority and cursed quiver release |
| theft-animals | 11 | Curse stickiness, welded weapon, loadstone, three corpse names, heavy armor, immediate robe and both patience outcomes |
| theft-special | 7 | Empty and gold-only packs, floor chain and carried ball, boulder retry and two petrifying thefts |

These cases match all 5,996 screens/cursors, 78,267 RNG entries and six
animations. The assertions require actual theft, refusal or removal messages
and preserve their exact cells and final inventory. Patience cases require
the C draw at steal.c:521. Initial probes with sleeping nymphs are retained
only in the ignored cache and do not count as theft coverage.

`tools/theft-state-gate.mjs` checks all thirty replays for inventory ownership,
unworn transfer, curse restoration, delayed identities, retaliation, lost-item
flags, equipment bonuses, levitation, blindness, punishment cleanup and corpse
containment in a statue. Separate source controls cover successful and
cancelled delayed transfers, death and disappearance hooks, a changed monster
form, distance, missing identities or objects, preservation of another
callback, all seven armor slots, unresponsive states and artifact prefixes.
These controls earn no native C coverage.

The isolated `skip-avenge.mjs` loader clears only the theft retaliation bit.
With `NODE_OPTIONS` carrying the loader into the scoring worker, all four
visible replays still pass every screen, cursor, RNG and animation. The state
gate rejects the mutation. This is a concrete reason to check persistent state
in addition to terminal parity. Neither runtime files nor oracle data are
changed by this negative control.

Final broad regression passes all 44 public and 460 supplemental fixtures,
504 total. Supplemental matches 162,519 screens/cursors, 7,795,536 RNG
entries and 21,326 animations. Public remains 11,405 screens/cursors,
792,838 RNG entries and 1,462/1,483 animations. The final fuzz replay retains the
known fixed-date mismatch: 101/102 fixtures, 14,261/14,262 screens, all 14,262
cursors and 491,759 RNG entries, and 75/76 animations. All 48 hang checks,
80 role controls, 16 tool tests, source audit, the new state gate and six
related state gates pass. The assertion ledger is 1,820/1,820.
Logs are in `.cache/theft/`.

All four final native recordings are exact in
`.cache/c-coverage/theft-final-20260905`. Combined with the earlier 28-case
collection in `theft-20260905`, this pass adds 160 direct C outcomes and four
entered function records. The measured union is 53,945/108,268 outcomes and
4,314/5,491 records. The additional unique-corpse recordings add no new
outcomes to that union. `steal` reaches 153/216, `stealarm` 10/20,
`worn_item_removal` 16/20, `remove_worn_item` 37/44, `armoroff` 28/38,
`doffing` 43/56 and `stop_donning` 14/16. `thiefdead` and `unstolenarm` still
have no native C call. These measurements describe the compiled C branch
census, not whole-game completion or proof of all JavaScript state.

The next source work is `mpickobj`: its bill removal, null and punishment
guards, shared inventory insertion and engulfed-light handling are still
missing. `snuff_light_source` remains a marker and `obj_is_burning` lacks
C's ignitable-or-artifact condition. Theft's uncovered layering, leash,
unresponsive, billing and delayed-cancellation branches still need direct
C scenarios. The complete-game goal remains active after this checkpoint.
