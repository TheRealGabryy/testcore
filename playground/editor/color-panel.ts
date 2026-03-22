import type { EditorState } from './state';
import { defaultColorGrading, type ColorGrading } from './color-grading';

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  let r = 0, g = 0, b = 0;
  switch (i % 6) {
    case 0: r=v; g=t; b=p; break;
    case 1: r=q; g=v; b=p; break;
    case 2: r=p; g=v; b=t; break;
    case 3: r=p; g=q; b=v; break;
    case 4: r=t; g=p; b=v; break;
    case 5: r=v; g=p; b=q; break;
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function buildWheelImageData(size: number): ImageData {
  const data = new Uint8ClampedArray(size * size * 4);
  const cx = size / 2, cy = size / 2, r = size / 2 - 1;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const idx = (y * size + x) * 4;
      if (dist > r) { data[idx + 3] = 0; continue; }
      const norm = dist / r;
      const hue = (Math.atan2(-dy, dx) / (Math.PI * 2) + 1) % 1;
      const sat = norm;
      const val = 1 - norm * norm * 0.18;
      const [rr, gg, bb] = hsvToRgb(hue, sat, val);
      data[idx] = rr; data[idx+1] = gg; data[idx+2] = bb;
      const alpha = dist > r - 1.5 ? Math.round((r - dist) / 1.5 * 255) : 255;
      data[idx + 3] = alpha;
    }
  }
  return new ImageData(data, size, size);
}

function drawHueBar(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width, h = canvas.height;
  const grad = ctx.createLinearGradient(0, 0, w, 0);
  for (let i = 0; i <= 12; i++) {
    const [r, g, b] = hsvToRgb(i / 12, 1, 1);
    grad.addColorStop(i / 12, `rgb(${r},${g},${b})`);
  }
  ctx.fillStyle = grad;
  ctx.roundRect(0, 0, w, h, 3);
  ctx.fill();
}

class ColorWheelWidget {
  canvas: HTMLCanvasElement;
  private valCanvas: HTMLCanvasElement;
  private imageData: ImageData;
  private _x = 0;
  private _y = 0;
  private size: number;
  onChange: (x: number, y: number) => void = () => {};

  constructor(size: number) {
    this.size = size;
    this.canvas = document.createElement('canvas');
    this.canvas.width = size;
    this.canvas.height = size;
    this.canvas.className = 'cw-canvas';

    this.valCanvas = document.createElement('canvas');
    this.valCanvas.width = size;
    this.valCanvas.height = size;
    this.valCanvas.className = 'cw-canvas cw-overlay';

    this.imageData = buildWheelImageData(size);
    this.drawWheel();
    this.drawIndicator();
    this.bindDrag();
  }

  get x() { return this._x; }
  get y() { return this._y; }

  set(x: number, y: number) {
    this._x = Math.max(-1, Math.min(1, x));
    this._y = Math.max(-1, Math.min(1, y));
    this.drawIndicator();
  }

  reset() { this.set(0, 0); this.onChange(0, 0); }

