import EasyMDE from "easymde";

const editors = new Map<string, EasyMDE>();

function createToolbar(): NonNullable<EasyMDE.Options["toolbar"]> {
  return [
    "bold",
    "italic",
    "heading",
    "|",
    "quote",
    "unordered-list",
    "ordered-list",
    "|",
    "link",
    "code",
    "table",
    "horizontal-rule",
    "|",
    "preview",
    "side-by-side",
    "fullscreen",
    "|",
    "guide",
  ];
}

function getMinHeight(textarea: HTMLTextAreaElement): string {
  const rows = Number(textarea.getAttribute("rows") || "6");
  const pixels = Math.max(rows * 24 + 48, 180);
  return `${pixels}px`;
}

function applyEditorStyling(editor: EasyMDE, textarea: HTMLTextAreaElement): void {
  const wrapper = editor.codemirror.getWrapperElement();
  const toolbar = wrapper.parentElement?.querySelector(".editor-toolbar");
  const statusBar = wrapper.parentElement?.querySelector(".editor-statusbar");

  wrapper.classList.add(
    "rounded-b-xl",
    "border",
    "border-gray-200",
    "border-t-0",
    "bg-gray-50",
  );
  wrapper.style.minHeight = getMinHeight(textarea);

  const scroller = wrapper.querySelector(".CodeMirror-scroll") as HTMLElement | null;
  if (scroller) {
    scroller.style.minHeight = getMinHeight(textarea);
  }

  if (toolbar instanceof HTMLElement) {
    toolbar.className = "editor-toolbar border border-gray-200 rounded-t-xl bg-gray-100 p-2 flex flex-wrap gap-1 sm:gap-2";
  }

  if (statusBar instanceof HTMLElement) {
    statusBar.classList.add("px-3", "py-2", "text-xs", "text-gray-500", "bg-gray-50", "border", "border-gray-200", "border-t-0", "rounded-b-xl");
  }
}

function syncPreviewVisibility(editor: EasyMDE): void {
  const wrapper = editor.codemirror.getWrapperElement();
  const container = wrapper.parentElement;
  const statusBar = container?.querySelector(".editor-statusbar") as HTMLElement | null;
  const preview = container?.querySelector(".editor-preview") as HTMLElement | null;
  const previewSide = container?.querySelector(".editor-preview-side") as HTMLElement | null;

  if (!container || !preview) {
    return;
  }

  const isSideBySide = previewSide?.classList.contains("editor-preview-active-side") ?? false;
  const isPreviewOnly = preview.classList.contains("editor-preview-active") && !isSideBySide;

  wrapper.style.display = isPreviewOnly ? "none" : "";
  if (statusBar) {
    statusBar.style.display = isPreviewOnly ? "none" : "";
  }

  if (!isPreviewOnly) {
    editor.codemirror.refresh();
  }
}

function observePreviewMode(editor: EasyMDE): void {
  const wrapper = editor.codemirror.getWrapperElement();
  const container = wrapper.parentElement;
  const preview = container?.querySelector(".editor-preview") as HTMLElement | null;
  const previewSide = container?.querySelector(".editor-preview-side") as HTMLElement | null;

  if (!preview) {
    return;
  }

  const observer = new MutationObserver(() => {
    syncPreviewVisibility(editor);
  });

  observer.observe(preview, { attributes: true, attributeFilter: ["class"] });

  if (previewSide) {
    observer.observe(previewSide, { attributes: true, attributeFilter: ["class"] });
  }

  syncPreviewVisibility(editor);
}

function initializeEditor(textarea: HTMLTextAreaElement): void {
  if (!textarea.id || editors.has(textarea.id)) {
    return;
  }

  const editor = new EasyMDE({
    element: textarea,
    autoDownloadFontAwesome: false,
    forceSync: true,
    spellChecker: false,
    status: ["lines", "words"],
    toolbar: createToolbar(),
    promptURLs: true,
    previewClass: ["prose", "prose-sm", "sm:prose-base", "max-w-none", "p-4"],
    sideBySideFullscreen: false,
    inputStyle: "contenteditable",
    nativeSpellcheck: false,
    placeholder: textarea.placeholder,
  });

  applyEditorStyling(editor, textarea);
  observePreviewMode(editor);
  editors.set(textarea.id, editor);
}

export function initMarkdownEditors(): void {
  document
    .querySelectorAll<HTMLElement>("[data-markdown-editor-target]")
    .forEach((marker) => {
      const targetId = marker.dataset.markdownEditorTarget;
      if (!targetId) return;

      const textarea = document.getElementById(targetId) as HTMLTextAreaElement | null;
      if (!textarea) return;

      initializeEditor(textarea);
    });
}

export function setMarkdownEditorValue(targetId: string, value: string): void {
  const editor = editors.get(targetId);
  if (editor) {
    editor.value(value);
    editor.codemirror.refresh();
    return;
  }

  const textarea = document.getElementById(targetId) as HTMLTextAreaElement | null;
  if (textarea) {
    textarea.value = value;
  }
}

export function refreshMarkdownEditors(targetIds?: string[]): void {
  if (targetIds && targetIds.length > 0) {
    targetIds.forEach((id) => editors.get(id)?.codemirror.refresh());
    return;
  }

  editors.forEach((editor) => editor.codemirror.refresh());
}
