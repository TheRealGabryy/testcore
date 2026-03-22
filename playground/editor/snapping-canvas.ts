export interface SnapGuide {
  axis: 'x' | 'y';
  position: number;
  start: number;
  end: number;
}

export interface CanvasSnapResult {
  x: number;
  y: number;
  guides: SnapGuide[];
}

export interface ClipBoundsInfo {
  left: number;
  right: number;
  top: number;
  bottom: number;
  cx: number;
  cy: number;
}

interface SnapTarget {
  pos: number;
  guideStart: number;
  guideEnd: number;
}

export class CanvasSnappingEngine {
  private compW: number;
  private compH: number;
  public snapDist: number;

  constructor(compW: number, compH: number, snapDist = 8) {
    this.compW = compW;
    this.compH = compH;
    this.snapDist = snapDist;
  }

  update(compW: number, compH: number): void {
    this.compW = compW;
    this.compH = compH;
  }

  boundsOf(x: number, y: number, w: number, h: number, ax: number, ay: number): ClipBoundsInfo {
    const left = x - w * ax;
    const top  = y  - h * ay;
    return {
      left,
      right:  left + w,
      top,
      bottom: top  + h,
      cx:     left + w / 2,
      cy:     top  + h / 2,
    };
  }

  resolve(
    rawX: number, rawY: number,
    w: number, h: number, ax: number, ay: number,
    others: ClipBoundsInfo[]
  ): CanvasSnapResult {
    const b = this.boundsOf(rawX, rawY, w, h, ax, ay);

    const fullH = this.compH;
    const fullW = this.compW;

    const xTargets: SnapTarget[] = [
      { pos: 0,           guideStart: 0,     guideEnd: fullH },
      { pos: fullW / 2,   guideStart: 0,     guideEnd: fullH },
      { pos: fullW,       guideStart: 0,     guideEnd: fullH },
      ...others.flatMap(o => [
        { pos: o.left,  guideStart: Math.min(b.top,    o.top),    guideEnd: Math.max(b.bottom, o.bottom) },
        { pos: o.right, guideStart: Math.min(b.top,    o.top),    guideEnd: Math.max(b.bottom, o.bottom) },
        { pos: o.cx,    guideStart: Math.min(b.top,    o.top),    guideEnd: Math.max(b.bottom, o.bottom) },
      ]),
    ];

    const yTargets: SnapTarget[] = [
      { pos: 0,           guideStart: 0,     guideEnd: fullW },
      { pos: fullH / 2,   guideStart: 0,     guideEnd: fullW },
      { pos: fullH,       guideStart: 0,     guideEnd: fullW },
      ...others.flatMap(o => [
        { pos: o.top,    guideStart: Math.min(b.left, o.left),  guideEnd: Math.max(b.right, o.right) },
        { pos: o.bottom, guideStart: Math.min(b.left, o.left),  guideEnd: Math.max(b.right, o.right) },
        { pos: o.cy,     guideStart: Math.min(b.left, o.left),  guideEnd: Math.max(b.right, o.right) },
      ]),
    ];

    const { x: snappedX, guide: xGuide } = this.snapAxis(rawX, w, ax, b.left, b.right, b.cx, xTargets, 'x');
    const { x: snappedY, guide: yGuide } = this.snapAxis(rawY, h, ay, b.top, b.bottom, b.cy, yTargets, 'y');

    const guides: SnapGuide[] = [];
    if (xGuide) guides.push(xGuide);
    if (yGuide) guides.push(yGuide);

    return { x: snappedX, y: snappedY, guides };
  }

  private snapAxis(
    rawPos: number,
    size: number,
    anchor: number,
    edgeA: number,
    edgeB: number,
    center: number,
    targets: SnapTarget[],
    axis: 'x' | 'y'
  ): { x: number; guide: SnapGuide | null } {
    let bestDist = this.snapDist;
    let snapped = rawPos;
    let bestGuide: SnapGuide | null = null;

    for (const t of targets) {
      const candidates: Array<{ dist: number; required: number }> = [
        { dist: Math.abs(edgeA  - t.pos), required: t.pos + size * anchor },
        { dist: Math.abs(edgeB  - t.pos), required: t.pos - size + size * anchor },
        { dist: Math.abs(center - t.pos), required: t.pos - size / 2 + size * anchor },
      ];

      for (const c of candidates) {
        if (c.dist < bestDist) {
          bestDist = c.dist;
          snapped = c.required;
          bestGuide = { axis, position: t.pos, start: t.guideStart, end: t.guideEnd };
        }
      }
    }

    return { x: snapped, guide: bestGuide };
  }
}