  private drawWheel() {
    const ctx = this.canvas.getContext('2d')!;
    ctx.putImageData(this.imageData, 0, 0);
    const cx = this.size / 2, r = this.size / 2 - 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cx, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  private drawIndicator() {
    const ctx = this.valCanvas.getContext('2d')!;
    ctx.clearRect(0, 0, this.size, this.size);
    const cx = this.size / 2, r = this.size / 2 - 1;
    const ix = cx + this._x * r;
    const iy = cx + this._y * r;
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(cx - 8, cx); ctx.lineTo(cx + 8, cx);
    ctx.moveTo(cx, cx - 8); ctx.lineTo(cx, cx + 8);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(ix, iy, 5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  private bindDrag() {
    const r = this.size / 2 - 1;
    const cx = this.size / 2;

    const onMove = (e: PointerEvent) => {
      const rect = this.valCanvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const scaleX = this.size / rect.width;
      const scaleY = this.size / rect.height;
      let nx = (px * scaleX - cx) / r;
      let ny = (py * scaleY - cx) / r;
      const d = Math.sqrt(nx * nx + ny * ny);
      if (d > 1) { nx /= d; ny /= d; }
      this._x = nx; this._y = ny;
      this.drawIndicator();
      this.onChange(this._x, this._y);
    };

    const onUp = (e: PointerEvent) => {
      this.valCanvas.releasePointerCapture(e.pointerId);
      this.valCanvas.removeEventListener('pointermove', onMove);
      this.valCanvas.removeEventListener('pointerup', onUp);
    };

    this.valCanvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.valCanvas.setPointerCapture(e.pointerId);
      this.valCanvas.addEventListener('pointermove', onMove);
      this.valCanvas.addEventListener('pointerup', onUp);
      onMove(e);
    });
  }

  mount(container: HTMLElement) {
    const wrap = document.createElement('div');
    wrap.className = 'cw-wrap';
    wrap.appendChild(this.canvas);
    wrap.appendChild(this.valCanvas);
    container.appendChild(wrap);
  }
}

function formatVal(v: number): string {
  return (v * 20).toFixed(2);
}

type WheelKey = 'lift' | 'gamma' | 'gain' | 'offset';

const WHEEL_LABELS: Record<WheelKey, string> = {
  lift: 'Lift', gamma: 'Gamma', gain: 'Gain', offset: 'Offset',
};

interface SliderDef {
  key: keyof ColorGrading;
  label: string;
  min: number; max: number; step: number; default: number;
  format?: (v: number) => string;
}

const TOP_SLIDERS: SliderDef[] = [
  { key: 'temperature', label: 'Temperature', min: -100, max: 100, step: 0.1, default: 0 },
  { key: 'tint', label: 'Tint', min: -100, max: 100, step: 0.01, default: 0 },
  { key: 'contrast', label: 'Contrast', min: 0.5, max: 2.0, step: 0.001, default: 1.0 },
  { key: 'pivot', label: 'Pivot', min: 0, max: 1, step: 0.001, default: 0.435 },
  { key: 'midtoneDetail', label: 'Midtone Detail', min: -100, max: 100, step: 0.1, default: 0 },
];

const BOTTOM_SLIDERS: SliderDef[] = [
  { key: 'colorBoost', label: 'Color Boost', min: 0, max: 100, step: 0.1, default: 0 },
  { key: 'shadows', label: 'Shadows', min: -100, max: 100, step: 0.1, default: 0 },
  { key: 'highlights', label: 'Highlights', min: -100, max: 100, step: 0.1, default: 0 },
  { key: 'saturation', label: 'Saturation', min: 0, max: 2, step: 0.01, default: 1.0, format: v => (v * 100).toFixed(0) },
  { key: 'hue', label: 'Hue', min: -180, max: 180, step: 0.1, default: 0, format: v => v.toFixed(1) },
  { key: 'luminanceMix', label: 'Lum. Mix', min: 0, max: 1, step: 0.01, default: 1.0, format: v => (v * 100).toFixed(0) },
];

function makeSliderRow(def: SliderDef, val: number, onChange: (v: number) => void): HTMLElement {
  const row = document.createElement('div');
  row.className = 'cg-slider-row';

  const label = document.createElement('span');
  label.className = 'cg-slider-label';
  label.textContent = def.label;

  const input = document.createElement('input');
  input.type = 'range';
  input.className = 'cg-slider';
  input.min = String(def.min);
  input.max = String(def.max);
  input.step = String(def.step);
  input.value = String(val);

  const numInput = document.createElement('input');
  numInput.type = 'number';
  numInput.className = 'cg-num';
  numInput.min = String(def.min);
  numInput.max = String(def.max);
  numInput.step = String(def.step);
  const fmt = def.format ?? (v => v.toFixed(def.step < 0.01 ? 3 : def.step < 0.1 ? 2 : 1));
  numInput.value = fmt(val);

  input.addEventListener('input', () => {
    const v = parseFloat(input.value);
    numInput.value = fmt(v);
    onChange(v);
  });

  numInput.addEventListener('change', () => {
    const v = Math.max(def.min, Math.min(def.max, parseFloat(numInput.value) || def.default));
    input.value = String(v);
    numInput.value = fmt(v);
    onChange(v);
  });

  const dot = document.createElement('button');
  dot.className = 'cg-reset-dot';
  dot.title = 'Reset';
  dot.addEventListener('click', () => {
    input.value = String(def.default);
    numInput.value = fmt(def.default);
    onChange(def.default);
  });

  row.appendChild(dot);
  row.appendChild(label);
  row.appendChild(input);
  row.appendChild(numInput);
  return row;
}

export function setupColorPanel(
  el: HTMLElement,
  state: EditorState,
  onChange: () => void
) {
  el.innerHTML = '';
  el.className = 'cg-panel';

  const header = document.createElement('div');
  header.className = 'cg-header';
  header.innerHTML = `
    <span class="cg-header-title">Primaries</span>
    <span class="cg-header-right">Color Wheels</span>
  `;
  el.appendChild(header);

  const topBar = document.createElement('div');
  topBar.className = 'cg-top-bar';
  el.appendChild(topBar);

  const grid = document.createElement('div');
  grid.className = 'cg-wheels-grid';
  el.appendChild(grid);

  const hueSection = document.createElement('div');
  hueSection.className = 'cg-hue-section';
  const hueLabel = document.createElement('span');
  hueLabel.className = 'cg-hue-label';
  hueLabel.textContent = 'Hue';
  const hueCanvas = document.createElement('canvas');
  hueCanvas.className = 'cg-hue-bar';
  hueCanvas.height = 14;
  hueSection.appendChild(hueLabel);
  hueSection.appendChild(hueCanvas);
  el.appendChild(hueSection);

  const bottomBar = document.createElement('div');
  bottomBar.className = 'cg-bottom-bar';
  el.appendChild(bottomBar);

  const emptyMsg = document.createElement('div');
  emptyMsg.className = 'cg-empty';
  emptyMsg.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="9"/>
      <path d="M12 8v4l2 2"/>
    </svg>
    <p>Select a clip to apply color grading</p>
  `;
  el.appendChild(emptyMsg);

  let currentClipId: string | null = null;
  let wheels: Partial<Record<WheelKey, ColorWheelWidget>> = {};
  let topSliderEls: Partial<Record<keyof ColorGrading, HTMLInputElement>> = {};
  let bottomSliderEls: Partial<Record<keyof ColorGrading, HTMLInputElement>> = {};
  let grading: ColorGrading = defaultColorGrading();

  function getOrCreateGrading(clipId: string): ColorGrading {
    if (!state.colorGradingMap.has(clipId)) {
      state.colorGradingMap.set(clipId, defaultColorGrading());
    }
    return state.colorGradingMap.get(clipId)!;
  }

  function triggerChange() {
    if (currentClipId) {
      state.colorGradingMap.set(currentClipId, { ...grading });
    }
    onChange();
  }

  function buildUI(cg: ColorGrading) {
    topBar.innerHTML = '';
    grid.innerHTML = '';
    bottomBar.innerHTML = '';
    wheels = {};
    topSliderEls = {};
    bottomSliderEls = {};

    const wheelSize = 118;

    const wheelKeys: WheelKey[] = ['lift', 'gamma', 'gain', 'offset'];
    for (const key of wheelKeys) {
      const cell = document.createElement('div');
      cell.className = 'cg-wheel-cell';

      const cellHeader = document.createElement('div');
      cellHeader.className = 'cg-wheel-header';
      const nameEl = document.createElement('span');
      nameEl.className = 'cg-wheel-name';
      nameEl.textContent = WHEEL_LABELS[key];
      const resetBtn = document.createElement('button');
      resetBtn.className = 'cg-wheel-reset';
      resetBtn.title = 'Reset';
      resetBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`;
      cellHeader.appendChild(nameEl);
      cellHeader.appendChild(resetBtn);
      cell.appendChild(cellHeader);

      const wheelWrap = document.createElement('div');
      wheelWrap.className = 'cg-wheel-area';
      const widget = new ColorWheelWidget(wheelSize);
      const xKey = `${key}X` as keyof ColorGrading;
      const yKey = `${key}Y` as keyof ColorGrading;
      widget.set(cg[xKey] as number, cg[yKey] as number);
      widget.onChange = (x, y) => {
        (grading[xKey] as number) = x;
        (grading[yKey] as number) = y;
        updateValDisplay(cell, x, y);
        triggerChange();
      };
      resetBtn.addEventListener('click', () => {
        widget.reset();
        (grading[xKey] as number) = 0;
        (grading[yKey] as number) = 0;
        updateValDisplay(cell, 0, 0);
        triggerChange();
      });
      widget.mount(wheelWrap);
      cell.appendChild(wheelWrap);
      wheels[key] = widget;

      const valRow = document.createElement('div');
      valRow.className = 'cg-wheel-vals';
      valRow.dataset.key = key;
      const rx = cg[xKey] as number, ry = cg[yKey] as number;
      valRow.innerHTML = `
        <span>${formatVal(rx)}</span>
        <span>${formatVal(ry)}</span>
        <span>${formatVal(rx * 0.7)}</span>
        <span>${formatVal(ry * 0.5)}</span>
      `;
      cell.appendChild(valRow);

      const scrubber = document.createElement('input');
      scrubber.type = 'range';
      scrubber.className = 'cg-wheel-scrubber';
      scrubber.min = '-1'; scrubber.max = '1'; scrubber.step = '0.01'; scrubber.value = '0';
      const masterKey = `${key}Y` as keyof ColorGrading;
      scrubber.addEventListener('input', () => {
        const v = parseFloat(scrubber.value);
        const cx = (grading[xKey] as number);
        (grading[masterKey] as number) = v;
        widget.set(cx, v);
        updateValDisplay(cell, cx, v);
        triggerChange();
      });
      cell.appendChild(scrubber);
      grid.appendChild(cell);
    }

