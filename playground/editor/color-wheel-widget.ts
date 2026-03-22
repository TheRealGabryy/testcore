export function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
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

export function buildWheelImageData(size: number): ImageData {
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

export class ColorWheelWidget {
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
