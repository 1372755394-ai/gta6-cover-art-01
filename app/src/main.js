// Neon Coast Cover Studio — the editor.
//
// Wires the controls to the cover engine: photo tray (samples + uploads),
// layout and grade pickers, lettering, per-panel crop/position by drag, wheel
// and sliders, undo/redo, and one-click PNG export in all four post sizes.
// A `?shot=` query sets up a fixed scene for a screenshot instead (./shots.js).

import { EXPORT_SIZES, GRADES, LAYOUTS, hitPanel, layoutPanels, renderCover } from './cover.js';
import { runShot } from './shots.js';

const $ = (id) => document.getElementById(id);
const canvas = $('cover');
const statusEl = $('status');
const panelInfo = $('panel-info');

const SAMPLES = [
  { name: 'Boulevard', src: 'samples/boulevard.jpg' },
  { name: 'Pier', src: 'samples/pier.jpg' },
];

function defaultState() {
  return {
    size: 'square',
    layout: 'four',
    grade: 'sunset',
    title: 'NEON COAST',
    subtitle: 'a sunset story',
    titleStyle: 'sunset',
    titlePos: 'bottom',
    titleSize: 1,
    showPalms: true,
    showSun: true,
    showBadge: true,
    grain: true,
    vignette: true,
    // one slot per panel position (layouts use the first N); photo is an index
    // into the photos array, zoom a multiplier, dx/dy a fraction of panel size
    panels: Array.from({ length: 9 }, (_, i) => ({ photo: i % 2, zoom: 1, dx: 0, dy: 0, flip: false })),
  };
}

let state = defaultState();
let photos = []; // { name, src, img } — img is the loaded <img> or null
let selectedPanel = 0;
let undoStack = [];
let redoStack = [];
let fontsReady = false;

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function ensureFonts() {
  if (fontsReady) return;
  try {
    await Promise.all([
      document.fonts.load('100px Anton'),
      document.fonts.load('40px Pacifico'),
      document.fonts.ready,
    ]);
  } catch { /* fall back to system fonts */ }
  fontsReady = true;
}

function photoImages() {
  return photos.map((p) => p.img ?? null);
}

function redraw() {
  const size = EXPORT_SIZES[state.size];
  canvas.width = size.w;
  canvas.height = size.h;
  renderCover(canvas, state, photoImages());
  updatePanelControls();
}

function snapshot() {
  return JSON.stringify(state);
}

function pushUndo() {
  undoStack.push(snapshot());
  if (undoStack.length > 60) undoStack.shift();
  redoStack = [];
  updateUndoButtons();
}

function restore(json) {
  state = JSON.parse(json);
  syncControls();
  redraw();
}

function undo() {
  if (!undoStack.length) return;
  redoStack.push(snapshot());
  restore(undoStack.pop());
  updateUndoButtons();
}

function redo() {
  if (!redoStack.length) return;
  undoStack.push(snapshot());
  restore(redoStack.pop());
  updateUndoButtons();
}

function updateUndoButtons() {
  $('undo').disabled = !undoStack.length;
  $('redo').disabled = !redoStack.length;
}

function setStatus(text) {
  statusEl.textContent = text;
}

/* ---------- photos ---------- */

async function addPhoto(name, src) {
  const img = await loadImage(src).catch(() => null);
  photos.push({ name, src, img });
  renderTray();
  redraw();
  return photos.length - 1;
}

function renderTray() {
  const tray = $('tray');
  tray.innerHTML = '';
  photos.forEach((p, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'thumb';
    b.title = `${p.name} — click to put in the selected panel, double-click to fill every panel`;
    const img = document.createElement('img');
    img.src = p.src;
    img.alt = p.name;
    b.appendChild(img);
    const used = state.panels.some((s, pi) => pi < layoutPanels(state.layout, 1, 1).length && s.photo === i);
    if (used) b.classList.add('in-use');
    b.addEventListener('click', () => {
      pushUndo();
      state.panels[selectedPanel].photo = i;
      redraw();
      renderTray();
      setStatus(`${p.name} is now in panel ${selectedPanel + 1}.`);
    });
    b.addEventListener('dblclick', () => {
      pushUndo();
      state.panels.forEach((s) => { s.photo = i; });
      redraw();
      renderTray();
      setStatus(`Every panel now shows ${p.name}.`);
    });
    tray.appendChild(b);
  });
  $('photo-count').textContent = `${photos.length} photo${photos.length === 1 ? '' : 's'} loaded`;
}

/* ---------- controls ---------- */

