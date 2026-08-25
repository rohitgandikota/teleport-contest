# Contest score dashboard

Last refreshed: 2026-08-25T07:25:02.393Z. Local commit: `bc66fba`.
Leaderboard snapshot: 2026-08-25T02:38:10.937Z. Fork last scored: 2026-08-25T01:59:17.748Z.

## Score summary

| Corpus | Identical screens | Screen rate | Sessions passing | RNG | Animation |
|---|---:|---:|---:|---:|---:|
| Public local | 5741/11405 | 50.34% | 27/44 | 368270/792838 (46.45%) | 0/1483 |
| Public leaderboard | 5120/11405 | 44.89% | 21/44 | 39.40% | 0/1483 |
| Held-out leaderboard | 3438/11265 | 30.52% | 1/44 | 15.98% | 0/2959 |
| Supplemental C suite | 1844/3739 | 49.32% | 14/40 | 333896/470994 (70.89%) | 0/75 |

## Contest position and generalization

- Held-out rank: **5/18**.
- Public rank: **9/18**.
- Held-out/public identical-screen ratio: **0.671**.
- Current held-out leader: `NoahBPeterson/teleport-contest`, 11264/11265.
- Contest phase: open.

## Output details

| Check | Public local | Supplemental |
|---|---:|---:|
| Cells only | 5746/11405 | 1844/3739 |
| Cursor positions | 7962/11405 | 2661/3739 |
| Startup and per-turn estimate | 56+0.28/turn | 48+0.40/turn |

## Judge health

- Playable: true. Browser: true.
- Speed: 2.185 ms per move, limit 5 ms.
- Sessions skipped: 0. Sessions killed: 0.
- Early abort: false. Total scored moves: 16670.
- Local hang gate: PASS. OK: no session over-read (44 checked).

## Recent snapshots

| Refreshed | Commit | Public local | Supplemental | Held-out | Rank |
|---|---|---:|---:|---:|---:|
| 2026-08-25T07:25:02.393Z | `bc66fba` | 5741/11405 | 1844/3739 | 3438/11265 | 5 |
| 2026-08-25T07:11:57.174Z | `a51a8ec` | 5741/11405 | 1844/3739 | 3438/11265 | 5 |
| 2026-08-25T05:01:32.912Z | `b9ace65` | 5270/11405 | 1845/3739 | 3438/11265 | 5 |
| 2026-08-25T04:42:04.216Z | `8d8e295` | 5208/11405 | 1751/3646 | 3438/11265 | 5 |
| 2026-08-25T04:33:38.934Z | `a6dd970` | 5135/11405 | 1747/3646 | 3438/11265 | 5 |
| 2026-08-25T04:23:27.096Z | `918ee57` | 5123/11405 | 1740/3552 | 3438/11265 | 5 |
| 2026-08-25T04:04:11.639Z | `fb3b1c2` | 5120/11405 | 1649/3438 | 3438/11265 | 5 |
| 2026-08-25T03:53:33.645Z | `fb3b1c2` | 5120/11405 | 1041/1762 | 3438/11265 | 5 |

Refresh with `node tools/contest-dashboard.mjs`. The command runs both local
corpora, the hang gate, and a live leaderboard fetch. A push can take up to
two hours to appear in the held-out column.
