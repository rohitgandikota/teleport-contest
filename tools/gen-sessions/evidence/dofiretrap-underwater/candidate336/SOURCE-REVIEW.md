# Missing dofiretrap liquid branch

Read complete upstream trap.c4233-4325 dofiretrap and fixed JS trap.js387-466.
C draws d(2,4) first, including for the liquid path. Its ternary condition
uses the box coordinates when a box exists and is not carried; otherwise it
uses Underwater. The liquid branch prints steamy bubbles using the existing
the/xname/surface source expression. Fire resistance prints uninjured. The
other branch calls losehp(rnd(3), "boiling water", KILLED_BY), then returns.
It does not reach flame feedback, a shield, fire visibility bookkeeping,
polymorph maximum reduction, burn_away_slime, inventory/floor fire or ice melt.

Read carried in C obj.h332 and JS obj.js67. Both compare object.where with
OBJ_INVENT. The left operand protects a null floor-trap box before carried
is called. Read Underwater in C youprop.h279 and JS youprop.js84: both read
the hero's uinwater state. Neither predicate draws RNG or changes state.

Read complete C dbridge.c46-60 is_pool and100-114 is_moat, plus the actual
imported JS mon.js1957-1963 is_pool and dbridge.js81-93 is_moat. Pool checks
coordinates, POOL/MOAT/WATER and the moat helper. The helper handles Juiblex
and a raised bridge over a moat. Use this existing live predicate unchanged.
Read complete C dungeon.c1750-1793 surface and JS dungeon.js1356-1400; real
Underwater on the ordinary pool returns bottom. Preserve the existing shared
source-name expression used by both messages. Predicate evaluation is pure,
so the existing earlier source-name calculation does not move any side effect
across a state-changing operation.

Read complete C hack.c4256-4294 losehp and JS hack.js916-950. The existing JS
owner is async: await it. It updates polymorph HP, shows damage and can
rehumanize; the human branch records the supplied death cause/format. Use
existing KILLED_BY, value1 per hack.h603, without an article prefix. No damage
scaling, extra random draw, direct HP mutation or guessed helper return is
introduced. Ordinary probes are healthy polymorphs, so low-HP/death paths
remain unexercised and unchanged.

The full trap dispatcher, sitting entry and actual terrain/polymorph/slime
producer review is preserved in source33. Parent C raw now confirms all six
original primary predicates. Its fixed2b baseline fails exactly the two wet
triggers; the four original negative complete native reports pass. That C
raw and all inputs stay byte-identical.

The independent blind-look correction was locked before C. Complete C/JS
look_here and dolook owners return ECMD_TIME for the actual blind empty-floor
look, ECMD_OK when sighted. Apply only the parent's two exact replacement
strings. The original two failed case4 assertions and88/102 result remain
history. Same-observation legacy accounting and same-version full-row
comparisons make that change explicit; no negative stream is excused.

Scope limit: the full source-owned ternary is ported, including an uncarried
box over a pool, but this family reaches only null-box floor traps. It does
not establish carried/chest/box coordinate coverage, nonempty item damage,
human HP-floor correctness, low-HP death or other liquid hazards. The prior
polymorph and slime repairs remain byte-identical below the new return.