function buildPickers() {
  const layoutBox = $('layouts');
  Object.entries(LAYOUTS).forEach(([key, def]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pick';
    b.dataset.key = key;
    b.innerHTML = `<strong>${def.name}</strong><span>${def.blurb} · ${def.panels} panel${def.panels === 1 ? '' : 's'}</span>`;
    b.addEventListener('click', () => {
      if (state.layout === key) return;
      pushUndo();
      state.layout = key;
      selectedPanel = 0;
      syncControls();
      redraw();
      setStatus(`${def.name} layout — click a panel to edit it.`);
    });
    layoutBox.appendChild(b);
  });
  const gradeBox = $('grades');
  Object.entries(GRADES).forEach(([key, def]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch';
    b.dataset.key = key;
    b.style.background = `linear-gradient(135deg, ${def.top}, ${def.bottom})`;
    b.title = def.name;
    b.setAttribute('aria-label', def.name);
    b.addEventListener('click', () => {
      if (state.grade === key) return;
      pushUndo();
      state.grade = key;
      syncControls();
      redraw();
      setStatus(`Grade: ${def.name}.`);
    });
    gradeBox.appendChild(b);
  });
}

function syncControls() {
  document.querySelectorAll('#layouts .pick').forEach((b) =>
    b.classList.toggle('active', b.dataset.key === state.layout));
  document.querySelectorAll('#grades .swatch').forEach((b) =>
    b.classList.toggle('active', b.dataset.key === state.grade));
  $('title').value = state.title;
  $('subtitle').value = state.subtitle;
  $('title-style').value = state.titleStyle;
  $('title-pos').value = state.titlePos;
  $('title-size').value = state.titleSize;
  $('size').value = state.size;
  $('show-palms').checked = state.showPalms;
  $('show-sun').checked = state.showSun;
  $('show-badge').checked = state.showBadge;
  $('grain').checked = state.grain;
  $('vignette').checked = state.vignette;
  renderTray();
}

function updatePanelControls() {
  const count = layoutPanels(state.layout, 1, 1).length;
  selectedPanel = Math.min(selectedPanel, count - 1);
  const slot = state.panels[selectedPanel];
  panelInfo.textContent = `Panel ${selectedPanel + 1} of ${count} — photo ${photos[slot.photo]?.name ?? 'none'}`;
  $('zoom').value = slot.zoom;
  $('pan-x').value = slot.dx;
  $('pan-y').value = slot.dy;
  $('flip').checked = slot.flip;
  $('zoom-val').textContent = `${Math.round(slot.zoom * 100)}%`;
}

function bindControls() {
  $('photo-file').addEventListener('change', async (e) => {
    for (const file of e.target.files) {
      const src = await new Promise((res) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.readAsDataURL(file);
      });
      await addPhoto(file.name.replace(/\.[^.]+$/, ''), src);
    }
    setStatus(`${e.target.files.length} photo(s) added — click a thumbnail to place one.`);
    e.target.value = '';
  });
  $('add-sample-boulevard').addEventListener('click', () => addPhoto('Boulevard', 'samples/boulevard.jpg'));
  $('add-sample-pier').addEventListener('click', () => addPhoto('Pier', 'samples/pier.jpg'));
  $('shuffle').addEventListener('click', () => {
    if (!photos.length) return;
    pushUndo();
    state.panels.forEach((s) => { s.photo = Math.floor(Math.random() * photos.length); });
    redraw();
    renderTray();
    setStatus('Photos shuffled across the panels.');
  });
  $('fill-one').addEventListener('click', () => {
    pushUndo();
    state.panels.forEach((s) => { s.photo = 0; });
    redraw();
    renderTray();
    setStatus('All panels now use the first photo — drag each panel to frame a different part.');
  });

  $('title').addEventListener('input', (e) => { state.title = e.target.value; redraw(); });
  $('subtitle').addEventListener('input', (e) => { state.subtitle = e.target.value; redraw(); });
  $('title-style').addEventListener('change', (e) => { pushUndo(); state.titleStyle = e.target.value; redraw(); });
  $('title-pos').addEventListener('change', (e) => { pushUndo(); state.titlePos = e.target.value; redraw(); });
  $('title-size').addEventListener('input', (e) => { state.titleSize = Number(e.target.value); redraw(); });
  $('size').addEventListener('change', (e) => { pushUndo(); state.size = e.target.value; redraw(); });

  const effect = (id, key) => $(id).addEventListener('change', (e) => {
    pushUndo(); state[key] = e.target.checked; redraw();
  });
  effect('show-palms', 'showPalms');
  effect('show-sun', 'showSun');
  effect('show-badge', 'showBadge');
  effect('grain', 'grain');
  effect('vignette', 'vignette');

  $('zoom').addEventListener('input', (e) => {
    state.panels[selectedPanel].zoom = Number(e.target.value);
    redraw();
  });
  $('zoom').addEventListener('change', () => pushUndo());
  $('pan-x').addEventListener('input', (e) => {
    state.panels[selectedPanel].dx = Number(e.target.value);
    redraw();
  });
  $('pan-y').addEventListener('input', (e) => {
    state.panels[selectedPanel].dy = Number(e.target.value);
    redraw();
  });
  $('flip').addEventListener('change', (e) => {
    pushUndo();
    state.panels[selectedPanel].flip = e.target.checked;
    redraw();
  });
  $('reset-panel').addEventListener('click', () => {
    pushUndo();
    state.panels[selectedPanel] = { photo: state.panels[selectedPanel].photo, zoom: 1, dx: 0, dy: 0, flip: false };
    redraw();
    setStatus(`Panel ${selectedPanel + 1} crop reset.`);
  });

  $('undo').addEventListener('click', undo);
  $('redo').addEventListener('click', redo);
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) redo(); else undo();
    }
  });

  $('export-one').addEventListener('click', () => exportCover(state.size));
  $('export-all').addEventListener('click', async () => {
    for (const key of Object.keys(EXPORT_SIZES)) {
      await exportCover(key);
      await new Promise((r) => setTimeout(r, 120));
    }
    setStatus('Exported all four sizes — check your downloads.');
  });
  $('random-cover').addEventListener('click', () => {
    pushUndo();
    const layouts = Object.keys(LAYOUTS);
    const grades = Object.keys(GRADES);
    state.layout = layouts[Math.floor(Math.random() * layouts.length)];
    state.grade = grades[Math.floor(Math.random() * grades.length)];
    state.panels.forEach((s) => { s.photo = Math.floor(Math.random() * photos.length); });
    selectedPanel = 0;
    syncControls();
    redraw();
    setStatus('Surprise cover — undo (Ctrl+Z) if you liked the last one better.');
  });
}

