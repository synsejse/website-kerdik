import EasyMDE from "easymde";

const editors = new Map<string, EasyMDE>();

const TOOLBAR: NonNullable<EasyMDE.Options["toolbar"]> = [
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

const PREVIEW_CLASS = [
    "editor-preview",
    "prose",
    "prose-sm",
    "sm:prose-base",
    "max-w-none",
    "p-4",
    "bg-white",
];

const WRAPPER_CLASSES = [
    "rounded-b-xl",
    "border",
    "border-gray-200",
    "border-t-0",
    "bg-gray-50",
];

const TOOLBAR_CLASS_NAME =
    "editor-toolbar border border-gray-200 rounded-t-xl bg-gray-100 p-2 flex flex-wrap gap-1 sm:gap-2";

const STATUS_BAR_CLASSES = [
    "px-3",
    "py-2",
    "text-xs",
    "text-gray-500",
    "bg-gray-50",
    "border",
    "border-gray-200",
    "border-t-0",
    "rounded-b-xl",
];

function getMinHeight(textarea: HTMLTextAreaElement): string {
    const rows = Number(textarea.getAttribute("rows") || "6");
    return `${Math.max(rows * 24 + 48, 180)}px`;
}

function applyStyling(editor: EasyMDE, textarea: HTMLTextAreaElement): void {
    const wrapper = editor.codemirror.getWrapperElement();
    const container = wrapper.parentElement;
    if (!container) return;

    const minHeight = getMinHeight(textarea);
    wrapper.classList.add(...WRAPPER_CLASSES);
    wrapper.style.minHeight = minHeight;

    const scroller = wrapper.querySelector<HTMLElement>(".CodeMirror-scroll");
    if (scroller) scroller.style.minHeight = minHeight;

    const toolbar = container.querySelector<HTMLElement>(".editor-toolbar");
    if (toolbar) toolbar.className = TOOLBAR_CLASS_NAME;

    const statusBar = container.querySelector<HTMLElement>(".editor-statusbar");
    if (statusBar) statusBar.classList.add(...STATUS_BAR_CLASSES);
}

// EasyMDE's preview mode leaves the underlying CodeMirror visible behind the
// preview overlay; hide its scroll/gutters/status while preview-only is active.
function syncPreviewVisibility(editor: EasyMDE): void {
    const wrapper = editor.codemirror.getWrapperElement();
    const container = wrapper.parentElement;
    if (!container) return;

    const preview = container.querySelector<HTMLElement>(
        ".editor-preview-full",
    );
    if (!preview) return;

    const previewSide = container.querySelector<HTMLElement>(
        ".editor-preview-side",
    );
    const isSideBySide =
        previewSide?.classList.contains("editor-preview-active-side") ?? false;
    const isPreviewOnly =
        preview.classList.contains("editor-preview-active") && !isSideBySide;

    const scroll = wrapper.querySelector<HTMLElement>(".CodeMirror-scroll");
    const gutters = wrapper.querySelector<HTMLElement>(".CodeMirror-gutters");
    const statusBar = container.querySelector<HTMLElement>(".editor-statusbar");

    if (scroll) {
        scroll.style.visibility = isPreviewOnly ? "hidden" : "";
        scroll.style.pointerEvents = isPreviewOnly ? "none" : "";
    }
    if (gutters) gutters.style.visibility = isPreviewOnly ? "hidden" : "";
    if (statusBar) statusBar.style.display = isPreviewOnly ? "none" : "";

    if (!isPreviewOnly) editor.codemirror.refresh();
}

function observePreviewMode(editor: EasyMDE): void {
    const container = editor.codemirror.getWrapperElement().parentElement;
    if (!container) return;

    const preview = container.querySelector(".editor-preview-full");
    if (!preview) return;

    const observer = new MutationObserver(() => syncPreviewVisibility(editor));
    observer.observe(preview, { attributes: true, attributeFilter: ["class"] });

    const previewSide = container.querySelector(".editor-preview-side");
    if (previewSide) {
        observer.observe(previewSide, {
            attributes: true,
            attributeFilter: ["class"],
        });
    }

    syncPreviewVisibility(editor);
}

function initializeEditor(textarea: HTMLTextAreaElement): void {
    if (!textarea.id || editors.has(textarea.id)) return;

    const editor = new EasyMDE({
        element: textarea,
        autoDownloadFontAwesome: false,
        forceSync: true,
        spellChecker: false,
        nativeSpellcheck: false,
        inputStyle: "contenteditable",
        sideBySideFullscreen: false,
        promptURLs: true,
        status: ["lines", "words"],
        toolbar: TOOLBAR,
        previewClass: PREVIEW_CLASS,
        placeholder: textarea.placeholder,
    });

    applyStyling(editor, textarea);
    observePreviewMode(editor);
    editors.set(textarea.id, editor);
}

export function initMarkdownEditors(): void {
    document
        .querySelectorAll<HTMLElement>("[data-markdown-editor]")
        .forEach((host) => {
            const textarea =
                host.querySelector<HTMLTextAreaElement>("textarea");
            if (textarea) initializeEditor(textarea);
        });
}

export function setMarkdownEditorValue(targetId: string, value: string): void {
    const editor = editors.get(targetId);
    if (editor) {
        editor.value(value);
        editor.codemirror.refresh();
        return;
    }

    const textarea = document.getElementById(
        targetId,
    ) as HTMLTextAreaElement | null;
    if (textarea) textarea.value = value;
}

export function refreshMarkdownEditors(targetIds?: string[]): void {
    const ids = targetIds?.length ? targetIds : Array.from(editors.keys());
    ids.forEach((id) => editors.get(id)?.codemirror.refresh());
}
