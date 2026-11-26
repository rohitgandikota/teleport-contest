# Scoped review

Read complete C monmove.c448-571 and fixed JS flees_light227-236, monflee1003-1041 and distfleeck1157-1188. The source packet pins60 reviewed owner/helper/producer ranges. The candidate reread complete naming helpers objnam.c2359-2374/2502-2517 and JS899-913/4226-4239, located feedback pline.c138-151 and JS166-173, verbalize C476-490/JS175-179, and sound macro conditions sndprocs.h193-200/238-285. Existing JS watch arrest uses the same comment-only SetVoice convention.

The light predicate keeps species, lamplit, artifact_light, sight and line-of-sight guards; only equipment lookup changes to game.u.uwep/game.u.uarm. Neither hero invisibility nor monster bravery is added here. distfleeck remains byte-identical: unconditional rn2(5) first; light fear requires nearby and !brave; fleeing duration is rnd(rn2(7)?10:100).

Within monflee, existing immobile handling stays first. The new light arm handles Unaware with located frightened feedback and no rn2(10). Otherwise rn2(10) is evaluated before Deaf, even if deaf. Naming tests the weapon artifact first, then armor, without an extra lamplit requirement in this naming subexpression, exactly as C. Use existing synchronous bare_artifactname/yname. Await pline_mon before changing mflee, and await verbalize after the sound-only SetVoice position. No message/body rewrites outside this arm. Duration, dead predicate, sanctuary, vrock gas and mon_track_clear are unchanged.

The two parent C positives select painful light, with no native verbal coverage. Unaware, Deaf, verbal speech, blindness/blocked sight, immobile/disguised gremlin and simultaneous lights remain unobserved. SetVoice is empty under C's no-integrated-sound configuration; JS currently has no integrated sound subsystem. No new sound feature or gameplay mock is introduced. Generic/immobile unlocated JS pline versus C pline_mon remains a separate known gap. No claim of whole monmove, naming or sound closure.

## Evidence and bookkeeping

Parent raw2edde5 is unchanged. All five input tuples,755 keys, source probe and all assertions are fixed. Parent baseline native3/5 and source71/75 are retained. The parent wrapper's expected-exit0 assertion does not invalidate the recording: recorder exited0; baseline comparison correctly exited1 for two differences. Original command/log plus separate baseline-accounting attribution are linked.

The candidate probe changes only its pin/preflight preamble and three output filenames. The complete original import/observer/assertion loop is byte-identical, and output/check structures are unchanged. nativeParityClaimed:false remains in the original ordinary body; the separate native report supplies measured parity. No selector, input edit, observer injection, helper mock or private export is used. The deferred helper already uses the live gstate module namespace, so no live-binding fix is needed.