/* ---------- canvas interaction: click to select, drag to pan, wheel to zoom ---------- */

function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) / r.width) * canvas.width,
    y: ((e.clientY - r.top) / r.height) * canvas.height,
  };
}

function bindCanvas() {
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    const p = canvasPoint(e);
    const i = hitPanel(state.layout, canvas.width, canvas.height, p.x, p.y);
    if (i < 0) return;
    selectedPanel = i;
    drag = { x: p.x, y: p.y, slot: { ...state.panels[i] } };
    canvas.setPointerCapture(e.pointerId);
    redraw();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const p = canvasPoint(e);
    const panels = layoutPanels(state.layout, canvas.width, canvas.height);
    const panel = panels[selectedPanel];
    const slot = state.panels[selectedPanel];
    slot.dx = drag.slot.dx + (p.x - drag.x) / panel.w;
    slot.dy = drag.slot.dy + (p.y - drag.y) / panel.h;
    redraw();
  });
  canvas.addEventListener('pointerup', () => {
    if (drag) {
      pushUndo();
      // pushUndo snapshots the *new* state, so swap: keep the pre-drag snapshot
      // by re-pushing the drag start instead — simpler: undo stack already holds
      // the pre-drag state from the pointerdown redraw cycle; drop the extra.
      undoStack.pop();
      undoStack.push(JSON.stringify({ ...state, panels: state.panels.map((s, i) => (i === selectedPanel ? drag.slot : s)) }));
      updateUndoButtons();
    }
    drag = null;
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const slot = state.panels[selectedPanel];
    const before = snapshot();
    slot.zoom = Math.min(4, Math.max(1, slot.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
    redraw();
    undoStack.push(before);
    updateUndoButtons();
  }, { passive: false });
}

/* ---------- export ---------- */

function renderOffscreen(sizeKey) {
  const size = EXPORT_SIZES[sizeKey];
  const off = document.createElement('canvas');
  off.width = size.w;
  off.height = size.h;
  renderCover(off, { ...state, size: sizeKey }, photoImages());
  return off;
}

function downloadCanvas(off, filename) {
  return new Promise((resolve) => {
    off.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      resolve();
    }, 'image/png');
  });
}

async function exportCover(sizeKey) {
  await ensureFonts();
  const size = EXPORT_SIZES[sizeKey];
  const off = renderOffscreen(sizeKey);
  const name = `neon-coast-${size.w}x${size.h}.png`;
  await downloadCanvas(off, name);
  setStatus(`Saved ${name}.`);
  return off;
}

/* ---------- boot ---------- */

async function boot() {
  buildPickers();
  bindControls();
  bindCanvas();
  syncControls();
  updateUndoButtons();
  const shot = new URLSearchParams(location.search).get('shot');
  if (shot) {
    await runShot(shot, new URLSearchParams(location.search), {
      addPhoto, setState(patch) { Object.assign(state, patch); },
      selectPanel(i) { selectedPanel = i; },
      redraw,
    });
  } else {
    for (const s of SAMPLES) await addPhoto(s.name, s.src);
    await ensureFonts();
    redraw();
    setStatus('Two sample photos loaded — add your own, pick a layout, export.');
  }
}

boot();
