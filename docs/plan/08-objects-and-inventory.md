# M8 — Objects, inventory, and menus

**Goal:** the object model, the inventory UI, and every command that manipulates
an item.

**Why it matters:** inventory controls object identity, quantities, equipment,
timers, light sources and billing as well as the menus exercised by nearly
every session. A correct-looking inventory can conceal wrong persistent state.
The September source audit and remaining decisions are tracked in
[inventory-adjust-audit.md](inventory-adjust-audit.md).

**C files in scope:** `src/mkobj.c`, `src/objects.c` (data), `src/objnam.c`,
`src/invent.c`, `src/pickup.c`, `src/do.c` (drop), `src/do_wear.c`,
`src/wield.c`, `src/worn.c`, `src/eat.c`, `src/potion.c`, `src/read.c`,
`src/zap.c`, `src/apply.c`, `src/dothrow.c`, `src/spell.c`, `src/o_init.c`,
`src/shk.c`, `src/shknam.c`, `src/steal.c`, `src/artifact.c`.

---

## Items

### 8.1 Object data and naming

- [x] Immediate level annotation state now agrees with named teleport lookup
      and save/restore. The subsequent query and overview pass covers remote
      level selection, cancellation, replacement and branch-specific prompts.
      See [overview-audit.md](overview-audit.md) for 57 native cases, state
      checks and the remaining native coverage gaps.
- [x] September name editing pass: shared name accessors, C cancellation versus
      all-space removal, whitespace folding and the 62-character stored limit.
      Six C controls and the death-name restoration state gate pass. Artifact
      restrictions and the rest of the naming machinery remain open.
- [x] Compile shared integer constants against C and correct numeric drift,
      including the exact-name mask. A real saddled-pony state control checks
      the mask's effect. The subsequent naming review is recorded below.
- [x] Port monster naming, fixed-name refusal rules, `x_monnam`, `priestname`
      and shared alignment naming. Twenty-seven C scenarios and persistent
      name/minion/formatting controls pass. See [monster-naming-audit.md](monster-naming-audit.md)
      for the still-uncovered source decisions and type-naming backlog.
- [ ] Generate `js/objects_data.js` from `src/objects.c` with the M2 generator
- [ ] Port `src/o_init.c` — randomised appearances per game, which consumes RNG at
      game start and must match exactly (`js/o_init.js` is currently 12 lines)
- [ ] Port `src/objnam.c`: `xname`, `doname`, `aobjnam`, `makeplural`,
      `makesingular`, `an`, `The`, `Yname2`, and the whole naming machinery
- [ ] **5.0:** helm of brilliance always appears as a crystal helmet, not a
      randomised appearance. New items to include: helm of caution, amulet of
      flying, amulet of guarding, gold dragon scale mail

`objnam.c` is the highest string-output-per-line file in the codebase. Port it
carefully and completely rather than on demand; partial coverage produces
plausible-but-wrong names that are hard to spot in a diff.

### 8.2 Inventory

- [x] Complete C inventory-type entry and unpaid display, including all four
      menu styles, hidden prompt choices, uppercase shop fallbacks, recursive
      contained prices and unknown-container summaries. Ninety-one C scenarios
      and 29 constructed controls pass. See
      [inventory-types-audit.md](inventory-types-audit.md). Native branch gaps
      remain explicit; this does not complete the inventory subsystem.
- [x] Shared ggetobj/askchain selection for identification, dropping and
      takeoff. Eighty-nine C cases, native state checks and constructed
      controls cover class order, filters, counts, retries and changing
      object chains. See [inventory-selection-audit.md](inventory-selection-audit.md).
      Container callers are now connected; remaining sorting/menu integration
      is open. Earlier source coverage was 106/126 ggetobj and 100/124 askchain
      direct outcomes, not complete function execution coverage.
- [x] September `#adjust` source pass: count handling, split rollback,
      collect/merge/name rules, bumping and full-pack refusal, used-letter menus,
      floating letters, and equipment/light merger fixes. Fifty-eight asserted C
      scenarios and the equipment/light state gate pass. Remaining branches
      and the discarded-object/billing lifecycle are tracked in the audit.
- [x] Unpaid merger pass: same owner and quote, bill quantity combination,
      deallocation and split cleanup, name transfer, and price-identity/light
      preservation. Eight C cases and the merger state gate pass. Full C
      lifecycle review remains open.
- [ ] `src/invent.c`: `addinv`, `freeinv`, `getobj`, `display_inventory`,
      `display_pickinv`, letter assignment, `#adjust`, merge and split rules
- [ ] Inventory menu rendering goes through the M3 menu code; the *content* is here
- [ ] The 52-slot letter limit and its overflow behaviour
- [ ] `I` inventory subsets, `$` gold, `*` all equipment, and the `)`/`[`/`=`/`"`/`(`
      single-slot reports

### 8.3 Pickup, drop, containers

- [x] Magical doors and message feedback: 174 C scenarios cover wand effects,
      Rogue door concealment, object obstructions, senses, coordinate modes
      and eyewear articles. Native state and 72 constructed groups pass.
      See [door-magic-audit.md](door-magic-audit.md) for exact source gaps,
      including native monster-obstruction and trap-knowledge observations.
