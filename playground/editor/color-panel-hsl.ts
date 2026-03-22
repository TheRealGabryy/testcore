import { hsvToRgb } from './color-wheel-widget';
import type { ColorGrading } from './color-grading';

interface SliderSpec {
  key: keyof ColorGrading;
  label: string;
  min: number; max: number; step: number;
  format?: (v: number) => string;
}

function makeRow(
  spec: SliderSpec,
  getVal: () => number,
  setVal: (v: number) => void,
  onChange: () => void
): { el: HTMLElement; update: () => void } {
  const row = document.createElement('div');
  row.className = 'cg-slider-row';

  const dot = document.createElement('button');
  dot.className = 'cg-reset-dot';
  dot.title = 'Reset';

  const label = document.createElement('span');
  label.className = 'cg-slider-label';
  label.textContent = spec.label;

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'cg-slider';
  slider.min = String(spec.min); slider.max = String(spec.max); slider.step = String(spec.step);

  const num = document.createElement('input');
  num.type = 'number';
  num.className = 'cg-num';
  num.min = String(spec.min); num.max = String(spec.max); num.step = String(spec.step);

  const fmt = spec.format ?? ((v) => v.toFixed(spec.step < 0.1 ? 2 : 1));

  const update = () => {
    const v = getVal();
    slider.value = String(v);
    num.value = fmt(v);
  };
  update();

  slider.addEventListener('input', () => {
    const v = parseFloat(slider.value);
    num.value = fmt(v);
    setVal(v); onChange();
  });
  num.addEventListener('change', () => {
    const v = Math.max(spec.min, Math.min(spec.max, parseFloat(num.value) || 0));
    slider.value = String(v); num.value = fmt(v);
    setVal(v); onChange();
  });
  dot.addEventListener('click', () => {
    const defaults: Partial<Record<keyof ColorGrading, number>> = {
      hslCorSat: 1, hslCorHue: 0, hslCorLuma: 0, hslCorTemp: 0, hslCorTint: 0,
    };
    const def = spec.key in defaults ? defaults[spec.key]! : 0;
    slider.value = String(def); num.value = fmt(def);
    setVal(def); onChange();
  });

  row.appendChild(dot); row.appendChild(label); row.appendChild(slider); row.appendChild(num);
  return { el: row, update };
}

function drawHueRing(canvas: HTMLCanvasElement, center: number, range: number) {
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const grad = ctx.createLinearGradient(0, 0, w, 0);
  for (let i = 0; i <= 12; i++) {
    const [r, g, b] = hsvToRgb(i / 12, 1, 0.85);
    grad.addColorStop(i / 12, `rgb(${r},${g},${b})`);
  }
  ctx.fillStyle = grad;
  ctx.roundRect(0, h / 2 - 4, w, 8, 4);
  ctx.fill();

  const cx = (center / 360) * w;
  const hw = (range / 360) * w / 2;
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(cx - hw, 0, hw * 2, h);

  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, h); ctx.stroke();
}

