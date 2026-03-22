export class TimelineView {
  zoom = 80; // pixels per second
  scrollX = 0;
  scrollY = 0;

  readonly RULER_HEIGHT = 24;
  readonly TRACK_HEIGHT = 34;
  readonly HEADER_WIDTH = 164;

  get pixelsPerSecond(): number { return this.zoom; }

  setZoom(z: number): void {
    this.zoom = Math.max(10, Math.min(1000, z));
  }

  setScrollX(x: number): void { this.scrollX = Math.max(0, x); }
  setScrollY(y: number): void { this.scrollY = Math.max(0, y); }
}
