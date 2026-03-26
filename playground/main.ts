import { createEditor } from './editor/app';
import { showProjectPage } from './projects/page';
import { loadProject, saveProject as persistSave, restoreProjectState } from './projects/store';

async function boot() {
  const editorEl = document.getElementById('editor')!;

  let currentProjectId: string | null = null;
  let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

  function scheduleAutoSave() {
    if (!currentProjectId) return;
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
      if (!currentProjectId) return;
      persistSave(currentProjectId, handle.state, handle.composition);
      autoSaveTimer = null;
    }, 800);
  }

  const handle = await createEditor({
    onBack: () => {
      if (currentProjectId) {
        if (autoSaveTimer) {
          clearTimeout(autoSaveTimer);
          autoSaveTimer = null;
        }
        persistSave(currentProjectId, handle.state, handle.composition);
      }
      editorEl.style.display = 'none';
      currentProjectId = null;
      showProjectPage(callbacks);
    },
    onSave: (composition, state) => {
      if (!currentProjectId) return;
      persistSave(currentProjectId, state, composition);
    },
  });

  handle.state.on('layers:change', scheduleAutoSave);
  handle.state.on('timeline:change', scheduleAutoSave);
  handle.state.on('props:change', scheduleAutoSave);
  handle.state.on('zoom:change', scheduleAutoSave);
  handle.state.on('grading:change', scheduleAutoSave);

  window.addEventListener('beforeunload', () => {
    if (!currentProjectId) return;
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
      autoSaveTimer = null;
    }
    persistSave(currentProjectId, handle.state, handle.composition);
  });

  const callbacks = {
    onOpenProject: async (id: string) => {
      currentProjectId = id;
      const project = loadProject(id);
      editorEl.style.display = '';

      if (project) {
        handle.applyProjectMeta(project.width, project.height, project.background);
        await restoreProjectState(project, handle.composition, handle.state);
      }
    },

    onNewProject: async (id: string) => {
      currentProjectId = id;
      const project = loadProject(id);
      handle.resetEditor();

      if (project) {
        handle.applyProjectMeta(project.width, project.height, project.background);
      }

      editorEl.style.display = '';
    },
  };

  showProjectPage(callbacks);
}

boot().catch(console.error);
