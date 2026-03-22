import { ColorWheelWidget } from './color-wheel-widget';
import type { ColorGrading } from './color-grading';

type WheelId = 'shad' | 'mid' | 'hi' | 'off';

const WHEEL_DEFS: { id: WheelId; label: string; desc: string }[] = [
  { id: 'shad', label: 'Shadows',    desc: 'Dark tones' },
  { id: 'mid',  label: 'Midtones',   desc: 'Mid tones'  },
  { id: 'hi',   label: 'Highlights', desc: 'Bright tones' },
  { id: 'off',  label: 'Offset',     desc: 'Global shift' },
];

function makeSlider(
  label: string,
  min: number, max: number, step: number, val: number,
  onInput: (v: number) => void
): { el: HTMLElement; update: (v: number) => void } {
  const row = document.createElement('div');
  row.className = 'wh-luma-row';

  const lbl = document.createElement('span');
  lbl.className = 'wh-luma-label';
  lbl.textContent = label;

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'wh-luma-slider';
  slider.min = String(min); slider.max = String(max); slider.step = String(step);
  slider.value = String(val);

  const num = document.createElement('input');
  num.type = 'number';
  num.className = 'cg-num';
  num.min = String(min); num.max = String(max); num.step = String(step);
  num.value = val.toFixed(1);

  slider.addEventListener('input', () => {
    const v = parseFloat(slider.value);
    num.value = v.toFixed(1);
    onInput(v);
  });
  num.addEventListener('change', () => {
    const v = Math.max(min, Math.min(max, parseFloat(num.value) || 0));
    slider.value = String(v); num.value = v.toFixed(1);
    onInput(v);
  });

  row.appendChild(lbl); row.appendChild(slider); row.appendChild(num);
  return {
    el: row,
    update(v: number) { slider.value = String(v); num.value = v.toFixed(1); }
  };
}

function makeWheelCell(
  def: { id: WheelId; label: string; desc: string },
  cg: ColorGrading,
  triggerChange: () => void
): { el: HTMLElement; refresh: () => void } {
  const cell = document.createElement('div');
  cell.className = 'wh-cell';

  const header = document.createElement('div');
  header.className = 'cg-wheel-header';
  const name = document.createElement('span');
  name.className = 'cg-wheel-name';
  name.textContent = def.label;
  const desc = document.createElement('span');
  desc.className = 'wh-cell-desc';
  desc.textContent = def.desc;
  const resetBtn = document.createElement('button');
  resetBtn.className = 'cg-wheel-reset';
  resetBtn.title = 'Reset';
  resetBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`;
  header.appendChild(name); header.appendChild(desc); header.appendChild(resetBtn);
  cell.appendChild(header);

  const wheelWrap = document.createElement('div');
  wheelWrap.className = 'cg-wheel-area';
  const xKey = `${def.id}WX` as keyof ColorGrading;
  const yKey = `${def.id}WY` as keyof ColorGrading;
  const lumaKey = `${def.id}WLuma` as keyof ColorGrading;

  const widget = new ColorWheelWidget(110);
  widget.set(cg[xKey] as number, cg[yKey] as number);
  widget.onChange = (x, y) => {
    (cg[xKey] as any) = x;
    (cg[yKey] as any) = y;
    triggerChange();
  };
  widget.mount(wheelWrap);
  cell.appendChild(wheelWrap);

  const lumaControl = makeSlider('Luminance', -50, 50, 0.5, cg[lumaKey] as number, (v) => {
    (cg[lumaKey] as any) = v;
    triggerChange();
  });
  cell.appendChild(lumaControl.el);

  resetBtn.addEventListener('click', () => {
    widget.reset();
    (cg[xKey] as any) = 0; (cg[yKey] as any) = 0; (cg[lumaKey] as any) = 0;
    lumaControl.update(0);
    triggerChange();
  });

  return {
    el: cell,
    refresh() {
      widget.set(cg[xKey] as number, cg[yKey] as number);
      lumaControl.update(cg[lumaKey] as number);
    }
  };
}

export function setupWheelsTab(
  el: HTMLElement,
  getGrading: () => ColorGrading,
  onChange: () => void
) {
  el.innerHTML = '';
  el.className = 'wh-tab';

  const label = document.createElement('div');
  label.className = 'wh-tab-label';
  label.textContent = 'Color Wheels';
  el.appendChild(label);

  const grid = document.createElement('div');
  grid.className = 'wh-grid';
  el.appendChild(grid);

  const cells: Array<{ el: HTMLElement; refresh: () => void }> = [];

  function buildCells() {
    grid.innerHTML = '';
    cells.length = 0;
    const cg = getGrading();
    for (const def of WHEEL_DEFS) {
      const cell = makeWheelCell(def, cg, onChange);
      grid.appendChild(cell.el);
      cells.push(cell);
    }
  }

  buildCells();

  return {
    refresh() {
      cells.forEach(c => c.refresh());
    }
  };
}
