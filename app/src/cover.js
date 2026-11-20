// Neon Coast Cover Studio — the cover engine.
//
// Renders a GTA-poster-style cover on any 2D canvas: a multi-panel photo grid
// (or a full-bleed hero, or tilted snapshots on a painted sunset), a Vice City
// neon-sunset grade per panel, original vector art drawn in code (retro sun,
// palm silhouettes, skyline, birds), bold Anton title lettering with a Pacifico
// script subtitle, film grain and a vignette. Everything is drawn in code or
// from the user's own photos — no Rockstar art, logos or fonts.
//
// The engine is pure: renderCover(canvas, state) draws the whole cover at the
// canvas's own pixel size, so the live preview and the exported PNGs share one
// code path. layoutPanels(layout, w, h) is the single source of truth for
// where each panel sits, so the editor's click/drag hit-testing matches the
// drawing exactly.

export const EXPORT_SIZES = {
  square: { w: 1080, h: 1080, label: 'Square 1080 x 1080' },
  portrait: { w: 1080, h: 1350, label: 'Portrait 1080 x 1350' },
  landscape: { w: 1920, h: 1080, label: 'Landscape 1920 x 1080' },
  story: { w: 1080, h: 1920, label: 'Story 1080 x 1920' },
};

export const LAYOUTS = {
  four: { name: 'Four Corners', panels: 4, blurb: 'Classic 2 x 2 poster grid' },
  hero: { name: 'Hero + Three', panels: 4, blurb: 'One big hero, three stacked' },
  full: { name: 'Full Bleed', panels: 1, blurb: 'One photo, edge to edge' },
  nine: { name: 'Nine Lives', panels: 9, blurb: '3 x 3 contact-sheet grid' },
  tilted: { name: 'Tilted Snapshots', panels: 3, blurb: 'Polaroids on a sunset' },
  duo: { name: 'Diagonal Duo', panels: 2, blurb: 'Two photos, one diagonal cut' },
};

export const GRADES = {
  sunset: { name: 'Vice Sunset', top: '#ffb347', bottom: '#ff2e88', mode: 'overlay', alpha: 0.5, sat: 1.25, con: 1.06 },
  neon: { name: 'Neon Night', top: '#ff2d95', bottom: '#00e5ff', mode: 'soft-light', alpha: 0.6, sat: 1.35, con: 1.1 },
  golden: { name: 'Golden Hour', top: '#ffd76a', bottom: '#ff7a18', mode: 'overlay', alpha: 0.42, sat: 1.2, con: 1.05 },
  teal: { name: 'Teal Tide', top: '#7ef0e0', bottom: '#0b5e7a', mode: 'soft-light', alpha: 0.55, sat: 1.15, con: 1.08 },
  noir: { name: 'Noir', top: '#ffffff', bottom: '#000000', mode: 'overlay', alpha: 0.22, sat: 0, con: 1.18 },
};

const FRAME = '#17101f'; // ink between panels and around the cover edge

/** Panel rectangles for a layout, in pixels of a w x h cover. Angle is degrees. */
export function layoutPanels(layout, w, h) {
  const g = Math.round(Math.min(w, h) * 0.014); // panel gap
  const m = Math.round(Math.min(w, h) * 0.02); // outer margin
  const rect = (x, y, pw, ph, angle = 0, polaroid = false) => ({ x, y, w: pw, h: ph, angle, polaroid });
  switch (layout) {
    case 'four': {
      const cw = (w - 2 * m - g) / 2, ch = (h - 2 * m - g) / 2;
      return [
        rect(m, m, cw, ch), rect(m + cw + g, m, cw, ch),
        rect(m, m + ch + g, cw, ch), rect(m + cw + g, m + ch + g, cw, ch),
      ];
    }
    case 'hero': {
      const heroW = Math.round(w * 0.6), sideW = w - m * 2 - heroW - g;
      const ch = (h - 2 * m - 2 * g) / 3;
      return [
        rect(m, m, heroW, h - 2 * m),
        rect(m + heroW + g, m, sideW, ch),
        rect(m + heroW + g, m + ch + g, sideW, ch),
        rect(m + heroW + g, m + 2 * (ch + g), sideW, ch),
      ];
    }
    case 'full':
      return [rect(m, m, w - 2 * m, h - 2 * m)];
    case 'nine': {
      const cw = (w - 2 * m - 2 * g) / 3, ch = (h - 2 * m - 2 * g) / 3;
      const out = [];
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++)
        out.push(rect(m + c * (cw + g), m + r * (ch + g), cw, ch));
      return out;
    }
    case 'tilted': {
      const pw = w * 0.52, ph = h * 0.34;
      return [
        rect(w * 0.06, h * 0.1, pw, ph, -6, true),
        rect(w * 0.42, h * 0.32, pw, ph, 4, true),
        rect(w * 0.1, h * 0.58, pw, ph, -2, true),
      ];
    }
    case 'duo':
      // Two panels split by one diagonal; each is a clipped polygon.
      return [
        { ...rect(0, 0, w, h), clip: [[0, 0], [w, 0], [w * 0.58, h], [0, h]] },
        { ...rect(0, 0, w, h), clip: [[w, 0], [w, h], [w * 0.58, h]] },
      ];
  }
  return [rect(m, m, w - 2 * m, h - 2 * m)];
}

