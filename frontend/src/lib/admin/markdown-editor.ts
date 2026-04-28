import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown, type MarkdownStorage } from "tiptap-markdown";

declare module "@tiptap/core" {
    interface Storage {
        markdown: MarkdownStorage;
    }
}

interface Bound {
    editor: Editor;
    textarea: HTMLTextAreaElement;
}

const editors = new Map<string, Bound>();

const EDITOR_CLASS =
    "tiptap prose prose-sm sm:prose-base max-w-none p-4 min-h-full focus:outline-none";

function getMinHeight(textarea: HTMLTextAreaElement): string {
    const rows = Number(textarea.getAttribute("rows") || "6");
    return `${Math.max(rows * 24 + 48, 180)}px`;
}

function runCommand(editor: Editor, btn: HTMLButtonElement): void {
    const cmd = btn.dataset.cmd;
    if (!cmd) return;
    const chain = editor.chain().focus();

    switch (cmd) {
        case "bold":
            chain.toggleBold().run();
            return;
        case "italic":
            chain.toggleItalic().run();
            return;
        case "strike":
            chain.toggleStrike().run();
            return;
        case "heading": {
            const level = Number(btn.dataset.level || "2") as 1 | 2 | 3;
            chain.toggleHeading({ level }).run();
            return;
        }
        case "bulletList":
            chain.toggleBulletList().run();
            return;
        case "orderedList":
            chain.toggleOrderedList().run();
            return;
        case "blockquote":
            chain.toggleBlockquote().run();
            return;
        case "codeBlock":
            chain.toggleCodeBlock().run();
            return;
        case "horizontalRule":
            chain.setHorizontalRule().run();
            return;
        case "undo":
            chain.undo().run();
            return;
        case "redo":
            chain.redo().run();
            return;
        case "link": {
            const previous = editor.getAttributes("link").href as
                | string
                | undefined;
            const url = window.prompt("URL:", previous ?? "");
            if (url === null) return;
            if (url === "") chain.unsetLink().run();
            else chain.extendMarkRange("link").setLink({ href: url }).run();
            return;
        }
    }
}

function isActive(editor: Editor, btn: HTMLButtonElement): boolean {
    const cmd = btn.dataset.cmd;
    switch (cmd) {
        case "bold":
        case "italic":
        case "strike":
        case "bulletList":
        case "orderedList":
        case "blockquote":
        case "codeBlock":
        case "link":
            return editor.isActive(cmd);
        case "heading":
            return editor.isActive("heading", {
                level: Number(btn.dataset.level || "2"),
            });
        default:
            return false;
    }
}

function syncToolbar(toolbar: HTMLElement, editor: Editor): void {
    toolbar
        .querySelectorAll<HTMLButtonElement>("button[data-cmd]")
        .forEach((btn) => {
            if (isActive(editor, btn)) btn.dataset.active = "true";
            else delete btn.dataset.active;

            if (btn.dataset.cmd === "undo") btn.disabled = !editor.can().undo();
            else if (btn.dataset.cmd === "redo")
                btn.disabled = !editor.can().redo();
        });
}

function bindToolbar(host: HTMLElement, editor: Editor): void {
    const toolbar = host.querySelector<HTMLElement>("[data-markdown-toolbar]");
    if (!toolbar) return;

    toolbar
        .querySelectorAll<HTMLButtonElement>("button[data-cmd]")
        .forEach((btn) => {
            btn.addEventListener("click", (e) => {
                e.preventDefault();
                runCommand(editor, btn);
            });
        });

    const update = () => syncToolbar(toolbar, editor);
    editor.on("selectionUpdate", update);
    editor.on("transaction", update);
    update();
}

function initializeEditor(host: HTMLElement): void {
    const textarea = host.querySelector<HTMLTextAreaElement>("textarea");
    const mount = host.querySelector<HTMLElement>("[data-markdown-mount]");
    if (!textarea?.id || !mount || editors.has(textarea.id)) return;

    textarea.style.display = "none";
    mount.style.minHeight = getMinHeight(textarea);

    const editor = new Editor({
        element: mount,
        extensions: [
            StarterKit.configure({
                link: { openOnClick: false },
            }),
            Markdown.configure({
                html: false,
                tightLists: true,
                linkify: true,
                breaks: false,
            }),
            Placeholder.configure({
                placeholder: textarea.placeholder || "",
            }),
        ],
        content: textarea.value || "",
        editorProps: {
            attributes: { class: EDITOR_CLASS },
        },
        onUpdate: ({ editor }) => {
            textarea.value = editor.storage.markdown.getMarkdown();
        },
    });

    bindToolbar(host, editor);
    editors.set(textarea.id, { editor, textarea });
}

export function initMarkdownEditors(): void {
    document
        .querySelectorAll<HTMLElement>("[data-markdown-editor]")
        .forEach((host) => initializeEditor(host));
}

export function setMarkdownEditorValue(targetId: string, value: string): void {
    const bound = editors.get(targetId);
    if (bound) {
        bound.editor.commands.setContent(value);
        bound.textarea.value = value;
        return;
    }

    const textarea = document.getElementById(
        targetId,
    ) as HTMLTextAreaElement | null;
    if (textarea) textarea.value = value;
}