export function setupHslTab(
  el: HTMLElement,
  getGrading: () => ColorGrading,
  onChange: () => void
) {
  el.innerHTML = '';
  el.className = 'hsl-tab';

  function cg() { return getGrading(); }
  function triggerChange() { onChange(); refresh(); }

  const enableRow = document.createElement('div');
  enableRow.className = 'hsl-enable-row';
  const enableChk = document.createElement('input');
  enableChk.type = 'checkbox';
  enableChk.className = 'hsl-enable-chk';
  enableChk.id = 'hsl-enable-chk';
  const enableLbl = document.createElement('label');
  enableLbl.htmlFor = 'hsl-enable-chk';
  enableLbl.textContent = 'Enable HSL Secondary';
  enableLbl.className = 'hsl-enable-lbl';
  enableRow.appendChild(enableChk); enableRow.appendChild(enableLbl);
  el.appendChild(enableRow);

  enableChk.addEventListener('change', () => {
    cg().hslEnabled = enableChk.checked;
    triggerChange();
  });

  const sectionSel = document.createElement('div');
  sectionSel.className = 'hsl-section';

  const selTitle = document.createElement('div');
  selTitle.className = 'hsl-section-title';
  selTitle.textContent = 'Key Selector';
  sectionSel.appendChild(selTitle);

  const hueCanvas = document.createElement('canvas');
  hueCanvas.className = 'hsl-hue-strip';
  hueCanvas.height = 28;
  sectionSel.appendChild(hueCanvas);

  let hueStripDragging = false;

  hueCanvas.addEventListener('pointerdown', (e) => {
    hueStripDragging = true;
    hueCanvas.setPointerCapture(e.pointerId);
    const r = hueCanvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    cg().hslHueCenter = Math.round((x / r.width) * 360);
    triggerChange();
  });
  hueCanvas.addEventListener('pointermove', (e) => {
    if (!hueStripDragging) return;
    const r = hueCanvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(r.width, e.clientX - r.left));
    cg().hslHueCenter = Math.round((x / r.width) * 360);
    triggerChange();
  });
  hueCanvas.addEventListener('pointerup', (e) => {
    hueCanvas.releasePointerCapture(e.pointerId);
    hueStripDragging = false;
  });

  const KEY_SLIDERS: SliderSpec[] = [
    { key: 'hslHueCenter', label: 'Hue Center', min: 0, max: 360, step: 1, format: v => v.toFixed(0) + '°' },
    { key: 'hslHueRange',  label: 'Hue Range',  min: 0, max: 180, step: 1, format: v => '±' + v.toFixed(0) + '°' },
    { key: 'hslSatMin',    label: 'Sat Min',    min: 0, max: 1, step: 0.01, format: v => (v * 100).toFixed(0) + '%' },
    { key: 'hslSatMax',    label: 'Sat Max',    min: 0, max: 1, step: 0.01, format: v => (v * 100).toFixed(0) + '%' },
    { key: 'hslLumaMin',   label: 'Luma Min',   min: 0, max: 1, step: 0.01, format: v => (v * 100).toFixed(0) + '%' },
    { key: 'hslLumaMax',   label: 'Luma Max',   min: 0, max: 1, step: 0.01, format: v => (v * 100).toFixed(0) + '%' },
  ];

  const keyRows: Array<{ update: () => void }> = [];
  for (const spec of KEY_SLIDERS) {
    const row = makeRow(
      spec,
      () => cg()[spec.key] as number,
      (v) => { (cg() as any)[spec.key] = v; },
      triggerChange
    );
    sectionSel.appendChild(row.el);
    keyRows.push(row);
  }

  el.appendChild(sectionSel);

  const sep = document.createElement('div');
  sep.className = 'crv-sep';
  el.appendChild(sep);

  const sectionCor = document.createElement('div');
  sectionCor.className = 'hsl-section';
  const corTitle = document.createElement('div');
  corTitle.className = 'hsl-section-title';
  corTitle.textContent = 'Correction';
  sectionCor.appendChild(corTitle);

  const COR_SLIDERS: SliderSpec[] = [
    { key: 'hslCorHue',  label: 'Hue',         min: -180, max: 180, step: 1,   format: v => v.toFixed(0) + '°' },
    { key: 'hslCorSat',  label: 'Saturation',   min: 0,    max: 3,   step: 0.01, format: v => (v * 100).toFixed(0) + '%' },
    { key: 'hslCorLuma', label: 'Luminance',    min: -1,   max: 1,   step: 0.01, format: v => v.toFixed(2) },
    { key: 'hslCorTemp', label: 'Temperature',  min: -100, max: 100, step: 0.5 },
    { key: 'hslCorTint', label: 'Tint',         min: -100, max: 100, step: 0.5 },
  ];

  const corRows: Array<{ update: () => void }> = [];
  for (const spec of COR_SLIDERS) {
    const row = makeRow(
      spec,
      () => cg()[spec.key] as number,
      (v) => { (cg() as any)[spec.key] = v; },
      triggerChange
    );
    sectionCor.appendChild(row.el);
    corRows.push(row);
  }

  el.appendChild(sectionCor);

  function refresh() {
    enableChk.checked = cg().hslEnabled;
    if (hueCanvas.clientWidth > 0) {
      hueCanvas.width = hueCanvas.clientWidth || 220;
      drawHueRing(hueCanvas, cg().hslHueCenter, cg().hslHueRange);
    }
    keyRows.forEach(r => r.update());
    corRows.forEach(r => r.update());
  }

  setTimeout(refresh, 0);

  return { refresh };
}
