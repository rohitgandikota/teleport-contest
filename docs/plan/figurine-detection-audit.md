# Figurine ownership, perception and monster detection

The ignored floor-figurine probe exposed a persistent-state bug. Blessed
monster detection still held 147 after 1,291 further turns in JS. C had already
expired the property. Consequently JS drew a newly transformed kitten at an
unseen location where C retained the remembered corridor.

The port now stores the timer in `intrinsic.HDetect_monsters` and keeps
`uprops.DETECT_MONSTERS` for C's extrinsic sources. The shared `Detect_monsters`
predicate reads both. Potion effects and the wizard timeout menu use the
intrinsic field; `nh_timeout` redraws monsters when it expires. Existing
sensing, inventory-displacement feedback and shop readers use the shared
predicate. Temporary map-browser detection remains an extrinsic bit.

The complete `peffect_monster_detection` body at C potion.c:914-951 was read.
The port also includes its spell duration, 300-turn extension threshold,
invisible-marker clearing and monster-grid scan. The shared `itimeout_incr`
now masks out source bits before adding and clamping the timeout, as in
potion.c:68. The C timeout loop and DETECT_MONSTERS arm, wizard command body,
and property macros were read. The rest of `nh_timeout` remains partial.

Three permanent recipes add 17 C intent-validated cases:

| Recipe | Cases | Direct observation |
|---|---:|---|
| figurine-perception | 6 | Invisible stalker, disguised mimic, bat, eel, named kitten and snake descriptions |
| figurine-carriers | 3 | Theft rearms a figurine; expiration in a monster inventory or on a visible/unseen floor consumes it |
| monster-detection-timeout | 8 | Potion/wizard expiry, blindness, extensions, the long-duration threshold and loneliness |

The C timer diagnostic supplied deadlines only while constructing inputs.
Its pointer-bearing `#timeout` frames are excluded from every promoted
fixture. Final timeout cases instead inspect `#wizintrinsic`, whose menu
reports a stable remaining count. The nymph theft cases have two independently
recorded attachment draws. Floor ownership comes from slaying that carrier,
which preserves the armed timer. Screen coordinates convert to game
coordinates as `[column + 1, row - 1]`.

The state gate checks every recorded remaining-time row, deadlines derived
from C draws, inventory/floor/monster ownership, disposal, names, sleep state
and expired detection. Separate source controls check independent intrinsic
and extrinsic sources, permanent source bits, spell duration and invisible
marker clearing. Those controls are not credited as native C gameplay.
The existing monster-fire-trap gate now reads the intrinsic field; its expected
30-turn value is unchanged.

A loader that skips only the HDetect_monsters countdown still passes the
visible floor case's 310 screens/cursors and 6,087 RNG entries. Its state check
fails because detection remains active. The unmodified runtime passes the
same check. This demonstrates a concrete limit of screen-only validation.
The loader and results are in `.cache/figurine/negative-*` and
`retain-detection.mjs`; no expected C data or runtime file is changed.

The 17 new cases match 3,157 screens/cursors, 172,289 RNG entries and 7,765
animation frames. The final checkpoint gates and combined corpus totals are
recorded in STATUS.md. Native collection in
`.cache/c-coverage/figurine-detection-20260905` reproduces all three recordings
exactly, adding 27 direct outcomes and no newly entered function records.
The union reaches 53,770/108,268 outcomes and 4,310/5,491 entered records.
`fig_transform` rises from 15/56 to 31/56. Monster detection reaches 13/20;
`nh_timeout` is 95/184. These are measured compiled C outcomes, not a claim
that the entire game or every function is complete.

The next reproduced failure remains in `.cache/figurine/carrier-lit.*`.
Lighting the corridor reaches the visible monster-carrier message, but a
randomly spawned jackal exposes an omitted `makemon` arrival message. All
35,571 RNG entries match, while 898/903 screens and 901/903 cursors match.
In segment zero, C step 290 pauses on the teleport message, step 291 shows
`A jackal suddenly appears close by!`, and step 292 shows the figurine message.
JS skips the jackal message and flushes the kitten too early. This failing
probe has not been promoted or credited as verified JS behavior.

The full C `makemon` body through its return was read. Its message and
occupation tail at makemon.c:1472-1510 is absent from JS; several callers
instead duplicate parts of it. Its common construction path must remain
synchronous for level generation, while interactive callers need to await
messages in source order. Group creation must pause before continuing the
parent's inventory initialization. This is the next implementation target.
