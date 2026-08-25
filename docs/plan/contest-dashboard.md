# Contest score dashboard

Last refreshed: 2026-08-25T20:18:48.347Z. Local commit: `3b40d57`.
Leaderboard snapshot: 2026-08-25T19:39:15.748Z. Fork last scored: 2026-08-25T19:03:55.987Z.

## Score summary

| Corpus | Identical screens | Screen rate | Sessions passing | RNG | Animation |
|---|---:|---:|---:|---:|---:|
| Public local | 8713/11405 | 76.40% | 39/44 | 513664/792838 (64.79%) | 6/1483 |
| Public leaderboard | 8713/11405 | 76.40% | 39/44 | 64.79% | 6/1483 |
| Held-out leaderboard | 4884/11265 | 43.36% | 3/44 | 20.85% | 0/2959 |
| Supplemental C suite | 2340/3739 | 62.58% | 32/40 | 383908/470994 (81.51%) | 0/75 |

## Contest position and generalization

- Held-out rank: **3/18**.
- Public rank: **9/18**.
- Held-out/public identical-screen ratio: **0.561**.
- Current held-out leader: `NoahBPeterson/teleport-contest`, 11264/11265.
- Contest phase: open.

## Output details

| Check | Public local | Supplemental |
|---|---:|---:|
| Cells only | 8717/11405 | 2340/3739 |
| Cursor positions | 9765/11405 | 2985/3739 |
| Startup and per-turn estimate | 74+0.36/turn | 58+0.49/turn |

## Judge health

- Playable: true. Browser: true.
- Speed: 2.609 ms per move, limit 5 ms.
- Sessions skipped: 0. Sessions killed: 0.
- Early abort: false. Total scored moves: 15836.
- Local hang gate: PASS. OK: no session over-read (44 checked).

## Recent snapshots

| Refreshed | Commit | Public local | Supplemental | Held-out | Rank |
|---|---|---:|---:|---:|---:|
| 2026-08-25T20:18:48.347Z | `3b40d57` | 8713/11405 | 2340/3739 | 4884/11265 | 3 |
| 2026-08-25T20:09:21.899Z | `4c84890` | 8713/11405 | 2297/3739 | 4884/11265 | 3 |
| 2026-08-25T20:03:55.828Z | `203dd4f` | 8713/11405 | 2268/3739 | 4884/11265 | 3 |
| 2026-08-25T19:56:39.186Z | `11c7ce7` | 8713/11405 | 2255/3739 | 4884/11265 | 3 |
| 2026-08-25T19:48:55.253Z | `da02db8` | 8713/11405 | 2119/3739 | 4884/11265 | 3 |
| 2026-08-25T19:38:24.543Z | `bf51e24` | 8713/11405 | 2059/3739 | 4256/11265 | 5 |
| 2026-08-25T19:28:12.104Z | `531317a` | 8713/11405 | 2042/3739 | 4256/11265 | 5 |
| 2026-08-25T19:20:30.734Z | `2c4e650` | 8713/11405 | 2039/3739 | 4256/11265 | 5 |
| 2026-08-25T19:16:58.255Z | `ee969a2` | 8713/11405 | 2033/3739 | 4256/11265 | 5 |
| 2026-08-25T19:10:27.504Z | `2c7ee7b` | 8713/11405 | 2027/3739 | 4256/11265 | 5 |

Refresh with `node tools/contest-dashboard.mjs`. The command runs both local
corpora, the hang gate, and a live leaderboard fetch. A push can take up to
two hours to appear in the held-out column.