/** Inverse hit-test: which panel index contains point (px, py) on a w x h cover? */
export function hitPanel(layout, w, h, px, py) {
  const panels = layoutPanels(layout, w, h);
  for (let i = panels.length - 1; i >= 0; i--) {
    const p = panels[i];
    if (p.clip) {
      if (pointInPolygon(px, py, p.clip)) return i;
      continue;
    }
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
    const a = (-p.angle * Math.PI) / 180;
    const dx = px - cx, dy = py - cy;
    const lx = dx * Math.cos(a) - dy * Math.sin(a);
    const ly = dx * Math.sin(a) + dy * Math.cos(a);
    if (Math.abs(lx) <= p.w / 2 && Math.abs(ly) <= p.h / 2) return i;
  }
  return -1;
}

function pointInPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Draws one photo into a panel rect, cover-fit, with per-panel zoom/pan/flip. */
function drawPanelPhoto(ctx, photo, panel, slot) {
  const { x, y, w, h } = panel;
  ctx.save();
  if (panel.clip) {
    ctx.beginPath();
    panel.clip.forEach(([cx, cy], i) => (i === 0 ? ctx.moveTo(cx, cy) : ctx.lineTo(cx, cy)));
    ctx.closePath();
    ctx.clip();
  } else {
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
  }
  ctx.translate(x + w / 2, y + h / 2);
  if (panel.angle) ctx.rotate((panel.angle * Math.PI) / 180);
  if (slot.flip) ctx.scale(-1, 1);
  const zoom = slot.zoom ?? 1;
  const scale = Math.max(w / photo.naturalWidth, h / photo.naturalHeight) * zoom;
  const pw = photo.naturalWidth * scale, ph = photo.naturalHeight * scale;
  const ox = (slot.dx ?? 0) * w, oy = (slot.dy ?? 0) * h;
  ctx.drawImage(photo, -pw / 2 + ox, -ph / 2 + oy, pw, ph);
  ctx.restore();
}

