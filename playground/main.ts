import { createEditor } from './editor/app';
import { showProjectPage } from './projects/page';
import { loadProject, saveProject as persistSave, restoreProjectState } from './projects/store';

async function boot() {
  const editorEl = document.getElementById('editor')!;

  let currentProjectId: string | null = null;

  const handle = await createEditor({
    onBack: () => {
      editorEl.style.display = 'none';
      currentProjectId = null;
      showProjectPage(callbacks);
    },
    onSave: (composition, state) => {
      if (!currentProjectId) return;
      persistSave(currentProjectId, state, composition);
    },
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