- [x] Lock occupations and door passage: 157 C scenarios cover magic-key
      disarming, forcing, tool choice, mimic ownership, queued kicking and
      integer closing strength. Native state and 64 constructed groups pass.
      See [lock-occupation-audit.md](lock-occupation-audit.md) for measured
      outcomes and remaining magical-door, obstruction and watch coverage.
- [x] Untrapping entry and rescue: 284 C scenarios cover floor, container and
      door selection, roles, tools, captive rescue, half damage and flight
      blocking. Native state and 73 constructed groups pass. See
      [untrapping-audit.md](untrapping-audit.md) for measured C outcomes and
      the remaining mounted, mimic, shop and rare-rescue coverage gaps.
- [x] Looting entry and automatic container unlocking: 144 C scenarios cover
      multiple containers, floor guards, saddle dispatch, confused gold
      transfers, option parsing and menus, trap checks, and magic-key roles
      and ordering. Native state and 52 constructed groups pass. See
      [looting-entry-audit.md](looting-entry-audit.md). Remaining pick_lock/autokey branches remain open.
- [x] Container selection and carrying pass: complete relevant query_classes,
      traditional_loot, menu_loot, use_container and transfer callbacks, with
      counted-stack restoration, carrying limits, gold rounding and contents
      sorting. The 114 C cases and state controls pass. See
      [container-selection-audit.md](container-selection-audit.md) for exact
      coverage and the native quantum/shop gaps. Full pickup and looting
      workflows remain open.

- [ ] `src/pickup.c`: `dopickup`, `pickup_object`, autopickup rules and the
      `pickup_types` option, `#loot`, `#tip`, container in and out
- [ ] `src/do.c`: `dodrop`, `doddrop`, `drop_done`
- [ ] **5.0:** bags of holding scatter contents on explosion rather than
      destroying them
- [ ] Object pile display and the "things that are here" window —
      `seed0398-wizard-wandpoly-pile` targets this

### 8.4 Wearing and wielding

- [ ] `src/do_wear.c`: wear, take off, put on, remove, cursed-item resistance,
      the multi-turn delays
- [x] `src/wield.c`, `src/worn.c`: wield and exchange — the worn[] table,
      setworn/setnotworn, setuwep/setuqwep/setuswapwep through it, dowield
      with the quiver-split prompts, doswapweapon, welded/weldmsg,
      set_twoweap/untwoweapon, and the 'w' key wired to dowield
- [x] `src/wield.c`: the #twoweapon toggle — can_twoweapon with every
      refusal message, drop_uswapwep, dotwoweapon on 'X' and #twoweapon
- [ ] **5.0:** dragon scale mail grants two extrinsic resistances; black adds
      drain resistance, green adds sickness immunity, gold is a light source

`seed0116-wizard-wear-shop` (127 steps) covers wear plus shop interaction.

### 8.5 Consumables and item use

- [ ] `src/eat.c`: eat, corpses, tins, the multi-turn eating occupation, nutrition
- [ ] `src/potion.c`: quaff, dipping, alchemy. **5.0:** diluted stacks alchemize
      only 2 potions; alchemy smock reduces blast chance to 1-in-30; blessed
      potions of polymorph grant controlled polymorph; sink dipping identifies a
      potion by message
- [ ] `src/read.c`: scrolls and spellbooks. **5.0:** spellbooks can be applied to
      check wear; advancing a spell school's skill auto-identifies its books by
      appearance
- [ ] `src/zap.c`: wands, rays, bouncing, `polyself`. **5.0:** wand of speed
      monster no longer grants permanent speed when self-zapped; cursed wands may
      explode when used to engrave
- [ ] `src/apply.c`: tools, lamps, horns, and the rest. **5.0:** candle light
      radius uses a square-root formula
- [ ] `src/dothrow.c`: throw, fire, quiver, boomerangs, and the knockback path
- [ ] `src/spell.c`: casting, spell memory, spell levels. **5.0:** chain lightning
      is a new level 2 attack spell; charm monster is now 5, sleep 3, confuse 1

Sessions: `seed2200-wizard-quaff-zap-read` (230),
`seed0501-priest-cast-read-turn` (28), `seed1800-tourist-eat-throw` (26),
`seed0105-valk-chat-lamp-ration` (30), `seed0016-healer-newmoon-eat-zap` (36).

### 8.6 Shops

- [ ] `src/shk.c` (6,125 lines): pricing, billing, credit, theft, the shopkeeper's
      dialogue and anger states
- [ ] `src/shknam.c`: shop types, stock generation, shopkeeper names
- [ ] **5.0:** shopkeepers can remove pits and webs near themselves; walking into
      a peaceful shopkeeper auto-pays debts before the inventory prompt; corpses,
      tins, and eggs from intrinsic-granting monsters have higher prices
- [ ] `src/steal.c` theft handling

### 8.7 Artifacts

- [ ] `src/artifact.c` plus the `include/artilist.h` table via the generator
- [ ] **5.0:** broadened effects — Snickersnee's free reach attack, Sunsword's
      `#invoke` blinding ray, Trollsbane's regeneration while wielded, Demonbane
      as a silver mace and guaranteed first Priest sacrifice gift

---

## Done when

- The consumable, shop, and pile sessions above pass end to end
- Item names in every rendered frame match C exactly, including articles,
  plurals, enchantment display, and beatitude
- `seed0108-wizard-extcmd-wishlist` (303 steps) runs deep, since wishing
  exercises the naming parser in reverse
