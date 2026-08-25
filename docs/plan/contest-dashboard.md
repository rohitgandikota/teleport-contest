# Contest score dashboard

Last refreshed: 2026-08-25T21:59:00.267Z. Local commit: `8f591da`.
Leaderboard snapshot: 2026-08-25T19:39:15.748Z. Fork last scored: 2026-08-25T19:03:55.987Z.

## Score summary

| Corpus | Identical screens | Screen rate | Sessions passing | RNG | Animation |
|---|---:|---:|---:|---:|---:|
| Public local | 8713/11405 | 76.40% | 39/44 | 513527/792838 (64.77%) | 6/1483 |
| Public leaderboard | 8713/11405 | 76.40% | 39/44 | 64.79% | 6/1483 |
| Held-out leaderboard | 4884/11265 | 43.36% | 3/44 | 20.85% | 0/2959 |
| Supplemental C suite | 2683/3739 | 71.76% | 37/40 | 393457/470994 (83.54%) | 0/75 |

## Contest position and generalization

- Held-out rank: **3/18**.
- Public rank: **9/18**.
- Held-out/public identical-screen ratio: **0.561**.
- Current held-out leader: `NoahBPeterson/teleport-contest`, 11264/11265.
- Contest phase: open.

## Output details

| Check | Public local | Supplemental |
|---|---:|---:|
| Cells only | 8717/11405 | 2683/3739 |
| Cursor positions | 9730/11405 | 3168/3739 |
| Startup and per-turn estimate | 68+0.33/turn | 54+0.50/turn |

## Judge health

- Playable: true. Browser: true.
- Speed: 2.609 ms per move, limit 5 ms.
- Sessions skipped: 0. Sessions killed: 0.
- Early abort: false. Total scored moves: 15836.
- Local hang gate: PASS. OK: no session over-read (44 checked).

## Recent snapshots

| Refreshed | Commit | Public local | Supplemental | Held-out | Rank |
|---|---|---:|---:|---:|---:|
| 2026-08-25T21:59:00.267Z | `8f591da` | 8713/11405 | 2683/3739 | 4884/11265 | 3 |
| 2026-08-25T21:50:44.920Z | `8d5f81e` | 8713/11405 | 2633/3739 | 4884/11265 | 3 |
| 2026-08-25T21:38:50.809Z | `e899d24` | 8713/11405 | 2554/3739 | 4884/11265 | 3 |
| 2026-08-25T21:17:48.132Z | `c40a252` | 8713/11405 | 2495/3739 | 4884/11265 | 3 |
| 2026-08-25T21:06:15.255Z | `d982795` | 8713/11405 | 2383/3739 | 4884/11265 | 3 |
| 2026-08-25T20:18:48.347Z | `3b40d57` | 8713/11405 | 2340/3739 | 4884/11265 | 3 |
| 2026-08-25T20:09:21.899Z | `4c84890` | 8713/11405 | 2297/3739 | 4884/11265 | 3 |
| 2026-08-25T20:03:55.828Z | `203dd4f` | 8713/11405 | 2268/3739 | 4884/11265 | 3 |
| 2026-08-25T19:56:39.186Z | `11c7ce7` | 8713/11405 | 2255/3739 | 4884/11265 | 3 |
| 2026-08-25T19:48:55.253Z | `da02db8` | 8713/11405 | 2119/3739 | 4884/11265 | 3 |

Refresh with `node tools/contest-dashboard.mjs`. The command runs both local
corpora, the hang gate, and a live leaderboard fetch. A push can take up to
two hours to appear in the held-out column.
