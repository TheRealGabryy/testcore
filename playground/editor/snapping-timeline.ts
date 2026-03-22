import type { EditorState } from './state';

export interface TimelineSnapResult {
  time: number;
  snapped: boolean;
  snapTime: number | null;
}

export class TimelineSnappingEngine {
  private snapSeconds: number;

  constructor(fps = 30, snapFrames = 2) {
    this.snapSeconds = snapFrames / fps;
  }

  update(fps: number, snapFrames = 2): void {
    this.snapSeconds = snapFrames / fps;
  }

  resolve(rawTime: number, targets: number[]): TimelineSnapResult {
    let bestDist = this.snapSeconds;
    let snappedTime = rawTime;
    let snapTime: number | null = null;

    for (const target of targets) {
      const dist = Math.abs(rawTime - target);
      if (dist < bestDist) {
        bestDist = dist;
        snappedTime = target;
        snapTime = target;
      }
    }

    return { time: snappedTime, snapped: snapTime !== null, snapTime };
  }

  collectTargets(state: EditorState, excludeClipId?: string): number[] {
    const targets: number[] = [];
    for (const layer of state.editorLayers) {
      for (const ec of layer.clips) {
        if (ec.id === excludeClipId) continue;
        targets.push(ec.clip.delay);
        targets.push(ec.clip.delay + ec.clip.duration);
      }
    }
    targets.push(state.composition.currentTime);
    return targets;
  }
}
