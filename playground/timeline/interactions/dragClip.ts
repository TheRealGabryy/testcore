import type { TimelineState } from '../state';
import type { TimelineView } from '../view';
import { xToTime } from '../timeMapping';

export function setupDragClip(
  tracksEl: HTMLElement,
  state: TimelineState,
  view: TimelineView,
  onClipSelect: (id: string | null) => void,
): void {
  let dragging = false;
  let clipId: string | null = null;
  let startMouseX = 0;
  let startClipStart = 0;

  tracksEl.addEventListener('mousedown', (e) => {
    const target = (e.target as HTMLElement).closest('.tl-clip') as HTMLElement | null;
    if (!target) { onClipSelect(null); return; }

    const id = target.dataset.clipId ?? null;
    onClipSelect(id);
    if (!id) return;

    const clip = findClip(id);
    if (!clip) return;

    dragging = true;
    clipId = id;
    startMouseX = e.clientX;
    startClipStart = clip.start;
    target.classList.add('dragging');
    e.preventDefault();
  });

  window.addEventListener('mousemove', (e) => {
    if (!dragging || !clipId) return;
    const dx = e.clientX - startMouseX;
    const dt = xToTime(dx, view.zoom);
    state.updateClipStart(clipId, startClipStart + dt);
  });

  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    if (clipId) {
      tracksEl.querySelector(`[data-clip-id="${clipId}"]`)?.classList.remove('dragging');
    }
    clipId = null;
  });

  function findClip(id: string) {
    for (const track of state.tracks) {
      const c = track.clips.find(cl => cl.id === id);
      if (c) return c;
    }
    return null;
  }
}