    for (const def of TOP_SLIDERS) {
      const v = cg[def.key] as number;
      const row = makeSliderRow(def, v, (val) => {
        (grading[def.key] as number) = val;
        triggerChange();
      });
      topBar.appendChild(row);
      topSliderEls[def.key] = row.querySelector('input[type="range"]') as HTMLInputElement;
    }

    hueCanvas.width = hueCanvas.parentElement?.clientWidth ?? 300;
    drawHueBar(hueCanvas);

    for (const def of BOTTOM_SLIDERS) {
      const v = cg[def.key] as number;
      const row = makeSliderRow(def, v, (val) => {
        (grading[def.key] as number) = val;
        triggerChange();
      });
      bottomBar.appendChild(row);
      bottomSliderEls[def.key] = row.querySelector('input[type="range"]') as HTMLInputElement;
    }
  }

  function updateValDisplay(cell: HTMLElement, x: number, y: number) {
    const valRow = cell.querySelector('.cg-wheel-vals') as HTMLElement;
    if (!valRow) return;
    const spans = valRow.querySelectorAll('span');
    spans[0].textContent = formatVal(x);
    spans[1].textContent = formatVal(y);
    spans[2].textContent = formatVal(x * 0.7);
    spans[3].textContent = formatVal(y * 0.5);
  }

  function setVisible(hasClip: boolean) {
    emptyMsg.style.display = hasClip ? 'none' : 'flex';
    topBar.style.display = hasClip ? 'flex' : 'none';
    grid.style.display = hasClip ? 'grid' : 'none';
    hueSection.style.display = hasClip ? 'flex' : 'none';
    bottomBar.style.display = hasClip ? 'flex' : 'none';
  }

  function refresh() {
    const sel = state.getSelectedClip();
    if (!sel) {
      currentClipId = null;
      grading = defaultColorGrading();
      setVisible(false);
      return;
    }
    const clipId = sel.editorClip.id;
    const newGrading = getOrCreateGrading(clipId);
    const isNew = clipId !== currentClipId;
    currentClipId = clipId;
    grading = { ...newGrading };
    setVisible(true);
    if (isNew) buildUI(grading);
  }

  setVisible(false);
  state.on('selection:change', refresh);
  state.on('layers:change', refresh);
  refresh();
}
