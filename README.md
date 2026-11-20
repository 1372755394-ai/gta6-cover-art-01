# Neon Coast Cover Studio

Turn your photos into GTA-style poster art — the multi-panel cover look with bold
caption lettering and a Vice City neon-sunset grade — exported as PNGs to share.
Runs entirely offline in a desktop browser: your photos never leave your machine,
there is no upload, no account and no watermark.

Built for the make.fun competition **gta6-cover-art-01**.
Referral code: **qajetvf4**

## What it does

- **Six layouts** — Four Corners (2×2 grid), Hero + Three, Full Bleed, Nine Lives
  (3×3 grid), Tilted Snapshots (polaroids on a painted sunset) and Diagonal Duo.
- **Any photos** — add your own (multiple files at once) or use the two included
  samples. Click a photo to put it in the selected panel, double-click to fill
  every panel, or shuffle. One photo can fill every panel — drag each panel to
  frame a different part of it.
- **Per-panel crop and position** — click a panel on the cover to select it, drag
  to reposition the photo, scroll to zoom; sliders for zoom and pan, plus a
  horizontal flip and a crop reset.
- **Five sunset grades** — Vice Sunset, Neon Night, Golden Hour, Teal Tide and
  Noir, each re-lighting every panel.
- **Lettering in the genre's style** — a bold condensed title (Anton, sunset
  gradient / white block / neon glow) with a Pacifico script subtitle, top or
  bottom, with a size slider and automatic fit.
- **Original art drawn in code** — a striped retro sun, palm silhouettes, a
  lit-window skyline, birds, a star heat-meter and badge, plus film grain and
  a vignette. No Rockstar Games logo, artwork or fonts anywhere.
- **Export all four post sizes in one click** — 1080×1080, 1080×1350,
  1920×1080 and 1080×1920 PNGs, each rendered at full resolution.
- **Undo / redo** (Ctrl+Z / Ctrl+Shift+Z) and a 🎲 Surprise me button.

## How to run it

No build step, no install. Any static file server works:

```sh
node serve.ts
# open http://localhost:8080
```

Or serve `app/` with anything else (`python3 -m http.server`, `npx serve`, …)
and open `app/index.html`. It works with no network connection.

## How to use it

1. Add your photos (or keep the two samples).
2. Pick a layout and a grade.
3. Click a panel on the cover, drag to frame the photo.
4. Type your title and subtitle, pick a title style.
5. **Export all 4 sizes** — four PNGs download at once.

## Files

- `main.ts` — the entry program (Node 22, stdlib only): copies `app/` and
  `screenshots/` to `/output` and writes `/output/dossier.json` via the
  vendored `vendor/makefun-app.ts`.
- `app/` — the web app as static files: `index.html`, `style.css`,
  `src/cover.js` (the cover engine), `src/main.js` (the editor),
  `src/shots.js` (fixed screenshot scenes), `fonts/` (Anton + Pacifico under
  the SIL Open Font License, see `fonts/OFL.txt`), `samples/` (two sample
  photos made with an image model for make.fun, free to use).
- `screenshots/` — 1: landscape hero cover · 2: the editor with photos loaded ·
  3: portrait nine-panel cover · 4: story-size tilted-snapshot cover.
- `serve.ts` — a tiny static server for local development.

## License

MIT — see `LICENSE`. Fonts under the SIL Open Font License (`app/fonts/OFL.txt`).
