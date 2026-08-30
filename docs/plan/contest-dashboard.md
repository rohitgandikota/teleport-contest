# Contest score dashboard

Last refreshed: 2026-08-30T16:00:43Z. Local commit: `352bb41`.
Leaderboard snapshot: 2026-08-30T14:28:34.299Z. Fork last scored: 2026-08-30T14:03:27.572Z.
Live JSON fetch succeeded. The fresh judge run left the published row unchanged at 11405 + 6032 points, 100.00% public PRNG, 43.37% held-out PRNG, 100.00% public screens, 53.55% held-out screens, 9 animations, and 44 + 9 sessions. The local checkpoint below is newer than the judged code.

## Score summary

| Corpus | Identical screens | Screen rate | Sessions passing | RNG | Animation |
|---|---:|---:|---:|---:|---:|
| Public local | 11405/11405 | 100.00% | 44/44 | 792838/792838 (100.00%) | 43/1483 |
| Public leaderboard | 11405/11405 | 100.00% | 44/44 | 100.00% | 9/1483 |
| Held-out leaderboard | 6032/11265 | 53.55% | 9/44 | 43.37% | 0/2959 |
| Supplemental C suite | 34780/35165 | 98.91% | 189/191 | 2381026/2381026 (100.00%) | 88/1070 |

## Contest position and generalization

- Agentic category rank: **1/9**.
- Overall held-out rank: **3/19**.
- Public rank: **5/19**.
- Held-out/public identical-screen ratio: **0.529**.
- Current held-out leader: `NoahBPeterson/teleport-contest`, 11264/11265.
- Contest phase: open.
- Local checkpoint `352bb41` has not been judged yet; held-out numbers are from the 2026-08-30T14:03:27.572Z run.

## Output details

| Check | Public local | Supplemental |
|---|---:|---:|
| Cells only | 11405/11405 | 35158/35165 |
| Cursor positions | 11405/11405 | 34780/35165 |
| Startup and per-turn estimate | 62+0.44/turn | 107+0.20/turn |

## Latest local expansion

- `fatal-corpse-drop`: 5473/5473 RNG calls, 143/143 screens, 143/143 cells, and 143/143 cursor positions match C across two segments.
- The oracle safely acquires a cockatrice corpse with temporary stone resistance, removes that resistance, declines one bare-handed drop, confirms a second drop, then repeats with full-word confirmation enabled and an invalid-answer retry.
- The C recording reproduced byte-for-byte, with SHA-256 `01b51c0d6a4d123f0b86eadbd0b9ea073e10738022086ab995aafe0140eac95c`.
- `obfree-state-cleanup`: 7007/7007 RNG calls, 115/115 screens, 115/115 cells, and 115/115 cursor positions match C.
- The direct object lifecycle gate passes 5/5 invariants: timer and light cleanup, meal and tin context cleanup, interrupted spellbook cleanup, leash release, recursive container deletion, lock context reset, and used-up shop bill retention.
- The C recording reproduced byte-for-byte, with SHA-256 `8eb9137ededf9ce04aa814d6f8b6ddfecc9a3c002cbf903518e88a8fd51cf3b7`.
- `knockback-monster-into-pool`: 2444/2444 RNG calls, 195/195 screens, and 195/195 cursor positions match C.
- The new oracle covers a pool terrain wish, weapon knockback over one or two squares, post-hurtle liquid handling, monster drowning, and propagation of the defender-death flag back to melee.
- The recording reproduced byte-for-byte on a second capture, with SHA-256 `64bd089f67e59d9699282013fcf850a554d97080a94c18b3081419e9f2071e11`.
- `wizard-create-tame-monster`: 2980/2980 RNG calls and 27/27 screens match C.
- `monster-green-slime-consumption`: 17838/17838 RNG calls and 139/139 screens match C.
- `leashed-pet-teleport`: 3056/3056 RNG calls and 45/45 screens match C.
- The new cases cover wizard-created pets, ordinary leash use, leashed-pet movement, pet hunger after 1800 waits, green-slime glob consumption, forced form change, incompatible leash release, and the post-turn-1000 alignment text.
- Teleport now performs C's before-and-after follower checks and immediately relocates a leashed pet beside the hero with the exact 61-call coordinate shuffle.
- All three earlier C recordings reproduced byte-for-byte on a second recording run.
- Coverage ledger: 105/105 elements and 71/71 source branches. Generalization: 80 fresh games across 13 roles reached no unported path.

## Supplemental capture caveats

- `gehennom-tour` contains five corrupt C cell frames and 383 corrupt cursor frames from its original recording.
- `bones-persistence` differs on two terminal frames while the C recorder reports a bones-compression error. Its 468-frame load segment and all RNG calls match exactly.

## Judge health

- Playable: true. Browser: true.
- Speed: 1.141 ms per move, limit 25 ms.
- Sessions skipped: 0. Sessions killed: 0. Sessions failed during the playability run: 9.
- Timing note: `nh_terminate` at `really_done`; the judge still classifies the build as playable.
- Early abort: false. Total scored moves: 18402.
- Local hang gate: PASS. OK: no session over-read (44 checked).

## Recent snapshots

| Refreshed | Commit | Public local | Supplemental | Held-out | Rank |
|---|---|---:|---:|---:|---:|
| 2026-08-30T16:00:43Z | `352bb41` | 11405/11405 | 34780/35165 | 6032/11265 | 3 |
| 2026-08-30T15:47:55Z | `8027a2e` | 11405/11405 | 34637/35022 | 6032/11265 | 3 |
| 2026-08-30T15:30:30Z | `7dad41f` | 11405/11405 | 34522/34907 | 6032/11265 | 3 |
| 2026-08-30T05:32:26Z | `ae2c520` | 11405/11405 | 34327/34712 | 6032/11265 | 3 |
| 2026-08-30T05:20:44Z | `9783f0c` | 11405/11405 | 34282/34667 | 6032/11265 | 3 |
| 2026-08-29T10:31:01.764Z | `e0bfa28` | 11405/11405 | 34116/34501 | 6032/11265 | 3 |
| 2026-08-29T10:12:28.807Z | `1e71a3e` | 11405/11405 | 34056/34441 | 6032/11265 | 3 |
| 2026-08-29T09:54:00.218Z | `d2c3625` | 11405/11405 | 33990/34375 | 6032/11265 | 3 |
| 2026-08-29T09:27:51.249Z | `efb413e` | 11405/11405 | 33894/34279 | 6032/11265 | 3 |
| 2026-08-29T08:24:33.560Z | `746d2ec` | 11405/11405 | 33721/34106 | 6032/11265 | 3 |
| 2026-08-29T07:55:51.547Z | `1e5fbea` | 11405/11405 | 33635/34020 | 6032/11265 | 3 |
| 2026-08-29T07:37:41.044Z | `1f879b9` | 11405/11405 | 33544/33929 | 6032/11265 | 3 |
| 2026-08-29T07:29:58.039Z | `97011eb` | 11405/11405 | 33484/33869 | 6032/11265 | 3 |
| 2026-08-29T07:16:26.868Z | `0c95e15` | 11405/11405 | 33220/33605 | 6032/11265 | 3 |
| 2026-08-29T07:07:22.523Z | `a10af9f` | 11405/11405 | 33113/33498 | 6032/11265 | 3 |

Refresh with `node tools/contest-dashboard.mjs`. The command runs both local
corpora, the hang gate, and a live leaderboard fetch. A push can take up to
two hours to appear in the held-out column.
