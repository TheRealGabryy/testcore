import { listProjects, createProject, deleteProject } from './store';
import type { ProjectMeta } from './types';
import { RESOLUTION_PRESETS } from './types';

export interface ProjectPageCallbacks {
  onOpenProject: (id: string) => void;
  onNewProject: (id: string) => void;
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'Just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatResolution(w: number, h: number): string {
  return `${w} × ${h}`;
}

function svgIcon(path: string): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
}

const LOGO_SVG = `<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="36" height="36" rx="8" fill="#2563eb"/>
  <path d="M10 26V10l16 8-16 8z" fill="white"/>
</svg>`;

function renderProjectCard(project: ProjectMeta, onOpen: () => void, onDelete: () => void): HTMLElement {
  const card = document.createElement('div');
  card.className = 'pp-card';
  card.dataset.id = project.id;

  const thumb = project.thumbnail
    ? `<img class="pp-card-thumb-img" src="${project.thumbnail}" alt="${project.name}" loading="lazy">`
    : `<div class="pp-card-thumb-placeholder">${svgIcon('<path d="M15 10l4.553-2.069A1 1 0 0 1 21 8.882v6.236a1 1 0 0 1-1.447.894L15 14M3 8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z"/>')}</div>`;

  card.innerHTML = `
    <div class="pp-card-thumb">
      ${thumb}
      <div class="pp-card-overlay">
        <button class="pp-card-open-btn" title="Open project">
          ${svgIcon('<polygon points="5 3 19 12 5 21 5 3"/>')}
          Open
        </button>
        <button class="pp-card-delete-btn" title="Delete project">
          ${svgIcon('<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>')}
        </button>
      </div>
    </div>
    <div class="pp-card-info">
      <div class="pp-card-name" title="${project.name}">${project.name}</div>
      <div class="pp-card-meta">
        <span class="pp-card-res">${formatResolution(project.width, project.height)}</span>
        <span class="pp-card-sep">·</span>
        <span class="pp-card-date">${relativeTime(project.updatedAt)}</span>
      </div>
    </div>
  `;

  card.querySelector('.pp-card-open-btn')!.addEventListener('click', e => {
    e.stopPropagation();
    onOpen();
  });

  card.querySelector('.pp-card-delete-btn')!.addEventListener('click', e => {
    e.stopPropagation();
    onDelete();
  });

  card.addEventListener('click', onOpen);

  return card;
}

function showNewProjectDialog(onConfirm: (name: string, width: number, height: number) => void): void {
  const overlay = document.createElement('div');
  overlay.className = 'pp-dialog-overlay';

  let selectedPreset = 0;

  overlay.innerHTML = `
    <div class="pp-dialog" id="new-project-dialog">
      <div class="pp-dialog-header">
        <h2 class="pp-dialog-title">New Project</h2>
        <button class="pp-dialog-close" id="pp-dlg-close">${svgIcon('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>')}</button>
      </div>
      <div class="pp-dialog-body">
        <div class="pp-field">
          <label class="pp-label" for="pp-proj-name">Project Name</label>
          <input class="pp-input" id="pp-proj-name" type="text" value="Untitled Project" spellcheck="false" autocomplete="off"/>
        </div>
        <div class="pp-field">
          <label class="pp-label">Resolution</label>
          <div class="pp-preset-grid">
            ${RESOLUTION_PRESETS.map((p, i) => `
              <label class="pp-preset-item${i === 0 ? ' selected' : ''}" data-idx="${i}">
                <input type="radio" name="pp-resolution" value="${i}" ${i === 0 ? 'checked' : ''} class="pp-preset-radio"/>
                <span class="pp-preset-label">${p.label}</span>
                <span class="pp-preset-sub">${p.sublabel}</span>
              </label>
            `).join('')}
          </div>
        </div>
      </div>
      <div class="pp-dialog-footer">
        <button class="pp-btn-ghost" id="pp-dlg-cancel">Cancel</button>
        <button class="pp-btn-primary" id="pp-dlg-create">Create Project</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const nameInput = overlay.querySelector<HTMLInputElement>('#pp-proj-name')!;
  nameInput.select();
  nameInput.focus();

  overlay.querySelectorAll<HTMLLabelElement>('.pp-preset-item').forEach(item => {
    item.addEventListener('click', () => {
      overlay.querySelectorAll('.pp-preset-item').forEach(i => i.classList.remove('selected'));
      item.classList.add('selected');
      selectedPreset = Number(item.dataset.idx);
    });
  });

  const close = () => overlay.remove();

  overlay.querySelector('#pp-dlg-close')!.addEventListener('click', close);
  overlay.querySelector('#pp-dlg-cancel')!.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  nameInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') confirm();
    if (e.key === 'Escape') close();
  });

  function confirm() {
    const name = nameInput.value.trim() || 'Untitled Project';
    const preset = RESOLUTION_PRESETS[selectedPreset];
    close();
    onConfirm(name, preset.width, preset.height);
  }

  overlay.querySelector('#pp-dlg-create')!.addEventListener('click', confirm);
}

function showDeleteConfirm(projectName: string, onConfirm: () => void): void {
  const overlay = document.createElement('div');
  overlay.className = 'pp-dialog-overlay';
  overlay.innerHTML = `
    <div class="pp-dialog pp-dialog--sm">
      <div class="pp-dialog-header">
        <h2 class="pp-dialog-title">Delete Project</h2>
        <button class="pp-dialog-close" id="pp-del-close">${svgIcon('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>')}</button>
      </div>
      <div class="pp-dialog-body">
        <p class="pp-dialog-text">Are you sure you want to delete <strong>${projectName}</strong>? This action cannot be undone.</p>
      </div>
      <div class="pp-dialog-footer">
        <button class="pp-btn-ghost" id="pp-del-cancel">Cancel</button>
        <button class="pp-btn-danger" id="pp-del-confirm">Delete</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.querySelector('#pp-del-close')!.addEventListener('click', close);
  overlay.querySelector('#pp-del-cancel')!.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  overlay.querySelector('#pp-del-confirm')!.addEventListener('click', () => {
    close();
    onConfirm();
  });
}

