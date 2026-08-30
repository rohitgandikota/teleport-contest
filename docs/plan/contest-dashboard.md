# Contest score dashboard

Last refreshed: 2026-08-30T22:49:27.334Z. Local commit: `03a8bd4`.
Leaderboard snapshot: 2026-08-30T17:31:26.469Z. Fork last scored: 2026-08-30T16:55:52.282Z.
Live JSON fetch unavailable: fetch failed. Using the last exact snapshot.

## Score summary

| Corpus | Identical screens | Screen rate | Sessions passing | RNG | Animation |
|---|---:|---:|---:|---:|---:|
| Public local | 11405/11405 | 100.00% | 44/44 | 792838/792838 (100.00%) | 43/1483 |
| Public leaderboard | 11405/11405 | 100.00% | 44/44 | 100.00% | 9/1483 |
| Held-out leaderboard | 6032/11265 | 53.55% | 9/44 | 43.37% | 0/2959 |
| Supplemental C suite | 40911/41296 | 99.07% | 219/221 | 2782870/2782870 (100.00%) | 88/1810 |

## Contest position and generalization

- Agentic category rank: **1/9**.
- Overall held-out rank: **3/19**.
- Public rank: **5/19**.
- Held-out/public identical-screen ratio: **0.529**.
- Current held-out leader: `NoahBPeterson/teleport-contest`, 11264/11265.
- Contest phase: open.
- Local checkpoint `03a8bd4` has not been judged yet; held-out numbers are from the earlier published run.

## Output details

| Check | Public local | Supplemental |
|---|---:|---:|
| Cells only | 11405/11405 | 41289/41296 |
| Cursor positions | 11405/11405 | 40911/41296 |
| Startup and per-turn estimate | 64+0.45/turn | 74+0.16/turn |

## Supplemental capture caveats

- `gehennom-tour` contains five corrupt C cell frames and 383 corrupt cursor frames from its original recording.
- `bones-persistence` differs on two terminal frames while the C recorder reports a bones-compression error. Its 468-frame load segment and all RNG calls match exactly.

## Judge health

- Playable: true. Browser: true.
- Speed: 1.988 ms per move, limit 25 ms.
- Sessions skipped: 0. Sessions killed: 0.
- Early abort: false. Total scored moves: 18402.
- Local hang gate: PASS. OK: no session over-read (44 checked).

## Recent snapshots

| Refreshed | Commit | Public local | Supplemental | Held-out | Rank |
|---|---|---:|---:|---:|---:|
| 2026-08-30T22:49:27.334Z | `03a8bd4` | 11405/11405 | 40911/41296 | 6032/11265 | 3 |
| 2026-08-30T22:34:38.740Z | `069cb93` | 11405/11405 | 40491/40876 | 6032/11265 | 3 |
| 2026-08-30T22:22:37.692Z | `3c5af58` | 11405/11405 | 40343/40728 | 6032/11265 | 3 |
| 2026-08-30T22:11:17.575Z | `51aa41f` | 11405/11405 | 40230/40615 | 6032/11265 | 3 |
| 2026-08-30T21:35:25.953Z | `739fd92` | 11405/11405 | 39739/40124 | 6032/11265 | 3 |
| 2026-08-30T21:13:06.038Z | `39ee103` | 11405/11405 | 39450/39835 | 6032/11265 | 3 |
| 2026-08-30T20:58:02.348Z | `a31b49a` | 11405/11405 | 39220/39605 | 6032/11265 | 3 |
| 2026-08-30T20:33:19.416Z | `6963e63` | 11405/11405 | 39172/39557 | 6032/11265 | 3 |
| 2026-08-30T20:20:52.701Z | `c14098a` | 11405/11405 | 39172/39557 | 6032/11265 | 3 |
| 2026-08-30T20:10:00.784Z | `245ff75` | 11405/11405 | 39172/39557 | 6032/11265 | 3 |

Refresh with `node tools/contest-dashboard.mjs`. The command runs both local
corpora, the hang gate, and a live leaderboard fetch. A push can take up to
two hours to appear in the held-out column.
