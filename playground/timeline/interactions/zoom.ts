import type { TimelineView } from '../view';

export function setupZoom(
  el: HTMLElement,
  view: TimelineView,
  onZoomChange: () => void,
): void {
  el.addEventListener('wheel', (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.85 : 1.18;
    view.setZoom(view.zoom * factor);
    onZoomChange();
  }, { passive: false });
}
