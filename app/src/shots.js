// Fixed scenes for screenshots: each `?shot=` value builds one cover the way a
// person would — sample photos in, layout and grade picked, lettering set —
// then paints it once and sets window.__shotReady for the screenshot tool.
// `photo` picks the sample, `caption` the title, `sub` the subtitle.

const SCENES = {
  // The cover alone, full frame, landscape hero layout.
  cover: { size: 'landscape', layout: 'hero', grade: 'sunset', titleStyle: 'sunset', showPalms: true, showSun: true },
  // The editor itself, with photos loaded and panels filled.
  editor: { size: 'square', layout: 'four', grade: 'neon', titleStyle: 'neon', showPalms: false, showSun: false },
  // Portrait cover, nine-panel grid, golden grade.
  portrait: { size: 'portrait', layout: 'nine', grade: 'golden', titleStyle: 'white', showPalms: false, showSun: false },
  // Story cover, tilted snapshots on a painted sunset.
  story: { size: 'story', layout: 'tilted', grade: 'sunset', titleStyle: 'sunset', showPalms: true, showSun: true },
};

export async function runShot(shot, query, api) {
  const scene = SCENES[shot] ?? SCENES.cover;
  if (shot === 'cover' || shot === 'portrait' || shot === 'story') {
    document.body.classList.add('shot-cover');
  }
  const photo = query.get('photo') ?? 'boulevard';
  const other = photo === 'boulevard' ? 'pier' : 'boulevard';
  await api.addPhoto('Boulevard', 'samples/boulevard.jpg');
  await api.addPhoto('Pier', 'samples/pier.jpg');
  api.setState({
    ...scene,
    title: query.get('caption') ?? 'Neon Coast',
    subtitle: query.get('sub') ?? 'a sunset story',
    panels: Array.from({ length: 9 }, (_, i) => ({
      photo: i % 2 === 0 ? (photo === 'boulevard' ? 0 : 1) : (photo === 'boulevard' ? 1 : 0),
      zoom: 1.05,
      dx: 0,
      dy: 0,
      flip: false,
    })),
  });
  api.selectPanel(0);
  // draw twice: once before the webfonts arrive, once after, so the lettering
  // in the screenshot is the real Anton/Pacifico, not a fallback.
  api.redraw();
  try {
    await Promise.all([document.fonts.load('100px Anton'), document.fonts.load('40px Pacifico')]);
    await document.fonts.ready;
  } catch { /* fallbacks still draw */ }
  api.redraw();
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
