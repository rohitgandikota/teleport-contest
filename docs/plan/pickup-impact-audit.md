# Pickup origin, floor impact and saddle water audit

Automatic pickup now checks shop ownership and object origin before the class
filter. C rejects chargeable shop stock even when it was thrown, admits owned
no-charge objects, applies thrown/stolen overrides, and excludes dropped or
exploding objects according to its flags. `autopick` preserves C's two passes
and computes the shop cost once per pile. Picking up a thrown dagger now readies
it through C's `throwing_weapon` predicate in inventory handling.

The downward-throw path previously omitted non-potion floor impacts. `hitfloor`
now lives in dothrow.js, its C module, and calls the existing `hero_breaks` for
every object. It preserves soft-ground handling, altar feedback and beatitude
knowledge, the wand of striking verb, and exposed pit-edge messages. do.js
re-exports it for existing callers. An obsolete potion-only helper is removed.

Mounted throws exposed a second missing path. C can hit the steed, its saddle,
or the floor. `potionhit` now preserves the saddle selection's exact random
draws and short-circuit order, including luck-dependent water checks. Saddle
hits draw the shard check but do not damage the steed or run its potion effect.
They still reach the common vapor path. `H2Opotion_dip` changes the saddle's
blessing or curse and records knowledge according to visibility, hallucination
and whether the potion was known. The helper is ported in full; its carried-item
and shop-water callers still need the next source pass.

## Independent C recordings

| Recipe | Cases | Exact screens/cursors | Exact RNG entries |
|---|---:|---:|---:|
| `autopickup-origin` | 8 | 182 | 24,342 |
| `autopickup-shop-stock` | 4 | 223 | 21,407 |
| `floor-throw-impact` | 14 | 542 | 44,318 |
| `mounted-potion-impact` | 15 | 2,127 | 40,439 |
| `saddle-water-state` | 8 | 1,391 | 21,361 |
| Total | 49 | 4,465 | 151,867 |

All 48 new animation frames match. Every case has independent C intent
assertions. Pickup controls compare the final inventory, including automatic
quiver selection. Shop controls explicitly refuse a sale before walking back
over owned goods. Floor controls cover mirrors, eggs, melons, cameras, the Bell
of Opening, glass armor, soft ground, all altar beatitudes and both pit types.
Mounted controls cover direct and conditional saddle selection, ordinary head
hits, zero shard damage, floor misses, four beatitude transitions, saturated
states, blindness and known versus unknown water.

`tools/pickup-impact-state-gate.mjs` checks all 26 pickup/floor cases against
C's inventory and breakage outcomes. It also checks ownership, origin, quiver
identity, actual bill entries, no-charge flags and mirror luck. Separate
source controls test stolen/exploding origins and the precedence of shop cost.
Those controls do not earn native gameplay coverage.

`tools/saddle-impact-state-gate.mjs` checks all 23 mounted cases and 22 shard
damage boundaries. It pins saddle ownership, equipment masks, target health,
beatitude, stored knowledge and the resulting ability to dismount. C's RNG
and source conditions determine the invisible effects. A loader that removes
the unknown-water knowledge reset still passes the blind holy-water case's
164 screens/cursors and 2,851 RNG entries, but the state gate fails on the
incorrect retained knowledge. This negative control changes no runtime file.

## Native coverage and regression

All five native recordings are exact in
`.cache/c-coverage/pickup-impact-20260905`. They add 119 direct outcomes and
enter two previously unentered records: H2Opotion_dip and release_camera_demon.
The union is 53,331/108,268 direct outcomes and 4,300/5,491 entered records.
The assertion ledger is 1,613/1,613, with 99 categories covered and seven partial.

The union reaches autopick at 10/10 outcomes, autopick_testobj at 26/30,
hitfloor at 18/26, throwing_weapon at 4/6, potionhit at 144/200 and
H2Opotion_dip at 24/38. Entered outcomes measure the tested C paths, not proof
that the entire corresponding function is faithful.

The stable runtime passes 44 public and 439 supplemental fixtures. Public
screens/cursors remain 11,405/11,405, RNG 792,838/792,838 and animations
1,462/1,483. Supplemental screens/cursors are 132,474/132,474, RNG
6,771,747/6,771,747 and animations 3,296/3,296. Fuzz remains 101/102 with
the same fixed-datetime artifact: 14,261/14,262 screens, 14,262 cursors,
491,759 RNG and 75/76 animations. All 49 hang checks, 80 reused role-smoke
controls, 16 tool tests, source audit, both new state gates and six related
state gates pass. Frozen files are unchanged. Logs are in `.cache/autopickup/`.

## Remaining source paths

Autopickup exceptions, their editor and the pinned POSIX ERE backend remain
absent. Stolen and exploding origins have source controls here, not new C
gameplay recordings. Upward toss_up, interlevel ship_object migration,
potionhit's unpaid billing and startup option error presentation remain open.
This pass exercises pit edges without interlevel object migration.

The next source target is potion_dip. Its existing alchemy-only port does not
call H2Opotion_dip, so carried-item water damage, shop-water repricing and water
consumption must be reproduced and connected before those paths can be claimed.
