function svgIcon(path: string): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
}

const LAYOUT_TABS = [
  {
    id: 'edit',
    title: 'Edit',
    icon: svgIcon('<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>'),
  },
  {
    id: 'color',
    title: 'Color',
    icon: svgIcon('<circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 0 20"/><path d="M12 8a4 4 0 0 1 0 8"/>'),
  },
  {
    id: 'animation',
    title: 'Animation',
    icon: svgIcon('<path d="M5 12h14"/><path d="M12 5l7 7-7 7"/><circle cx="5" cy="12" r="2" fill="currentColor" stroke="none"/>'),
  },
  {
    id: 'canvas',
    title: 'Canvas',
    icon: svgIcon('<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>'),
  },
  {
    id: 'assets',
    title: 'Assets',
    icon: svgIcon('<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>'),
  },
];

export function setupIconSidebar(el: HTMLElement, onExport: () => void, onLoadDemo: () => void, onLayoutChange: (id: string) => void) {
  el.innerHTML = `
    <div class="icon-sidebar-top">
      ${LAYOUT_TABS.map(tab => `
        <button class="icon-sidebar-btn${tab.id === 'edit' ? ' active' : ''}" data-id="${tab.id}" title="${tab.title}">
          ${tab.icon}
        </button>
      `).join('')}
    </div>
    <div class="icon-sidebar-bottom">
      <button class="icon-sidebar-btn" data-id="settings" title="Load Demo">
        ${svgIcon('<circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>')}
      </button>
      <button class="icon-sidebar-btn icon-sidebar-export" id="sidebar-export-btn" title="Export video">
        ${svgIcon('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>')}
      </button>
    </div>
  `;

  el.querySelectorAll<HTMLButtonElement>('.icon-sidebar-btn[data-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id!;
      if (id === 'settings') {
        onLoadDemo();
        return;
      }
      const isLayoutTab = LAYOUT_TABS.some(t => t.id === id);
      if (!isLayoutTab) return;

      el.querySelectorAll('.icon-sidebar-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      onLayoutChange(id);
    });
  });

  el.querySelector('#sidebar-export-btn')!.addEventListener('click', onExport);
}
