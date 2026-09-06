# Magical doors and message locations

Magical-door tests exposed missing permanent-deafness status, quiet eyewear
feedback, proper artifact articles and message coordinates. These paths now
follow the pinned C recorder. The new corpus also observes surviving monsters'
health and stun after door explosions. Source coverage still leaves explicit
gaps in monster obstructions and the larger message and teleport routines.

## Source review and changes

The full C doorlock, boxlock, obstructed, mb_trapped, mon_learns_traps, on_msg,
Blindf_on, Blindf_off, bot_via_windowport, vpline, coordinate wrappers,
coord_desc, dxdy_to_dist_descr, optfn_whatis_coord, handler_whatis_coord,
wake_msg, wakeup and wake_nearto_core bodies were read. Full zap_map and
create_particular parsing and creation were read for probe construction. The
relevant bhit caller slice was read, not its whole body. No C or frozen files
changed. Reading a body does not establish a complete port of its dependencies.

Status now uses the canonical Deaf predicate, which includes permanent deaf
conduct. Hearing already followed that predicate; the status line did not.
The main 84-case corpus initially matched every RNG draw but missed 8,579
screens. After the status fix, two quiet blindfold cases remained. on_msg now
uses the inventory form for worn tools when verbose is off. It evaluates
xname before obj_is_pname and chooses the proper artifact article as C does.

The four display message entry points consume a pending location even when
the message is empty or accessiblemsg is off. Norep applies the coordinate
prefix before checking the previous message. The existing coordinate formatter
is shared with these paths. The none mode uses full compass descriptions for
accessible messages. Monster wake-up and visible door-explosion messages now
provide the monster's location. The prefix also changes wrapping and cursor
positions, which the native comparisons check.

Configuration accepts C's first-character whatis_coord values and negation.
Initialization stores the mode in iflags. The full options menu now exposes
the five coordinate choices, their existing selection, explanatory bounds
and cancellation behavior. Advanced options are absent from the simple menu,
so the handler is wired only where that option can actually appear.

The larger vpline message-type, history and long-message paths remain partial.
Reading Blindf_on/off also identified remaining equipment-release, punishment
and permanent-blindness interactions. They are not claimed by this change.
The existing TRAPPED_DOOR learning behavior is reused; the broader
mon_learns_traps special values remain outside this pass.

## Native probe validity

The main matrix uses three wands, eight door states and three senses, with
quiet, probing and object controls. Obstruction setups use the observed item
letters. Wished boulders already fall to the floor. Rogue and Minetown cases
use the native destination menu. An initially blocked Minetown move is not
credited as successful movement; the wished door and subsequent approach
provide the observed target.

Only the north cases in the eight-direction monster setup hit the monster
behind a trapped door. The other 21 cases are named as ordinary door controls.
Native probing after explosions reports xorn HP24/53, black pudding HP51/60
and small mimic HP31/42, each stunned. All three survive. Constructed death
controls do not count as native death coverage.

Accessible messages are observed at the actual opening, wake-up and explosion
boundaries. Distant targets distinguish 3north from 3n, with map and screen
coordinates checked separately. Identified Eyes of the Overworld cases expose
the proper-name article; unidentified lenses alone would not test it.

Earlier follow-up recipes contained invalid trap wishes, simple-menu searches
for an advanced option and excessive Monk startup input. Those versions are
excluded from the permanent corpus. Corrected wishes use 'land mine trap' and
'bear trap trap'. Options use mO or #optionsfull. Monk eyewear cases use a
minimal startup. Native questions determine input boundaries; padding spaces
can cancel questions and are not evidence that the intended action happened.

The six permanent recipes were recorded with the official recorder. Each has
an exact instrumented C repeat. Independent integrity and branch assertions
pass. An exploratory named-level teleport also revealed a separate stub:
C accepts rogue, while JS lev_by_name still returns zero. That gap is queued
for the next source pass; it is not covered by menu-driven teleport tests.

## Evidence and remaining paths

| Recipe | Cases | Screens/cursors | RNG calls |
|---|---:|---:|---:|
| door-magic | 84 | 29,433 | 192,418 |
| door-magic-town | 8 | 2,852 | 27,905 |
| door-magic-monsters | 27 | 26,991 | 67,084 |
| message-locations | 39 | 26,798 | 93,551 |
| door-magic-obstructions | 10 | 3,681 | 22,891 |
| eyewear-feedback | 6 | 508 | 25,538 |

All 174 scenarios, 90,263 screens/cursors, 429,387 RNG calls and 3,720 animation
frames match. The state gate checks 174 native replays, 217 inventory entries,
three monster-health observations, 164 feedback observations, hero HP and
recursive object ownership. Another 72 constructed groups check all message
entry points, one-time location consumption, coordinate parsing and menus,
deafness sources, door states, obstructions, box knowledge and explosion
survival or death. Constructed states receive no C coverage credit.

The C union adds 143 direct outcomes and two entered function records over
6a324980, reaching 56,956/108,268 outcomes and 4,403/5,491 entered records.
The new records are handler_whatis_coord and probe_monster. This census
excludes Lua, macro-internal conditions and inactive build configurations.
No new unreachable claims are made.

Direct outcomes now include doorlock84/102, obstructed3/14, mb_trapped4/6,
wake_msg7/8, on_msg11/12, coord_desc12/12, dxdy_to_dist_descr9/16,
optfn_whatis_coord16/26, handler_whatis_coord13/22 and vpline42/54. Even full
coverage of coord_desc does not prove every coordinate value or interaction.
The exact unobserved line, column and outcome records are in remaining.json.

All ten deliberate regressions fail the state gate. Native comparisons give:

| Deliberate regression | Screen misses | Cursor misses | Positional RNG misses |
|---|---:|---:|---:|
| Ignore permanent deaf conduct | 8,579 | 0 | 0 |
| Skip quiet eyewear inventory feedback | 5 | 0 | 0 |
| Use an indefinite article for the artifact | 1 | 0 | 0 |
| Omit message coordinate prefixes | 79 | 20 | 0 |
| Retain a consumed message location | 1,289 | 30 | 0 |
| Ignore configured coordinate mode | 28 | 3 | 0 |
| Omit wake-up coordinates | 25 | 20 | 0 |
| Omit explosion coordinates | 25 | 5 | 0 |
| Skip monster trap knowledge | 0 | 0 | 0 |
| Skip magical-door obstructions | 34 | 0 | 33,263 |

Missing monster trap knowledge survives all six native fixtures. The
constructed control catches it, but a stronger native follow-up is still
needed. The exact nine runtime modules from 6a324980 fail three of six
fixtures, with 8,748 screen, 40 cursor and 34,973 positional RNG misses.
No mutant failed through a runtime exception.

Fifteen related state gates, 50 hang cases, 80 fresh games across 13 roles,
14 tool tests and the source audit0/268 pass. The assertion ledger is
3,516/3,516, with 99 categories covered and seven partial. Fuzz remains
101/102 with the known fixed-date screen difference; all 491,759 RNG calls
match. The final sweep passes578/578 fixtures, 44 public and534 supplemental,
matching all711,853 screens/cursors and12,981,090 RNG calls. The21 existing
public animation mismatches remain; the new animations all match.

Local evidence is in .cache/door-magic, including native-totals.json,
mutation-results.json, totals.json, verification-exits.json and remaining.json.
The ongoing full C/Lua port continues.
