import * as core from '@diffusionstudio/core';
import type { EditorState } from './state';
import type { MediaItem } from './types';

function svgIcon(path: string): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
}

const MEDIA_ICONS = {
  video: svgIcon('<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 2l4 5-4 5V2z"/>'),
  audio: svgIcon('<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>'),
  image: svgIcon('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/>'),
};

function getMediaType(file: File): 'video' | 'audio' | 'image' | null {
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  if (file.type.startsWith('image/')) return 'image';
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (['mp4', 'webm', 'mov', 'avi'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'aac', 'ogg', 'm4a'].includes(ext)) return 'audio';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
  return null;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function getMediaDuration(item: MediaItem): string {
  const source = item.source as unknown as Record<string, unknown>;
  if (typeof source['duration'] === 'number') {
    return formatDuration(source['duration'] as number);
  }
  return '';
}

export function setupLeftPanel(el: HTMLElement, state: EditorState) {
  el.innerHTML = `
    <div class="assets-header">
      <span class="assets-title">Assets</span>
      <div class="assets-header-actions">
        <button class="assets-icon-btn" id="assets-list-view" title="List view">
          ${svgIcon('<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>')}
        </button>
        <button class="assets-icon-btn" id="assets-sort-btn" title="Sort">
          ${svgIcon('<line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="9" y1="18" x2="15" y2="18"/>')}
        </button>
        <button class="assets-import-btn" id="assets-import-btn">
          ${svgIcon('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>')}
          Import
        </button>
      </div>
    </div>
    <div class="assets-body" id="assets-body"></div>
    <input type="file" id="file-input" style="display:none" multiple accept="video/*,audio/*,image/*" />
  `;

  const assetsBody = el.querySelector('#assets-body') as HTMLDivElement;
  const importBtn = el.querySelector('#assets-import-btn') as HTMLButtonElement;
  const fileInput = el.querySelector('#file-input') as HTMLInputElement;

  function renderAssets() {
    if (state.mediaItems.length === 0) {
      assetsBody.innerHTML = `
        <div class="assets-drop-zone" id="assets-drop-zone">
          ${svgIcon('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>')}
          <p><strong>Drop files here</strong></p>
          <p>or click Import</p>
        </div>
      `;
      const dropZone = assetsBody.querySelector('#assets-drop-zone') as HTMLDivElement;
      attachDropHandlers(dropZone);
      return;
    }

    assetsBody.innerHTML = `
      <div class="assets-grid" id="assets-drop-zone">
        ${state.mediaItems.map(item => {
          const duration = getMediaDuration(item);
          return `
            <div class="asset-card" data-media-id="${item.id}" title="${item.name}">
              <div class="asset-thumb type-${item.type}">
                ${item.type === 'image' && item.objectUrl
                  ? `<img src="${item.objectUrl}" alt="${item.name}" />`
                  : MEDIA_ICONS[item.type]}
                ${duration ? `<span class="asset-duration">${duration}</span>` : ''}
                <div class="asset-card-overlay">
                  <button class="asset-add-btn" data-media-id="${item.id}" title="Add to timeline">
                    ${svgIcon('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>')}
                  </button>
                </div>
              </div>
              <span class="asset-name">${item.name}</span>
            </div>
          `;
        }).join('')}
      </div>
    `;

    const dropZone = assetsBody.querySelector('#assets-drop-zone') as HTMLDivElement;
    attachDropHandlers(dropZone);

    assetsBody.querySelectorAll('.asset-add-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const mediaId = (btn as HTMLElement).dataset.mediaId!;
        const item = state.mediaItems.find(m => m.id === mediaId);
        if (!item) return;
        await addMediaToTimeline(item);
      });
    });
  }

  function attachDropHandlers(zone: HTMLElement) {
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('drag-over');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      if (e.dataTransfer?.files) handleFiles(e.dataTransfer.files);
    });
  }

  async function addMediaToTimeline(item: MediaItem) {
    let targetLayerId = state.selectedLayerId;
    if (!targetLayerId || !state.editorLayers.find(l => l.id === targetLayerId)) {
      const newLayer = await state.addLayer(item.name.split('.')[0]);
      targetLayerId = newLayer.id;
    }

    const delay = state.composition.currentTime;

    let clip: core.Clip;
    if (item.type === 'video') {
      clip = new core.VideoClip(item.source as core.VideoSource, {
        position: 'center',
        height: '100%',
        delay,
      });
    } else if (item.type === 'audio') {
      clip = new core.AudioClip(item.source as core.AudioSource, { delay });
    } else {
      clip = new core.ImageClip(item.source as core.ImageSource, {
        position: 'center',
        height: '80%',
        delay,
        duration: 5,
      });
    }

    await state.addClipToLayer(targetLayerId, clip, item.name.split('.')[0]);
  }

  async function handleFiles(files: FileList) {
    for (const file of Array.from(files)) {
      const type = getMediaType(file);
      if (!type) continue;
      const objectUrl = URL.createObjectURL(file);
      let source: core.BaseSource;
      if (type === 'video') {
        source = await core.Source.from<core.VideoSource>(objectUrl);
      } else if (type === 'audio') {
        source = await core.Source.from<core.AudioSource>(objectUrl);
      } else {
        source = await core.Source.from<core.ImageSource>(objectUrl);
      }
      state.addMediaItem({
        id: crypto.randomUUID(),
        name: file.name,
        type,
        source,
        objectUrl: type === 'image' ? objectUrl : undefined,
      });
    }
  }

  importBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    if (fileInput.files) handleFiles(fileInput.files);
    fileInput.value = '';
  });

  state.on('media:change', renderAssets);

  renderAssets();
}
