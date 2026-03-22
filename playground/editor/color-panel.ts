import type { EditorState } from './state';
import { defaultColorGrading, type ColorGrading } from './color-grading';
import { ColorWheelWidget } from './color-wheel-widget';
import { hsvToRgb } from './color-wheel-widget';
import { setupCurvesTab } from './color-panel-curves';
import { setupWheelsTab } from './color-panel-wheels';
import { setupHslTab } from './color-panel-hsl';

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
  { key: 'tint',        label: 'Tint',        min: -100, max: 100, step: 0.01, default: 0 },
  { key: 'contrast',    label: 'Contrast',    min: 0.5,  max: 2.0, step: 0.001, default: 1.0 },
  { key: 'pivot',       label: 'Pivot',       min: 0,    max: 1,   step: 0.001, default: 0.435 },
  { key: 'midtoneDetail', label: 'Midtone Detail', min: -100, max: 100, step: 0.1, default: 0 },
];

const BOTTOM_SLIDERS: SliderDef[] = [
  { key: 'colorBoost',  label: 'Color Boost',  min: 0,    max: 100, step: 0.1, default: 0 },
  { key: 'shadows',     label: 'Shadows',      min: -100, max: 100, step: 0.1, default: 0 },
  { key: 'highlights',  label: 'Highlights',   min: -100, max: 100, step: 0.1, default: 0 },
  { key: 'saturation',  label: 'Saturation',   min: 0,    max: 2,   step: 0.01, default: 1.0, format: v => (v * 100).toFixed(0) },
  { key: 'hue',         label: 'Hue',          min: -180, max: 180, step: 0.1, default: 0, format: v => v.toFixed(1) },
  { key: 'luminanceMix', label: 'Lum. Mix',    min: 0,    max: 1,   step: 0.01, default: 1.0, format: v => (v * 100).toFixed(0) },
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
  input.min = String(def.min); input.max = String(def.max);
  input.step = String(def.step); input.value = String(val);

  const numInput = document.createElement('input');
  numInput.type = 'number';
  numInput.className = 'cg-num';
  numInput.min = String(def.min); numInput.max = String(def.max); numInput.step = String(def.step);
  const fmt = def.format ?? (v => v.toFixed(def.step < 0.01 ? 3 : def.step < 0.1 ? 2 : 1));
  numInput.value = fmt(val);

  input.addEventListener('input', () => {
    const v = parseFloat(input.value);
    numInput.value = fmt(v);
    onChange(v);
  });
  numInput.addEventListener('change', () => {
    const v = Math.max(def.min, Math.min(def.max, parseFloat(numInput.value) || def.default));
    input.value = String(v); numInput.value = fmt(v);
    onChange(v);
  });

  const dot = document.createElement('button');
  dot.className = 'cg-reset-dot'; dot.title = 'Reset';
  dot.addEventListener('click', () => {
    input.value = String(def.default); numInput.value = fmt(def.default);
    onChange(def.default);
  });

  row.appendChild(dot); row.appendChild(label); row.appendChild(input); row.appendChild(numInput);
  return row;
}

