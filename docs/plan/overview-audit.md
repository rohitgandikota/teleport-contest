# Overview selection, annotation queries, and disclosure

This pass adds 57 native scenarios in four permanent recipes. All 17,497
screens and cursors and 695,889 gameplay RNG calls match. The cases contain
no animation frames. Longer traversal also exposed an omitted Lua room and
module state leaking between games. This is evidence for the tested paths,
not a claim that the complete game is ported.

## Source and changes

The complete C bodies for query_annotation, donamelevel, dooverview,
show_overview, traverse_mapseenchn, interest_mapseen, print_mapseen and
describe_level were read, with their formatting and branch helpers. The
relevant build has EDIT_GETLIN disabled. Level descriptions retain both the
output string and C return classification. The query uses an explicit level
argument instead of temporarily replacing the hero's current level. Other
status and livelog description callers have not been unified with this helper.

The menu prefix now selects a level before editing its annotation. Selectable
identifiers use ledger number plus one. The query targets that record while
leaving the hero on the current level. Current-level, same-branch and
cross-branch prompts follow C. Existing names have a 30-character preview;
empty input and escape preserve them, spaces remove them, and runs of spaces
are folded. Mapseen custom and custom_lth are authoritative. The unused
duplicate level_annotations write path was removed.

Overview filtering now includes the tutorial, unsolved Sokoban levels and
known bones. Endgame levels come first while the hero is in the endgame;
ordinary play there excludes other branches, while final disclosure includes
them. Forgotten records retain their title and suppress details. The final
marker distinguishes quitting, escaping, ascending and dying. Only actual
death adds the current hero to the death list. Bones details follow features,
annotations and connections, with punctuation based on the entries displayed.
Quest expulsion changes the connection wording to a sealed portal.

The full C done, really_done and disclose bodies were read while tracing a
missing message flush. The port now acknowledges the message window before
disclosure. An already-read prompt retains its pixels until overwritten.
This is a narrow correction within a still incomplete death lifecycle.

The full create_room and build_room bodies and the complete Twin businesses
Lua definition were read. The missing Lua case now builds a 9 by 5 parent
room and two shop subrooms. It evaluates all twelve possible door-direction
coin flips before choosing one of eight placements, then chooses shop types
and door states in the C/Lua order. The Lua die helper uses rn2, not the C rnd
wrapper. The native traversal exercises both failed placement and successful
construction. It does not establish all eight placement variants.

The complete C movebubbles and its setup and teardown bodies were read. C
starts each segment in a fresh process, but the JS bubble chain and traversal
direction survived between games. Initialization now resets these globals.
They still persist across level travel within one game. No C or frozen file
was changed.

## Native controls and their validity

The recipes are overview-annotations, overview-branches, overview-pages and
overview-disclosure. They contain 30, 14, 6 and 7 scenarios respectively.
Every recipe went through the official recorder and independent input
assertions. All four repeated exactly with the instrumented C binary.

The annotation cases cover m-prefixed extended commands and Ctrl-O, current
and remote targets, empty selection, cancellation, invalid selectors,
replacement, deletion and whitespace. The long-name cases attempt 30, 31,
80, 255, 256 and 300 characters. The tty input buffer caps stored input at
COLNO, 80. Attempting 300 characters is not evidence of storing 300 characters.

Quest and Mines controls verify the branch text in the native prompt. In
this seed, the wizard menu's Astral selection actually arrives on Astral.
The plane tour then visits Earth, Air, Fire and Water. Menu letters restart
on each page. The 24-level menu selects its last level with the second page's
letter f. Early candidates that used global letters or a space before a
single-page selection were corrected before promotion.

Quitting in wizard mode has a separate core-dump question. These cases answer
n there, then stop at the overview. Default q suppresses disclosure and would
not test it. Actual petrification cases answer y to Die and observe the
feature line before the hero's death entry. The final long-menu case advances
to the second page. All recorded input boundaries are complete.

## State checks and deliberate faults

The state gate checks 57 native replays, 50 selection boundaries and 99
annotations read from C output. It checks exact native RNG, current hero
level, HP, recursive object ownership, annotation length and prefix clearing.
The native runs remain in their original multi-game order so they can detect
the bubble leak.

There are 95 constructed groups covering missing mapseen records, query
wording and cancellation, all description flags, selection identifiers,
window cleanup, tutorial and Sokoban visibility, automatic annotations,
features, forgotten details, plane order, final markers, bones visibility,
death-list punctuation and branch wording. Constructed states earn no C
execution credit.

Thirteen of fourteen deliberate faults fail the state gate. The missing
disclosure flush survives state checks and fails native screens. Five faults
survive all four native output comparisons: wrong annotation length, retained
menu prefix, showing tutorial levels outside the tutorial, showing forgotten
details, and hiding unknown bones from wizard or final disclosure. Constructed
controls detect those five. Every fault is detected by at least one gate.
None of the native fault runs fails through a runtime exception.

The exact nine prior runtime modules from 809c4a37 fail all four fixtures,
with 4,161 screen, 3,543 cursor and 511,740 positional RNG misses. The detailed
fault totals are preserved in .cache/annotation-overview/mutation-results.json.

## Measured coverage and remaining work

The exact C union adds 44 direct outcomes and no newly entered functions.
It reaches 57,120/108,268 outcomes and 4,404/5,491 entered records. The census
excludes Lua and inactive build configurations. It is not a measure of the
fraction of gameplay implemented.

| C function | Observed direct outcomes |
|---|---:|
| describe_level | 12/12 |
| donamelevel | 2/2 |
| dooverview | 2/2 |
| show_overview | 8/8 |
| traverse_mapseenchn | 8/8 |
| query_annotation | 22/24 |
| interest_mapseen | 22/36 |
| print_mapseen | 98/148 |
| create_room | 92/102 |
| build_room | 7/8 |
| movebubbles | 52/58 |

The missing query outcomes are its absent-record guard and the final
single-space comparison after whitespace normalization. No new unreachable
claims are made. Native follow-ups remain for several interest filters,
forgotten records, Sokoban, Fort Ludios, escape and ascension markers, shop
and temple combinations, and old bones. Existing formatkiller, bones
persistence and other death behavior remain partial. Bubble punishment and
worm contents still need review. The other Lua room variants remain open.

A subsequent native probe in .cache/bones-overview now observes
Ashen-Pri-Hum-Fem-Law and the death reason after loading a bones file. The
current port's saved cemetery record contains only name and role. This
provides the next concrete source and oracle target.

Local evidence is in .cache/annotation-overview, including permanent inputs,
native recordings, exact C coverage, state and fault logs, remaining.json,
mutation-results.json and verification-exits.json. The complete faithful
C/Lua port remains the active goal.

The full regression passes 587/587 fixtures, 44 public and 543 supplemental,
with all 759,903 screens/cursors and 14,122,292 RNG calls matching. The 21
older public animation misses remain. Fuzz passes 101/102 with its existing
fixed-date screen difference and all 491,759 RNG calls matching. Eighty fresh
games across 13 roles, seventeen related state gates, 48 hang cases, fourteen
tool tests and the source audit, zero findings in 268 modules, pass. The
assertion ledger passes 3,676/3,676 declared cases, with 99 categories covered
and seven partial. No new judge score is claimed.
