import type { TimelineState } from './state';
import type * as core from '@diffusionstudio/core';

export class PlaybackController {
  private rafId: number | null = null;
  private lastTimestamp: number | null = null;
  private state: TimelineState;
  private composition: core.Composition;

  constructor(
    state: TimelineState,
    composition: core.Composition,
  ) {
    this.state = state;
    this.composition = composition;
  }

  play(): void {
    if (this.state.playing) return;
    this.state.setPlaying(true);
    this.lastTimestamp = null;
    this.tick();
  }

  pause(): void {
    this.state.setPlaying(false);
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.lastTimestamp = null;
  }

  toggle(): void {
    if (this.state.playing) this.pause();
    else this.play();
  }

  seekTo(time: number): void {
    const wasPlaying = this.state.playing;
    if (wasPlaying) this.pause();
    this.state.setCurrentTime(time);
    this.composition.seek(time).catch(() => {});
    if (wasPlaying) this.play();
    else this.composition.seek(time).catch(() => {});
  }

  private tick(): void {
    this.rafId = requestAnimationFrame((ts) => {
      if (!this.state.playing) return;

      if (this.lastTimestamp !== null) {
        const delta = (ts - this.lastTimestamp) / 1000;
        const next = this.state.currentTime + delta;

        if (next >= this.state.duration) {
          this.state.setCurrentTime(0);
          this.composition.seek(0).catch(() => {});
          this.pause();
          return;
        }

        this.state.setCurrentTime(next);
        this.composition.seek(next).catch(() => {});
      }

      this.lastTimestamp = ts;
      this.tick();
    });
  }

  destroy(): void {
    this.pause();
  }
}
