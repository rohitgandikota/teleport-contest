# Contest score dashboard

Last refreshed: 2026-09-01T04:31:23.525Z. Local commit: `66c3b29`.
Leaderboard snapshot: 2026-08-31T06:22:08.448Z. Fork last scored: 2026-08-31T05:47:19.372Z.
Live JSON fetch unavailable: fetch failed. Using the last exact snapshot.
Leaderboard page checked: 2026-08-31T21:43:58Z. Live rendered board last scored 8/31/2026, 10:22:08 AM; rohitgandikota remains at 11,405 public plus 6,032 held-out screens, 44 plus 9 passing sessions, 71.9% combined PRNG, 76.9% combined screen rate, 9 animation frames, speed 256+0.9, playable yes, agentic rank 1/12, and overall held-out rank 3/19.

## Score summary

| Corpus | Identical screens | Screen rate | Sessions passing | RNG | Animation |
|---|---:|---:|---:|---:|---:|
| Public local | 11405/11405 | 100.00% | 44/44 | 792838/792838 (100.00%) | 43/1483 |
| Public leaderboard | 11405/11405 | 100.00% | 44/44 | 100.00% | 9/1483 |
| Held-out leaderboard | 6032/11265 | 53.55% | 9/44 | 43.37% | 0/2959 |
| Supplemental C suite | 63971/64356 | 99.40% | 299/301 | 3583769/3583769 (100.00%) | 282/2261 |

## Contest position and generalization

- Agentic category rank: **1/12**.
- Overall held-out rank: **3/19**.
- Public rank: **5/19**.
- Held-out/public identical-screen ratio: **0.529**.
- Current held-out leader: `NoahBPeterson/teleport-contest`, 11264/11265.
- Contest phase: open.
- Local checkpoint `66c3b29` has not been judged yet; held-out numbers are from the earlier published run.

## C-reference coverage

| Inventory | Covered | Partial | Gaps |
|---|---:|---:|---:|
| Mechanics categories | 106/106 | 0 | 0 |
| Explicit C branches | 551/551 | 0 | 0 |

- Fresh-seed smoke: PASS, 80 games across 13 role configs, no reached unported path.

## Output details

| Check | Public local | Supplemental |
|---|---:|---:|
| Cells only | 11405/11405 | 64349/64356 |
| Cursor positions | 11405/11405 | 63971/64356 |
| Startup and per-turn estimate | 104+0.81/turn | 128+0.29/turn |

## Supplemental capture caveats

- `gehennom-tour` contains five corrupt C cell frames and 383 corrupt cursor frames from its original recording.
- `bones-persistence` differs on two terminal frames while the C recorder reports a bones-compression error. Its 468-frame load segment and all RNG calls match exactly.

## Judge health

- Playable: true. Browser: true.
- Speed: 1.941 ms per move, limit 25 ms.
- Sessions skipped: 0. Sessions killed: 0.
- Early abort: false. Total scored moves: 18402.
- Local hang gate: PASS. OK: no session over-read (44 checked).

## Recent snapshots

| Refreshed | Commit | Public local | Supplemental | Held-out | Rank |
|---|---|---:|---:|---:|---:|
| 2026-09-01T04:31:23.525Z | `66c3b29` | 11405/11405 | 63971/64356 | 6032/11265 | 3 |
| 2026-09-01T04:15:50.783Z | `9b517ba` | 11405/11405 | 63717/64102 | 6032/11265 | 3 |
| 2026-09-01T03:55:37.739Z | `cc27194` | 11405/11405 | 63290/63675 | 6032/11265 | 3 |
| 2026-09-01T03:33:00.091Z | `89c265a` | 11405/11405 | 62872/63257 | 6032/11265 | 3 |
| 2026-09-01T03:10:43.010Z | `2c2ad4a` | 11405/11405 | 61900/62285 | 6032/11265 | 3 |
| 2026-09-01T02:36:13.015Z | `5bd3b99` | 11405/11405 | 61078/61463 | 6032/11265 | 3 |
| 2026-08-31T23:56:04.114Z | `dd20ded` | 11405/11405 | 59861/60246 | 6032/11265 | 3 |
| 2026-08-31T23:20:47.089Z | `e66869d` | 11405/11405 | 58915/59300 | 6032/11265 | 3 |
| 2026-08-31T22:30:51.695Z | `8c1829b` | 11405/11405 | 58404/58789 | 6032/11265 | 3 |
| 2026-08-31T21:38:32.516Z | `d4098f9` | 11405/11405 | 57776/58161 | 6032/11265 | 3 |

Refresh with `node tools/contest-dashboard.mjs`. The command runs both local
corpora, the hang gate, and a live leaderboard fetch. A push can take up to
two hours to appear in the held-out column.
