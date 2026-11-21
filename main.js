const { FuzzySuggestModal, ItemView, MarkdownRenderer, Notice, Plugin } = require('obsidian');

const VIEW_TYPE = 'temporary-markdown-preview';
const DEFAULT_TITLE = '临时 Markdown 预览';

class SaveFolderPicker extends FuzzySuggestModal {
  constructor(app, onChoose, onDismiss) {
    super(app);
    this.onChoose = onChoose;
    this.onDismiss = onDismiss;
    this.setPlaceholder('选择保存位置，可搜索文件夹');
  }

  getItems() {
    const vault = this.app.vault;
    return [vault.getRoot(), ...vault.getAllFolders(false).sort((a, b) => a.path.localeCompare(b.path))];
  }

  getItemText(folder) {
    return folder.isRoot() ? '仓库根目录' : folder.path;
  }

  onChooseItem(folder) {
    this.onChoose(folder);
  }

  onClose() {
    super.onClose();
    this.onDismiss();
  }
}

class TemporaryMarkdownView extends ItemView {
  title = DEFAULT_TITLE;
  closed = false;
  folderPicker = null;

  getViewType() {
    return VIEW_TYPE;
  }

  getDisplayText() {
    return this.title;
  }

  getIcon() {
    return 'file-text';
  }

  async setState(state, result) {
    this.title = state?.title || DEFAULT_TITLE;
    await super.setState(state, result);
  }

  async onOpen() {
    this.contentEl.addClass('markdown-preview-view');
  }

  async showFile(file) {
    this.contentEl.setText('正在读取…');
    try {
      const bytes = await file.arrayBuffer();
      if (this.closed) return;

      const markdown = new TextDecoder().decode(bytes);
      this.contentEl.empty();
      const page = this.contentEl.createDiv({ cls: 'markdown-preview-sizer markdown-rendered' });
      const actions = page.createDiv({ cls: 'temporary-markdown-preview-actions' });
      const saveButton = actions.createEl('button', { text: '保存到仓库' });
      this.registerDomEvent(saveButton, 'click', () => {
        this.chooseSaveFolder(file.name, bytes, saveButton);
      });

      const rendered = page.createDiv();
      if (!markdown.trim()) {
        rendered.setText('这个文件没有内容。');
        return;
      }

      // A preview has no vault path. Keep its text out of the workspace state.
      await MarkdownRenderer.render(this.app, markdown, rendered, '', this);
    } catch (error) {
      if (this.closed) return;
      this.contentEl.setText('无法预览此文件。');
      console.error(`[${VIEW_TYPE}] Failed to preview ${file.name}`, error);
    }
  }

  chooseSaveFolder(name, bytes, button) {
    if (this.closed || this.folderPicker || button.disabled) return;
    this.folderPicker = new SaveFolderPicker(this.app, folder => {
      void this.saveToFolder(folder, name, bytes, button);
    }, () => {
      this.folderPicker = null;
    });
    this.folderPicker.open();
  }

  async saveToFolder(folder, name, bytes, button) {
    if (this.closed || button.disabled) return;
    button.disabled = true;
    button.setText('正在保存…');

    const { vault } = this.app;
    let savedFile;
    try {
      const directory = folder.isRoot() ? '' : `${folder.path}/`;
      const basename = name.slice(0, -3);
      const extension = name.slice(-3);
      let path = `${directory}${name}`;
      let suffix = 2;
      while (await vault.adapter.exists(path)) {
        path = `${directory}${basename} (${suffix})${extension}`;
        suffix += 1;
      }
      savedFile = await vault.createBinary(path, bytes);
    } catch (error) {
      button.disabled = false;
      button.setText('保存到仓库');
      new Notice(`保存失败：${error?.message || '请重试'}`);
      return;
    }

    button.setText('已保存');
    new Notice(`已保存到 ${savedFile.path}`);
    if (this.closed || this.leaf.view !== this) return;

    try {
      await this.leaf.openFile(savedFile);
    } catch (error) {
      console.error(`[${VIEW_TYPE}] Failed to open ${savedFile.path}`, error);
    }
  }

  async onClose() {
    this.closed = true;
    this.folderPicker?.close();
    this.contentEl.empty();
  }
}

module.exports = class TemporaryMarkdownPlugin extends Plugin {
  unloading = false;

  onload() {
    const { workspace } = this.app;
    this.registerView(VIEW_TYPE, leaf => new TemporaryMarkdownView(leaf));

    workspace.onLayoutReady(() => {
      if (this.unloading) return;

      // Obsidian can restore the tab layout after restart, but previews are session-only.
      workspace.detachLeavesOfType(VIEW_TYPE);

      this.registerDomEvent(window, 'dragover', event => {
        if (event.dataTransfer?.types.includes('Files')) event.preventDefault();
      }, true);

      this.registerDomEvent(window, 'drop', event => {
        const files = Array.from(event.dataTransfer?.files ?? []);
        const markdownFiles = files.filter(file => /^[^/\\]*\.md$/i.test(file.name));
        if (markdownFiles.length === 0) return;

        // Stop the native drop handler before it can import the files into the vault.
        event.preventDefault();
        event.stopImmediatePropagation();
        void this.openPreviews(markdownFiles);
      }, true);
    });
  }

  async openPreviews(files) {
    const { workspace } = this.app;
    for (const file of files) {
      if (this.unloading) return;

      const leaf = workspace.getLeaf('tab');
      try {
        await leaf.setViewState({ type: VIEW_TYPE, active: true, state: { title: file.name } });
        if (this.unloading) return;

        await leaf.loadIfDeferred();
        if (leaf.view instanceof TemporaryMarkdownView && !leaf.view.closed) {
          void leaf.view.showFile(file);
        }
      } catch (error) {
        if (this.unloading) return;
        leaf.detach();
        new Notice(`无法打开临时预览：${file.name}`);
        console.error(`[${VIEW_TYPE}] Failed to open ${file.name}`, error);
      }
    }
  }

  onunload() {
    this.unloading = true;
    this.app.workspace.detachLeavesOfType(VIEW_TYPE);
  }
};
