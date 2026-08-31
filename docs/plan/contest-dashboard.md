# Contest score dashboard

Last refreshed: 2026-08-31T08:13:30.616Z. Local commit: `586f70a`.
Leaderboard snapshot: 2026-08-31T06:22:08.448Z. Fork last scored: 2026-08-31T05:47:19.372Z.
Direct leaderboard check: 2026-08-31T08:17:04Z. The public JSON still reports this exact snapshot.

## Score summary

| Corpus | Identical screens | Screen rate | Sessions passing | RNG | Animation |
|---|---:|---:|---:|---:|---:|
| Public local | 11405/11405 | 100.00% | 44/44 | 792838/792838 (100.00%) | 43/1483 |
| Public leaderboard | 11405/11405 | 100.00% | 44/44 | 100.00% | 9/1483 |
| Held-out leaderboard | 6032/11265 | 53.55% | 9/44 | 43.37% | 0/2959 |
| Supplemental C suite | 53306/53691 | 99.28% | 267/269 | 3283905/3283905 (100.00%) | 256/2179 |

## Contest position and generalization

- Agentic category rank: **1/9**.
- Overall held-out rank: **3/19**.
- Public rank: **5/19**.
- Held-out/public identical-screen ratio: **0.529**.
- Current held-out leader: `NoahBPeterson/teleport-contest`, 11264/11265.
- Contest phase: open.
- Local checkpoint `586f70a` has not been judged yet; held-out numbers are from the earlier published run.

## C-reference coverage

| Inventory | Covered | Partial | Gaps |
|---|---:|---:|---:|
| Mechanics categories | 106/106 | 0 | 0 |
| Explicit C branches | 389/389 | 0 | 0 |

- Fresh-seed smoke: PASS, 80 games across 13 role configs, no reached unported path.

## Output details

| Check | Public local | Supplemental |
|---|---:|---:|
| Cells only | 11405/11405 | 53684/53691 |
| Cursor positions | 11405/11405 | 53306/53691 |
| Startup and per-turn estimate | 60+0.76/turn | 108+0.25/turn |

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
| 2026-08-31T08:13:30.616Z | `586f70a` | 11405/11405 | 53306/53691 | 6032/11265 | 3 |
| 2026-08-31T07:17:56.272Z | `74ae1d1` | 11405/11405 | 51785/52170 | 6032/11265 | 3 |
| 2026-08-31T06:25:55.890Z | `f64a5da` | 11405/11405 | 49406/49791 | 6032/11265 | 3 |
| 2026-08-31T05:47:47.651Z | `ce85401` | 11405/11405 | 48174/48559 | 6032/11265 | 3 |
| 2026-08-31T05:24:03.882Z | `59d71f0` | 11405/11405 | 47845/48230 | 6032/11265 | 3 |
| 2026-08-31T04:53:52.356Z | `0b2a4a4` | 11405/11405 | 47545/47930 | 6032/11265 | 3 |
| 2026-08-31T04:32:51.757Z | `48873e8` | 11405/11405 | 47351/47736 | 6032/11265 | 3 |
| 2026-08-31T04:20:04.120Z | `3efe0c4` | 11405/11405 | 47240/47625 | 6032/11265 | 3 |
| 2026-08-31T04:03:48.455Z | `986209a` | 11405/11405 | 47175/47560 | 6032/11265 | 3 |
| 2026-08-31T03:48:09.109Z | `69bd621` | 11405/11405 | 47149/47534 | 6032/11265 | 3 |

Refresh with `node tools/contest-dashboard.mjs`. The command runs both local
corpora, the hang gate, and a live leaderboard fetch. A push can take up to
two hours to appear in the held-out column.
