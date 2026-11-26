# Source contract before inputs

The complete dochat owner was reread at src/sounds.c:1257-1413 and fixed js/sounds.js:202-305. A statue is considered only when m_at is absent or mundetected. Blindness alone does not bypass a living rat. Both previous corrected cases contain actual PM_SEWER_RAT id 20 at (59,6), hp 2, mundetected false. Their grid-bug statue remains the object pile head. Hallucination changes the rat's displayed name; it does not turn that chat into a statue chat.

## Normal scroll and literal species

Read complete C read_ok/doread (read.c:315-649), seffects (2194-2306), seffect_genocide (1722-1738) and do_genocide (2826-3017). Read fixed JS cmd read_ok, read.js doread (311-608), seffects (1233-1325), seffect_genocide (1479-1497) and do_genocide (1683-1861). The read command uses the real getobj callback, applies the effect, consumes the scroll and returns ECMD_TIME. An uncursed, unblessed scroll with Confusion false passes how=1. Blessed class genocide and cursed creation are not this route.

Read complete name_to_mon/name_to_monplus in C mondata.c:883-1085 and JS mondata.js:869-1001, including the alternate-name tables. Literal sewer rat resolves exactly in the species table. C include/monsters.h:889-895 gives the rat G_GENO, G_SGROUP, level 0 and MS_SQEEK. It is neither the human hero's race nor Wizard role. Normal genocide sets G_GENOD|G_NOCORPSE, prints Wiped out all sewer rats., calls kill_genocided_monsters and updates inventory. The insertion precedes quaffing/wearing, so it does not require blind reading or hallucinated genocide naming.

## Complete removal owners and occupancy

Read complete C kill_genocided_monsters/kill_eggs (mon.c:5607-5682), mondead (3081-3178), m_detach (2734-2801), mon_leaving_level (2696-2728), mlifesaver/lifesaved_monster and set_mon_min_mhpmax (2808-2885), dmonsfree (2487-2509) and relobj (steal.c:875-901). Read their complete fixed JS counterparts: mon.js kill_genocided_monsters/kill_eggs (5029-5082), mondead (3668-3741), m_detach (2237-2299), mon_leaving_level (4834-4876), life-saving (5086-5135), dmonsfree (363-375) and steal.js relobj (650-672).

The normal rat is not a shapechanger, vampire, worm, guard, leader or steed. The genocide loop calls mondead. Life saving cannot rescue a genocided species. mon_leaving_level removes the actual grid entry through remove_monster; m_detach marks it for end-of-move disposal. This path calls neither mondied nor corpse_chance, so no rat corpse replaces the statue. Inventory drops remain a real possibility in the general owner, so the observer must verify the actual statue pile head after removal. It may not assume an empty monster inventory to hide a different top object.

Read C rm.h m_at/MON_AT/remove_monster and the complete fixed JS m_at/place_monster/remove_monster functions. C reads the occupancy grid directly. JS mon.m_at filters dead records as its normal runtime contract. Supplemental raw-grid observation must therefore also require no raw occupant, rather than count a stale dead grid record as a cleared square. The existing target observation remains unfiltered by species.

## Generation and level setup

Read complete C mklev (mklev.c:1577-1593), makelevel (1251-1429), clear_level_structures (850-927) and fill_ordinary_room (939-1171), with their complete fixed JS counterparts: mklev.js:715-729, 807-1040, 746-794 and 3395-3561. Level initialization clears both the monster list and grid. Ordinary room filling calls makemon with a random species. No new level, seed or room is introduced in the proposal.

Read complete C makemon (makemon.c:1147-1514), m_initinv (589-835), uncommon/align_shift/temperature_shift/rndmonst/rndmonst_adj (1593-1731), and complete corresponding JS makemon.js:2208-2572, 843-1071 and 186-306. makemon attaches a new id and mgenmklev origin flag, places the actual map entry, and rejects explicitly requested genocided species. Random selection calls uncommon, which rejects G_GONE, including G_GENOD. The rat has no species-specific inventory arm; m_initinv's general level/item conditions still apply. No claim of complete generation parity for unrelated species is made.

The previous target observations establish the real interfering rat. Its precise initial position and mgenmklev flag were not recorded there. The new locked passive batch will record the complete live roster at selected boundaries to distinguish an initial-level rat from a later birth. This supplements the removal proof; it does not select a new seed or suppress other target occupants.

## Scope and controls

The previous complete producer reads, source hashes and assertion history remain linked in corrected22 and original23. They cover wishes, inventory assignment, actual free-action/paralysis, hallucination, blindfold, statue placement, food/pet setup and the chat callers. The rolling inventory assignment puts the additional scroll at c after the dropped statue a and existing perception item b. The batch must check that inventory fact, both BUC flags, Confusion false, the genocide flag transition, removal of the previous rat id, the raw target grid, the surviving statue and the original perception predicates.

Only indices 6 and 7 may change. All nine other current tuples must retain all five output hashes. All 80 original assertion bodies and the corrected producer checks remain unchanged. All eleven cases receive observed/plain/deferred runs. New failures remain failures. Original C branch verification is still outstanding, and no runtime candidate is part of this audit.