export function showProjectPage(callbacks: ProjectPageCallbacks): void {
  const root = document.getElementById('project-page')!;
  root.style.display = 'flex';

  function render() {
    const projects = listProjects();

    root.innerHTML = `
      <div class="pp-header">
        <div class="pp-header-left">
          <div class="pp-logo">${LOGO_SVG}</div>
          <span class="pp-app-name">DiffusionStudio</span>
        </div>
        <div class="pp-header-right">
          <span class="pp-version">v4.0</span>
        </div>
      </div>

      <div class="pp-body">
        <div class="pp-sidebar">
          <div class="pp-sidebar-section">
            <button class="pp-new-btn" id="pp-new-project-btn">
              <span class="pp-new-btn-icon">${svgIcon('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>')}</span>
              New Project
            </button>
          </div>
          <div class="pp-sidebar-section">
            <div class="pp-sidebar-label">Quick Actions</div>
            <button class="pp-sidebar-item" id="pp-sidebar-import">
              ${svgIcon('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>')}
              Import Project
            </button>
          </div>
          <div class="pp-sidebar-section pp-sidebar-footer">
            <div class="pp-sidebar-label">Storage</div>
            <div class="pp-storage-info">
              <div class="pp-storage-bar">
                <div class="pp-storage-fill" id="pp-storage-fill"></div>
              </div>
              <span class="pp-storage-text" id="pp-storage-text">Calculating...</span>
            </div>
          </div>
        </div>

        <div class="pp-main">
          ${projects.length === 0 ? `
            <div class="pp-empty">
              <div class="pp-empty-icon">
                ${svgIcon('<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>')}
              </div>
              <p class="pp-empty-title">No projects yet</p>
              <p class="pp-empty-sub">Create your first project to get started</p>
              <button class="pp-btn-primary pp-empty-cta" id="pp-empty-new-btn">
                ${svgIcon('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>')}
                New Project
              </button>
            </div>
          ` : `
            <div class="pp-section-header">
              <h2 class="pp-section-title">Recent Projects</h2>
              <span class="pp-section-count">${projects.length} project${projects.length !== 1 ? 's' : ''}</span>
            </div>
            <div class="pp-grid" id="pp-project-grid"></div>
          `}
        </div>
      </div>
    `;

    root.querySelector('#pp-new-project-btn')?.addEventListener('click', handleNew);
    root.querySelector('#pp-empty-new-btn')?.addEventListener('click', handleNew);
    root.querySelector('#pp-sidebar-import')?.addEventListener('click', handleImport);

    if (projects.length > 0) {
      const grid = root.querySelector('#pp-project-grid')!;
      for (const project of projects) {
        const card = renderProjectCard(
          project,
          () => {
            root.style.display = 'none';
            callbacks.onOpenProject(project.id);
          },
          () => {
            showDeleteConfirm(project.name, () => {
              deleteProject(project.id);
              render();
            });
          }
        );
        grid.appendChild(card);
      }
    }

    updateStorageInfo();
  }

  function handleNew() {
    showNewProjectDialog((name, width, height) => {
      const project = createProject(name, width, height);
      root.style.display = 'none';
      callbacks.onNewProject(project.id);
    });
  }

  function handleImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.dsproject,.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data.id || !data.name) throw new Error('Invalid project file');
        data.id = Date.now().toString(36) + Math.random().toString(36).slice(2);
        data.updatedAt = Date.now();
        localStorage.setItem(
          'ds-projects-v1',
          JSON.stringify([
            ...JSON.parse(localStorage.getItem('ds-projects-v1') ?? '[]'),
            data,
          ])
        );
        render();
      } catch {
        alert('Failed to import project file.');
      }
    };
    input.click();
  }

  function updateStorageInfo() {
    try {
      const raw = localStorage.getItem('ds-projects-v1') ?? '[]';
      const bytes = new Blob([raw]).size;
      const kb = (bytes / 1024).toFixed(1);
      const fill = root.querySelector<HTMLElement>('#pp-storage-fill');
      const text = root.querySelector<HTMLElement>('#pp-storage-text');
      const pct = Math.min((bytes / (5 * 1024 * 1024)) * 100, 100);
      if (fill) fill.style.width = `${pct}%`;
      if (text) text.textContent = `${kb} KB used`;
    } catch {
      /* ignore */
    }
  }

  render();
}

export function hideProjectPage(): void {
  const root = document.getElementById('project-page');
  if (root) root.style.display = 'none';
}