/** Applies a colour grade over a panel rect (gradient wash + saturation). */
function gradePanel(ctx, panel, grade) {
  const { x, y, w, h } = panel;
  ctx.save();
  if (panel.clip) {
    ctx.beginPath();
    panel.clip.forEach(([cx, cy], i) => (i === 0 ? ctx.moveTo(cx, cy) : ctx.lineTo(cx, cy)));
    ctx.closePath();
    ctx.clip();
  } else {
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
  }
  const wash = ctx.createLinearGradient(x, y, x, y + h);
  wash.addColorStop(0, grade.top);
  wash.addColorStop(1, grade.bottom);
  ctx.globalCompositeOperation = grade.mode;
  ctx.globalAlpha = grade.alpha;
  ctx.fillStyle = wash;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

/** Fills a panel with the sunset sky used when it has no photo yet. */
function drawEmptyPanel(ctx, panel, grade) {
  const { x, y, w, h } = panel;
  const sky = ctx.createLinearGradient(x, y, x, y + h);
  sky.addColorStop(0, '#3b1d5e');
  sky.addColorStop(0.5, '#c2337f');
  sky.addColorStop(1, '#ff7a3d');
  ctx.fillStyle = sky;
  ctx.fillRect(x, y, w, h);
  // a faint sun so an empty panel still reads as a sunset
  ctx.fillStyle = 'rgba(255, 214, 120, 0.85)';
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h * 0.38, Math.min(w, h) * 0.14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = `600 ${Math.round(Math.min(w, h) * 0.05)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('ADD A PHOTO', x + w / 2, y + h * 0.72);
}

/** Retro striped sun, drawn in code. */
function drawRetroSun(ctx, cx, cy, r) {
  const glow = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 2.1);
  glow.addColorStop(0, 'rgba(255, 170, 80, 0.55)');
  glow.addColorStop(1, 'rgba(255, 170, 80, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(cx - r * 2.2, cy - r * 2.2, r * 4.4, r * 4.4);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  const sun = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
  sun.addColorStop(0, '#ffe27a');
  sun.addColorStop(0.55, '#ff9a3d');
  sun.addColorStop(1, '#ff2e88');
  ctx.fillStyle = sun;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  // slats cut the lower half
  ctx.fillStyle = 'rgba(23, 16, 31, 0.9)';
  let y = cy + r * 0.08, gap = r * 0.09;
  while (y < cy + r) { ctx.fillRect(cx - r, y, r * 2, gap * 0.45); y += gap; gap *= 1.25; }
  ctx.restore();
}

/** One palm silhouette, drawn in code: curved trunk + arcing fronds. */
function drawPalm(ctx, x, y, s, lean) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.rotate(lean);
  ctx.strokeStyle = '#120a1c';
  ctx.fillStyle = '#120a1c';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  // trunk
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(6, -52, -6, -104);
  ctx.stroke();
  // fronds: blades that bow out from the crown and droop at the tips
  for (let i = 0; i < 7; i++) {
    const a = (-Math.PI * (0.92 - (i / 6) * 0.84)) - Math.PI * 0.04;
    const tipX = Math.cos(a) * 62, tipY = -104 + Math.sin(a) * 26 + 30;
    ctx.beginPath();
    ctx.moveTo(-6, -104);
    ctx.quadraticCurveTo(Math.cos(a) * 36, -104 + Math.sin(a) * 30 - 20, tipX, tipY);
    ctx.quadraticCurveTo(Math.cos(a) * 42, -104 + Math.sin(a) * 30 + 2, -6, -100);
    ctx.closePath();
    ctx.fill();
  }
  // coconuts
  ctx.beginPath(); ctx.arc(-10, -98, 5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(0, -96, 5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/** A tiny skyline with lit windows, drawn in code. */
function drawSkyline(ctx, x, y, w, h) {
  ctx.fillStyle = '#160d24';
  let bx = x;
  while (bx < x + w) {
    const bw = w * (0.05 + Math.random() * 0.05);
    const bh = h * (0.3 + Math.random() * 0.7);
    ctx.fillRect(bx, y + h - bh, bw, bh);
    ctx.fillStyle = 'rgba(255, 210, 110, 0.85)';
    for (let wy = y + h - bh + 6; wy < y + h - 6; wy += 12)
      for (let wx = bx + 4; wx < bx + bw - 4; wx += 10)
        if (Math.random() < 0.4) ctx.fillRect(wx, wy, 4, 5);
    ctx.fillStyle = '#160d24';
    bx += bw + 2;
  }
}

/** A few birds: two short arcs each. */
function drawBirds(ctx, x, y, s) {
  ctx.strokeStyle = 'rgba(20, 10, 30, 0.85)';
  ctx.lineWidth = Math.max(2, s * 0.06);
  ctx.lineCap = 'round';
  const bird = (bx, by, bs) => {
    ctx.beginPath();
    ctx.moveTo(bx - bs, by);
    ctx.quadraticCurveTo(bx - bs / 2, by - bs * 0.7, bx, by);
    ctx.quadraticCurveTo(bx + bs / 2, by - bs * 0.7, bx + bs, by);
    ctx.stroke();
  };
  bird(x, y, s); bird(x + s * 1.6, y + s * 0.5, s * 0.8); bird(x + s * 3, y - s * 0.3, s * 0.65);
}

let grainTile = null;
function grainPattern(ctx) {
  if (grainTile) return grainTile;
  const t = document.createElement('canvas');
  t.width = t.height = 140;
  const tc = t.getContext('2d');
  const img = tc.createImageData(140, 140);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 110 + Math.random() * 145;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  tc.putImageData(img, 0, 0);
  grainTile = ctx.createPattern(t, 'repeat');
  return grainTile;
}

/** Fits the title across the cover width, returns the font size used. */
function fitTitle(ctx, text, maxWidth, baseSize) {
  let size = baseSize;
  ctx.font = `${size}px Anton, 'Arial Narrow', sans-serif`;
  try { ctx.letterSpacing = `${Math.round(size * 0.02)}px`; } catch { /* older canvas */ }
  while (size > 20 && ctx.measureText(text).width > maxWidth) {
    size = Math.round(size * 0.94);
    ctx.font = `${size}px Anton, 'Arial Narrow', sans-serif`;
  }
  return size;
}

/** Draws the title + subtitle block. */
function drawLettering(ctx, w, h, state) {
  const title = (state.title || '').trim().toUpperCase();
  const sub = (state.subtitle || '').trim();
  if (!title && !sub) return;
  const pos = state.titlePos === 'top' ? 'top' : 'bottom';
  const maxW = w * 0.9;
  const base = Math.round(Math.min(w, h) * 0.115 * (state.titleSize ?? 1));
  const size = title ? fitTitle(ctx, title, maxW, base) : 0;
  const subSize = Math.round(Math.min(w, h) * 0.045 * (state.titleSize ?? 1));
  const blockH = size * 1.05 + (sub ? subSize * 1.7 : 0);
  const bandY = pos === 'top' ? h * 0.045 : h - h * 0.045 - blockH;
  const cx = w / 2;

  // soft dark band so lettering stays readable over any photo
  const band = ctx.createLinearGradient(0, bandY - size * 0.25, 0, bandY + blockH + size * 0.2);
  band.addColorStop(0, 'rgba(10, 6, 18, 0)');
  band.addColorStop(0.5, 'rgba(10, 6, 18, 0.45)');
  band.addColorStop(1, 'rgba(10, 6, 18, 0)');
  ctx.fillStyle = band;
  ctx.fillRect(0, bandY - size * 0.25, w, blockH + size * 0.45);

  if (title) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    const ty = bandY + size;
    if (state.titleStyle === 'sunset') {
      const grad = ctx.createLinearGradient(0, ty - size, 0, ty);
      grad.addColorStop(0, '#fff6a3');
      grad.addColorStop(0.45, '#ffb347');
      grad.addColorStop(0.8, '#ff5e7a');
      grad.addColorStop(1, '#ff2e88');
      ctx.fillStyle = grad;
      ctx.strokeStyle = '#1c0b2e';
      ctx.lineWidth = Math.max(3, size * 0.09);
      ctx.strokeText(title, cx, ty);
      ctx.fillText(title, cx, ty);
    } else if (state.titleStyle === 'neon') {
      ctx.shadowColor = '#ff2d95';
      ctx.shadowBlur = size * 0.35;
      ctx.fillStyle = '#ffd7ef';
      ctx.strokeStyle = '#ff2d95';
      ctx.lineWidth = Math.max(2, size * 0.05);
      ctx.strokeText(title, cx, ty);
      ctx.fillText(title, cx, ty);
      ctx.shadowBlur = size * 0.15;
      ctx.shadowColor = '#00e5ff';
      ctx.fillText(title, cx, ty);
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#160a24';
      ctx.lineWidth = Math.max(3, size * 0.08);
      ctx.strokeText(title, cx, ty);
      ctx.fillText(title, cx, ty);
    }
    ctx.restore();
  }
  if (sub) {
    ctx.save();
    ctx.font = `${subSize}px Pacifico, cursive`;
    ctx.textAlign = 'center';
    ctx.fillStyle = state.titleStyle === 'neon' ? '#8ff5ff' : '#ffe9a8';
    ctx.shadowColor = state.titleStyle === 'neon' ? '#00b8d4' : 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = subSize * 0.4;
    ctx.fillText(sub, cx, bandY + size * 1.05 + subSize * 1.15);
    ctx.restore();
  }
}

/** Draws the star heat-meter + badge ribbon in a corner. */
function drawBadge(ctx, w, h, state) {
  if (!state.showBadge) return;
  const s = Math.min(w, h);
  const pad = s * 0.028;
  // star meter, top-right
  ctx.save();
  ctx.font = `${Math.round(s * 0.035)}px system-ui, sans-serif`;
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffd76a';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 6;
  ctx.fillText('★★★★★', w - pad, pad + s * 0.035);
  ctx.restore();
  // ribbon, top-left
  ctx.save();
  const label = 'MADE OFFLINE · NO UPLOAD';
  ctx.font = `700 ${Math.round(s * 0.022)}px system-ui, sans-serif`;
  const tw = ctx.measureText(label).width;
  ctx.fillStyle = 'rgba(20, 10, 30, 0.72)';
  ctx.beginPath();
  ctx.roundRect(pad, pad, tw + s * 0.03, s * 0.045, s * 0.022);
  ctx.fill();
  ctx.fillStyle = '#ffe9a8';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, pad + s * 0.015, pad + s * 0.0235);
  ctx.restore();
}

/**
 * Draws the whole cover. `state` carries layout, grade, lettering, effects and
 * per-panel slots; `photos` is the array of loaded <img> elements (or nulls).
 */
export function renderCover(canvas, state, photos) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  const grade = GRADES[state.grade] ?? GRADES.sunset;
  const panels = layoutPanels(state.layout, w, h);

  // backdrop: the sunset sky, visible between panels and behind snapshots
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#2b1046');
  sky.addColorStop(0.45, '#8a2560');
  sky.addColorStop(0.75, '#ff5e3a');
  sky.addColorStop(1, '#ffb347');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  if (state.layout === 'tilted' || state.layout === 'full') {
    if (state.showSun) drawRetroSun(ctx, w * 0.78, h * 0.2, Math.min(w, h) * 0.13);
    drawBirds(ctx, w * 0.12, h * 0.14, Math.min(w, h) * 0.03);
    if (state.layout === 'full') drawSkyline(ctx, 0, h * 0.62, w, h * 0.12);
  }

  // panels, back to front
  panels.forEach((panel, i) => {
    const slot = state.panels[i] ?? {};
    const photo = photos[slot.photo ?? 0] ?? null;
    ctx.save();
    if (panel.polaroid) {
      // white polaroid frame + soft shadow, rotated with the panel
      ctx.translate(panel.x + panel.w / 2, panel.y + panel.h / 2);
      ctx.rotate((panel.angle * Math.PI) / 180);
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = Math.min(w, h) * 0.03;
      ctx.shadowOffsetY = Math.min(w, h) * 0.008;
      ctx.fillStyle = '#fdf8ef';
      const bw = Math.min(w, h) * 0.018;
      ctx.fillRect(-panel.w / 2 - bw, -panel.h / 2 - bw, panel.w + bw * 2, panel.h + bw * 2);
      ctx.restore();
      ctx.save();
      ctx.translate(panel.x + panel.w / 2, panel.y + panel.h / 2);
      ctx.rotate((panel.angle * Math.PI) / 180);
      ctx.translate(-panel.w / 2, -panel.h / 2);
      if (photo) {
        ctx.filter = `saturate(${grade.sat}) contrast(${grade.con})`;
        drawPanelPhoto(ctx, photo, { x: 0, y: 0, w: panel.w, h: panel.h }, slot);
        ctx.filter = 'none';
      } else {
        drawEmptyPanel(ctx, { x: 0, y: 0, w: panel.w, h: panel.h }, grade);
      }
      gradePanel(ctx, { x: 0, y: 0, w: panel.w, h: panel.h }, grade);
      ctx.restore();
      return;
    }
    if (photo) {
      ctx.filter = `saturate(${grade.sat}) contrast(${grade.con})`;
      drawPanelPhoto(ctx, photo, panel, slot);
      ctx.filter = 'none';
    } else {
      drawEmptyPanel(ctx, panel, grade);
    }
    gradePanel(ctx, panel, grade);
    ctx.restore();
  });

  // ink frame: panel gaps read as poster seams
  ctx.fillStyle = FRAME;
  ctx.fillRect(0, 0, w, Math.round(Math.min(w, h) * 0.012));
  ctx.fillRect(0, h - Math.round(Math.min(w, h) * 0.012), w, Math.round(Math.min(w, h) * 0.012));
  ctx.fillRect(0, 0, Math.round(Math.min(w, h) * 0.012), h);
  ctx.fillRect(w - Math.round(Math.min(w, h) * 0.012), 0, Math.round(Math.min(w, h) * 0.012), h);

  // diagonal seam for the duo layout
  if (state.layout === 'duo') {
    ctx.strokeStyle = FRAME;
    ctx.lineWidth = Math.max(4, Math.min(w, h) * 0.014);
    ctx.beginPath();
    ctx.moveTo(w, 0);
    ctx.lineTo(w * 0.58, h);
    ctx.stroke();
  }

  // palms along the bottom edge (backdrop layouts) — silhouettes over panels
  if (state.showPalms && (state.layout === 'full' || state.layout === 'tilted')) {
    const s = Math.min(w, h) * 0.003;
    drawPalm(ctx, w * 0.03, h * 0.995, s * 0.9, 0.16);
    drawPalm(ctx, w * 0.98, h * 0.998, s * 0.75, -0.2);
  }

  drawLettering(ctx, w, h, state);
  drawBadge(ctx, w, h, state);

  if (state.grain) {
    ctx.save();
    ctx.globalAlpha = 0.09;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = grainPattern(ctx);
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
  if (state.vignette) {
    const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(10,4,18,0.38)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  }
}
