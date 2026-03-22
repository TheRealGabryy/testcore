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

export function setupLeftPanel(el: HTMLElement, state: EditorState) {
  el.innerHTML = `
    <div class="panel-tabs">
      <button class="panel-tab active" data-tab="layers">Layers</button>
      <button class="panel-tab" data-tab="media">Media</button>
    </div>
    <div class="tab-content" id="tab-layers">
      <div class="panel-search">
        <input class="search-input" id="layer-search" type="text" placeholder="Search layers..." />
      </div>
      <div class="layers-list" id="layers-list"></div>
      <div class="layers-footer">
        <button id="add-layer-btn">
          ${svgIcon('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>')}
          Add Layer
        </button>
      </div>
    </div>
    <div class="tab-content hidden" id="tab-media">
      <div class="media-import-area" id="media-import-area">
        ${svgIcon('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>')}
        <p><strong>Click to import</strong> or drag &amp; drop<br/>Video, audio, and image files</p>
      </div>
      <div class="media-list" id="media-list"></div>
    </div>
    <input type="file" id="file-input" style="display:none" multiple accept="video/*,audio/*,image/*" />
  `;

  const tabButtons = el.querySelectorAll('.panel-tab');
  const tabContents = el.querySelectorAll('.tab-content');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = (btn as HTMLElement).dataset.tab;
      tabButtons.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.add('hidden'));
      btn.classList.add('active');
      el.querySelector(`#tab-${target}`)?.classList.remove('hidden');
    });
  });

  const layersList = el.querySelector('#layers-list') as HTMLDivElement;
  const mediaList = el.querySelector('#media-list') as HTMLDivElement;
  const addLayerBtn = el.querySelector('#add-layer-btn') as HTMLButtonElement;
  const importArea = el.querySelector('#media-import-area') as HTMLDivElement;
  const fileInput = el.querySelector('#file-input') as HTMLInputElement;

  function renderLayers() {
    if (state.editorLayers.length === 0) {
      layersList.innerHTML = `<div class="empty-state">
        ${svgIcon('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/>')}
        <p>No layers yet.<br/>Add a layer to start.</p>
      </div>`;
      return;
    }
    const search = (el.querySelector('#layer-search') as HTMLInputElement).value.toLowerCase();
    const filtered = state.editorLayers.filter(l => !search || l.name.toLowerCase().includes(search));
    layersList.innerHTML = filtered.map(l => `
      <div class="layer-row${l.id === state.selectedLayerId ? ' selected' : ''}" data-layer-id="${l.id}">
        <span class="layer-color-dot" style="background:${l.color}"></span>
        <span class="layer-name">${l.name}</span>
        <div class="layer-actions">
          <button class="icon-btn vis-btn" data-layer-id="${l.id}" title="${l.visible ? 'Hide' : 'Show'}">
            ${l.visible
              ? svgIcon('<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>')
              : svgIcon('<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>')}
          </button>
          <button class="icon-btn danger del-layer-btn" data-layer-id="${l.id}" title="Delete layer">
            ${svgIcon('<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>')}
          </button>
        </div>
      </div>
    `).join('');

    layersList.querySelectorAll('.layer-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('button')) return;
        const id = (row as HTMLElement).dataset.layerId!;
        state.selectLayer(id);
      });
    });

    layersList.querySelectorAll('.vis-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = (btn as HTMLElement).dataset.layerId!;
        state.toggleLayerVisibility(id);
      });
    });

    layersList.querySelectorAll('.del-layer-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = (btn as HTMLElement).dataset.layerId!;
        state.removeLayer(id);
      });
    });
  }

  function renderMedia() {
    if (state.mediaItems.length === 0) {
      mediaList.innerHTML = `<div class="empty-state">
        ${svgIcon('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>')}
        <p>No media imported.<br/>Import files to get started.</p>
      </div>`;
      return;
    }
    mediaList.innerHTML = state.mediaItems.map(item => `
      <div class="media-item" data-media-id="${item.id}">
        <div class="media-thumb type-${item.type}">
          ${item.type === 'image' && item.objectUrl
            ? `<img src="${item.objectUrl}" alt="${item.name}" />`
            : MEDIA_ICONS[item.type]}
        </div>
        <div class="media-info">
          <div class="media-info-name">${item.name}</div>
          <div class="media-info-type">${item.type}</div>
        </div>
        <button class="media-add-btn" data-media-id="${item.id}" title="Add to timeline">
          ${svgIcon('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>')}
        </button>
      </div>
    `).join('');

    mediaList.querySelectorAll('.media-add-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const mediaId = (btn as HTMLElement).dataset.mediaId!;
        const item = state.mediaItems.find(m => m.id === mediaId);
        if (!item) return;
        await addMediaToTimeline(item);
      });
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

  addLayerBtn.addEventListener('click', async () => {
    await state.addLayer();
  });

  importArea.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    if (fileInput.files) handleFiles(fileInput.files);
    fileInput.value = '';
  });

  importArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    importArea.classList.add('drag-over');
  });

  importArea.addEventListener('dragleave', () => importArea.classList.remove('drag-over'));

  importArea.addEventListener('drop', (e) => {
    e.preventDefault();
    importArea.classList.remove('drag-over');
    if (e.dataTransfer?.files) handleFiles(e.dataTransfer.files);
  });

  (el.querySelector('#layer-search') as HTMLInputElement).addEventListener('input', renderLayers);

  state.on('layers:change', renderLayers);
  state.on('selection:change', renderLayers);
  state.on('media:change', renderMedia);

  renderLayers();
  renderMedia();
}
