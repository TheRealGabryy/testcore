import type { TimelineState } from '../state';
import type { TimelineView } from '../view';
import type { PlaybackController } from '../playback';
import { xToTime } from '../timeMapping';

export function setupMovePlayhead(
  rulerEl: HTMLElement,
  contentEl: HTMLElement,
  state: TimelineState,
  view: TimelineView,
  playback: PlaybackController,
): void {
  let dragging = false;

  function getTimeFromEvent(e: MouseEvent): number {
    const rect = contentEl.getBoundingClientRect();
    const x = e.clientX - rect.left + contentEl.scrollLeft;
    return Math.max(0, Math.min(xToTime(x, view.zoom), state.duration));
  }

  rulerEl.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    dragging = true;
    playback.seekTo(getTimeFromEvent(e));
    e.preventDefault();
  });

  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    playback.seekTo(getTimeFromEvent(e));
  });

  window.addEventListener('mouseup', () => {
    dragging = false;
  });
}
