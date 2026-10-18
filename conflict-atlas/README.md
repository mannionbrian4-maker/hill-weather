# Conflict Atlas

A tappable world map of the conflicts on the Council on Foreign Relations' [Global Conflict Tracker](https://www.cfr.org/global-conflict-tracker). Tap a country or marker for a short, neutral brief and links to the best public expert analysis: CFR, International Crisis Group, Chatham House, ECFR, Carnegie, IISS, RUSI, Brookings, CSIS, IIEA and regional specialists.

Open it at https://mannionbrian4-maker.github.io/hill-weather/conflict-atlas/ and add it to your home screen.

Status and "impact on US interests" ratings are CFR's. Alerts come from Crisis Group's monthly [CrisisWatch](https://www.crisisgroup.org/crisiswatch). Map data from Natural Earth.

## How it is built

Everything lives in `src/`:

| File | What it holds |
|---|---|
| `conflicts.mjs` | The briefs: one entry per conflict, plus the `ASOF` date and the think-tank list |
| `app.html` | The page template (layout, styles, map and panel code) |
| `build.mjs` | Projects the map and writes `../index.html` (GitHub Pages) and `dist/artifact.html` (the Claude link) |
| `check.py` | Headless-browser smoke test across every conflict, phone and desktop, light and dark |

```
cd conflict-atlas/src
npm install
node build.mjs
python3 check.py
```

## Weekly refresh procedure

1. Read CFR's dashboard (https://www.cfr.org/global-conflict-tracker/dashboard) for each conflict's status and impact rating, and its region pages for the current summaries. Add or remove entries if CFR has added or dropped a conflict.
2. Read Crisis Group's latest CrisisWatch (https://www.crisisgroup.org/crisiswatch, or the month's PDF overview) and set `alert: true` only for conflicts covering a country on that month's conflict risk alert list.
3. For each conflict, check its Crisis Group page (the `icg` link) and search the think tanks for recent pieces. Rewrite `latest` and `watch` where things have moved. Change `background` only if it is out of date.
4. Keep 3–5 `reads` per conflict, newest first where possible, from at least two organisations. Only use URLs that came from a search result or a fetched page.
5. Set `ASOF` to the date of the refresh.
6. `node build.mjs && python3 check.py`, then commit and push.

Writing rules for briefs: plain English, our own words, no quotes longer than a few words, attribute contested figures (for example casualty counts) to their source, describe each side's position rather than taking one, and leave out anything that cannot be confirmed from a current source.