function setupBasicTab(
  el: HTMLElement,
  getGrading: () => ColorGrading,
  onChange: () => void
): { refresh: () => void } {
  el.innerHTML = '';
  el.className = 'cg-basic-tab';

  let wheels: Partial<Record<WheelKey, ColorWheelWidget>> = {};

  const topBar = document.createElement('div');
  topBar.className = 'cg-top-bar';

  const grid = document.createElement('div');
  grid.className = 'cg-wheels-grid';

  const hueSection = document.createElement('div');
  hueSection.className = 'cg-hue-section';
  const hueLabel = document.createElement('span');
  hueLabel.className = 'cg-hue-label'; hueLabel.textContent = 'Hue';
  const hueCanvas = document.createElement('canvas');
  hueCanvas.className = 'cg-hue-bar'; hueCanvas.height = 14;
  hueSection.appendChild(hueLabel); hueSection.appendChild(hueCanvas);

  const bottomBar = document.createElement('div');
  bottomBar.className = 'cg-bottom-bar';

  el.appendChild(topBar); el.appendChild(grid);
  el.appendChild(hueSection); el.appendChild(bottomBar);

  function buildWheel(key: WheelKey, cg: ColorGrading) {
    const xKey = `${key}X` as keyof ColorGrading;
    const yKey = `${key}Y` as keyof ColorGrading;
    const cell = document.createElement('div');
    cell.className = 'cg-wheel-cell';

    const cellHeader = document.createElement('div');
    cellHeader.className = 'cg-wheel-header';
    const nameEl = document.createElement('span');
    nameEl.className = 'cg-wheel-name';
    nameEl.textContent = WHEEL_LABELS[key];
    const resetBtn = document.createElement('button');
    resetBtn.className = 'cg-wheel-reset'; resetBtn.title = 'Reset';
    resetBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`;
    cellHeader.appendChild(nameEl); cellHeader.appendChild(resetBtn);
    cell.appendChild(cellHeader);

    const wheelWrap = document.createElement('div');
    wheelWrap.className = 'cg-wheel-area';
    const widget = new ColorWheelWidget(118);
    widget.set(cg[xKey] as number, cg[yKey] as number);
    widget.onChange = (x, y) => {
      (getGrading()[xKey] as any) = x;
      (getGrading()[yKey] as any) = y;
      updateValDisplay(cell, x, y);
      onChange();
    };
    resetBtn.addEventListener('click', () => {
      widget.reset();
      (getGrading()[xKey] as any) = 0; (getGrading()[yKey] as any) = 0;
      updateValDisplay(cell, 0, 0); onChange();
    });
    widget.mount(wheelWrap);
    cell.appendChild(wheelWrap);
    wheels[key] = widget;

    const valRow = document.createElement('div');
    valRow.className = 'cg-wheel-vals';
    valRow.innerHTML = `<span>${formatVal(cg[xKey] as number)}</span><span>${formatVal(cg[yKey] as number)}</span><span>${formatVal((cg[xKey] as number) * 0.7)}</span><span>${formatVal((cg[yKey] as number) * 0.5)}</span>`;
    cell.appendChild(valRow);

    const scrubber = document.createElement('input');
    scrubber.type = 'range'; scrubber.className = 'cg-wheel-scrubber';
    scrubber.min = '-1'; scrubber.max = '1'; scrubber.step = '0.01'; scrubber.value = '0';
    const masterKey = `${key}Y` as keyof ColorGrading;
    scrubber.addEventListener('input', () => {
      const v = parseFloat(scrubber.value);
      const cx = getGrading()[xKey] as number;
      (getGrading()[masterKey] as any) = v;
      widget.set(cx, v);
      updateValDisplay(cell, cx, v); onChange();
    });
    cell.appendChild(scrubber);
    grid.appendChild(cell);
  }

  function updateValDisplay(cell: HTMLElement, x: number, y: number) {
    const spans = cell.querySelectorAll('.cg-wheel-vals span');
    if (spans[0]) spans[0].textContent = formatVal(x);
    if (spans[1]) spans[1].textContent = formatVal(y);
    if (spans[2]) spans[2].textContent = formatVal(x * 0.7);
    if (spans[3]) spans[3].textContent = formatVal(y * 0.5);
  }

  function buildUI(cg: ColorGrading) {
    topBar.innerHTML = ''; grid.innerHTML = ''; bottomBar.innerHTML = '';
    wheels = {};

    (['lift','gamma','gain','offset'] as WheelKey[]).forEach(k => buildWheel(k, cg));

    for (const def of TOP_SLIDERS) {
      const row = makeSliderRow(def, cg[def.key] as number, (val) => {
        (getGrading()[def.key] as any) = val; onChange();
      });
      topBar.appendChild(row);
    }

    hueCanvas.width = hueCanvas.parentElement?.clientWidth ?? 300;
    drawHueBar(hueCanvas);

    for (const def of BOTTOM_SLIDERS) {
      const row = makeSliderRow(def, cg[def.key] as number, (val) => {
        (getGrading()[def.key] as any) = val; onChange();
      });
      bottomBar.appendChild(row);
    }
  }

  return {
    refresh() {
      buildUI(getGrading());
    }
  };
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
  header.innerHTML = `<span class="cg-header-title">Color Grading</span>`;
  el.appendChild(header);

  const subTabBar = document.createElement('div');
  subTabBar.className = 'cg-subtabs';
  const SUB_TABS = [
    { key: 'basic',  label: 'Basic'  },
    { key: 'curves', label: 'Curves' },
    { key: 'wheels', label: 'Wheels' },
    { key: 'hsl',    label: 'HSL'    },
  ];
  const subTabBtns: HTMLButtonElement[] = [];
  SUB_TABS.forEach(t => {
    const btn = document.createElement('button');
    btn.className = 'cg-subtab';
    btn.dataset.tab = t.key;
    btn.textContent = t.label;
    subTabBtns.push(btn);
    subTabBar.appendChild(btn);
  });
  el.appendChild(subTabBar);

  const contentArea = document.createElement('div');
  contentArea.className = 'cg-content-area';
  el.appendChild(contentArea);

  const emptyMsg = document.createElement('div');
  emptyMsg.className = 'cg-empty';
  emptyMsg.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4l2 2"/></svg>
    <p>Select a clip to apply color grading</p>
  `;
  contentArea.appendChild(emptyMsg);

  const basicEl = document.createElement('div');
  const curvesEl = document.createElement('div');
  const wheelsEl = document.createElement('div');
  const hslEl = document.createElement('div');

  contentArea.appendChild(basicEl);
  contentArea.appendChild(curvesEl);
  contentArea.appendChild(wheelsEl);
  contentArea.appendChild(hslEl);

  let currentClipId: string | null = null;
  let grading: ColorGrading = defaultColorGrading();
  let activeSubTab = 'basic';

  let basicCtrl: { refresh: () => void } | null = null;
  let curvesCtrl: { refresh: () => void } | null = null;
  let wheelsCtrl: { refresh: () => void } | null = null;
  let hslCtrl: { refresh: () => void } | null = null;

  function getOrCreateGrading(clipId: string): ColorGrading {
    if (!state.colorGradingMap.has(clipId)) {
      state.colorGradingMap.set(clipId, defaultColorGrading());
    }
    return state.colorGradingMap.get(clipId)!;
  }

  function triggerChange() {
    if (currentClipId) state.colorGradingMap.set(currentClipId, { ...grading });
    onChange();
  }

  function getGrading(): ColorGrading {
    return grading;
  }

  function activateTab(key: string) {
    activeSubTab = key;
    subTabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === key));
    basicEl.style.display  = key === 'basic'  ? '' : 'none';
    curvesEl.style.display = key === 'curves' ? '' : 'none';
    wheelsEl.style.display = key === 'wheels' ? '' : 'none';
    hslEl.style.display    = key === 'hsl'    ? '' : 'none';
    if (key === 'hsl') hslCtrl?.refresh();
  }

  subTabBtns.forEach(btn => {
    btn.addEventListener('click', () => activateTab(btn.dataset.tab!));
  });

  function setVisible(hasClip: boolean) {
    emptyMsg.style.display = hasClip ? 'none' : 'flex';
    subTabBar.style.display = hasClip ? '' : 'none';
    basicEl.style.display  = hasClip && activeSubTab === 'basic'  ? '' : hasClip ? 'none' : 'none';
    curvesEl.style.display = hasClip && activeSubTab === 'curves' ? '' : 'none';
    wheelsEl.style.display = hasClip && activeSubTab === 'wheels' ? '' : 'none';
    hslEl.style.display    = hasClip && activeSubTab === 'hsl'    ? '' : 'none';
    if (!hasClip) { basicEl.style.display = 'none'; }
  }

  function buildPanels() {
    basicCtrl = setupBasicTab(basicEl, getGrading, triggerChange);
    curvesCtrl = setupCurvesTab(curvesEl, getGrading, triggerChange);
    wheelsCtrl = setupWheelsTab(wheelsEl, getGrading, triggerChange);
    hslCtrl = setupHslTab(hslEl, getGrading, triggerChange);
    activateTab(activeSubTab);
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
    grading = newGrading;
    setVisible(true);
    if (isNew) {
      buildPanels();
    } else {
      basicCtrl?.refresh();
      curvesCtrl?.refresh();
      wheelsCtrl?.refresh();
      hslCtrl?.refresh();
      activateTab(activeSubTab);
    }
  }

  setVisible(false);
  subTabBar.style.display = 'none';
  state.on('selection:change', refresh);
  state.on('layers:change', refresh);
  refresh();
}
