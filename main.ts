// Neon Coast Cover Studio — a gta6-cover-art-01 entry (Node 22, standard library only).
// The app is this directory's app/ folder: plain static files a desktop browser
// loads offline (app/index.html and its ES modules, Anton + Pacifico fonts vendored
// under app/fonts/, no library and no network request). It turns a person's photos
// and a caption into GTA-style multi-panel cover art — six layouts, per-panel crop
// and position, five neon-sunset grades, code-drawn palm/sun/skyline art, bold
// Anton title lettering with a Pacifico script subtitle — and exports PNGs in all
// four post sizes (1080 x 1080, 1080 x 1350, 1920 x 1080, 1080 x 1920) in one step.
//
// This program hands the entry in: it copies app/ and screenshots/ from beside
// this file to /output and writes /output/dossier.json, the summary the judge
// reads, with the vendored make.fun library. It refuses to hand in an entry whose
// screenshots break the gate's own limits (more than 4, or one over 256 KiB),
// so a bad screenshot is caught here instead of at grading time.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The gate's screenshot limits (reference/gate.json): 3 to 4 shots, each at most
// 256 KiB. Check before the dossier is built, so a too-big screenshot fails here
// with a readable message instead of silently handing in an invalid entry.
const shotDir = join(here, 'screenshots');
const shots = existsSync(shotDir)
  ? readdirSync(shotDir).filter((f) => !f.startsWith('.')).sort()
  : [];
if (shots.length < 3 || shots.length > 4) {
  throw new Error(`expected 3 or 4 screenshots, found ${shots.length}`);
}
for (const shot of shots) {
  const size = statSync(join(shotDir, shot)).size;
  if (size > 262144) throw new Error(`screenshot ${shot} is ${size} bytes, over the 256 KiB limit`);
}

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in app/ or 48 MiB of app
// files, in all, or a path under app/ over 1000 bytes: app/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }),
);

// The gate caps the dossier at 1.5 MiB; check the file actually written, since
// the cap applies to the dossier's bytes, not to the text inside it.
const dossierBytes = statSync(join(out, 'dossier.json')).size;
if (dossierBytes > 1572864) {
  throw new Error(`dossier.json is ${dossierBytes} bytes, over the 1.5 MiB limit`);
}

console.log(`handed in ${shots.length} screenshots (${shots.join(', ')}), dossier ${dossierBytes} bytes`);
