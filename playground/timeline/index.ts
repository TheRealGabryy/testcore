import type { EditorState } from '../editor/state';
import { TimelineState } from './state';
import { TimelineView } from './view';
import { PlaybackController } from './playback';
import { TimelineRenderer } from './renderer';
import { setupMovePlayhead } from './interactions/movePlayhead';
import { setupDragClip } from './interactions/dragClip';
import { setupZoom } from './interactions/zoom';

export function setupProfessionalTimeline(
  controlsEl: HTMLElement,
  areaEl: HTMLElement,
  editorState: EditorState,
): void {
  const composition = editorState.composition;
  const tlState = new TimelineState();
  const tlView = new TimelineView();
  const playback = new PlaybackController(tlState, composition);
  const renderer = new TimelineRenderer(areaEl, tlState, tlView);

  // Mount DOM
  renderer.mount();

  // Sync from editor state
  function syncAndRender(): void {
    tlState.syncFromEditor(editorState.editorLayers, composition.duration || 30);
    renderer.renderAll();
  }

  // Setup interactions
  setupMovePlayhead(renderer.getRulerEl(), renderer.getContentEl(), tlState, tlView, playback);
  setupDragClip(renderer.getTracksEl(), tlState, tlView, (id) => {
    editorState.selectClip(id);
    renderer.setSelectedClip(id);
  });
  setupZoom(renderer.getContentEl(), tlView, () => {
    const zr = renderer.getZoomRange();
    zr.value = String(tlView.zoom);
    renderer.getZoomLabel().textContent = `${Math.round(tlView.zoom)}px/s`;
    renderer.updateZoomDisplay();
  });

  // Playback buttons
  const playBtn = renderer.getPlayBtn();
  const playIconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21"/></svg>`;
  const pauseIconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;

  function updatePlayBtn(): void {
    playBtn.innerHTML = tlState.playing ? pauseIconSvg : playIconSvg;
    playBtn.classList.toggle('active', tlState.playing);
  }

  playBtn.addEventListener('click', () => { playback.toggle(); });
  renderer.getStartBtn().addEventListener('click', () => playback.seekTo(0));
  renderer.getEndBtn().addEventListener('click', () => playback.seekTo(tlState.duration));

  // Zoom slider
  const zr = renderer.getZoomRange();
  zr.addEventListener('input', () => {
    tlView.setZoom(parseInt(zr.value));
    renderer.getZoomLabel().textContent = `${tlView.zoom}px/s`;
    renderer.updateZoomDisplay();
  });

  // Timeline state events
  tlState.on('time:change', () => {
    renderer.updatePlayhead();
    // keep editor's playback-bar timecode in sync too
    const timeDisplay = document.querySelector('#time-display');
    if (timeDisplay) timeDisplay.textContent = composition.time();
  });

  tlState.on('playing:change', updatePlayBtn);
  tlState.on('tracks:change', () => renderer.renderAll());

  // Editor state events
  editorState.on('layers:change', syncAndRender);
  editorState.on('timeline:change', syncAndRender);
  editorState.on('selection:change', () => {
    renderer.setSelectedClip(editorState.selectedClipId);
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.code === 'Space') {
      e.preventDefault();
      playback.toggle();
    }
    if (e.code === 'Home') { e.preventDefault(); playback.seekTo(0); }
    if (e.code === 'End') { e.preventDefault(); playback.seekTo(tlState.duration); }
  });

  // Initial render
  syncAndRender();

  // Hide the old controls bar since the new timeline toolbar has its own controls
  controlsEl.style.display = 'none';
}
