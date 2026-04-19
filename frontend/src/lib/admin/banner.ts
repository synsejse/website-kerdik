import { api } from "../api";

function toneClasses(tone: string): string {
  switch (tone) {
    case "warning":
      return "rounded-2xl p-5 text-white bg-amber-500";
    case "info":
      return "rounded-2xl p-5 text-white bg-blue-600";
    case "critical":
    default:
      return "rounded-2xl p-5 text-white bg-red-600";
  }
}

export function initEmergencyBannerAdmin(): void {
  const form = document.getElementById("banner-form") as HTMLFormElement | null;
  const active = document.getElementById("banner-active") as HTMLInputElement | null;
  const tone = document.getElementById("banner-tone") as HTMLSelectElement | null;
  const title = document.getElementById("banner-title") as HTMLInputElement | null;
  const message = document.getElementById("banner-message") as HTMLTextAreaElement | null;
  const linkLabel = document.getElementById("banner-link-label") as HTMLInputElement | null;
  const linkUrl = document.getElementById("banner-link-url") as HTMLInputElement | null;
  const deleteBtn = document.getElementById("banner-delete") as HTMLButtonElement | null;
  const success = document.getElementById("banner-success") as HTMLDivElement | null;
  const error = document.getElementById("banner-error") as HTMLDivElement | null;
  const preview = document.getElementById("banner-preview") as HTMLDivElement | null;
  const previewTitle = document.getElementById("banner-preview-title") as HTMLParagraphElement | null;
  const previewMessage = document.getElementById("banner-preview-message") as HTMLParagraphElement | null;
  const previewLink = document.getElementById("banner-preview-link") as HTMLAnchorElement | null;

  if (!form || !active || !tone || !title || !message || !linkLabel || !linkUrl || !deleteBtn || !preview || !previewTitle || !previewMessage || !previewLink) {
    return;
  }

  const activeInput = active;
  const toneInput = tone;
  const titleInput = title;
  const messageInput = message;
  const linkLabelInput = linkLabel;
  const linkUrlInput = linkUrl;
  const previewCard = preview;
  const previewTitleEl = previewTitle;
  const previewMessageEl = previewMessage;
  const previewLinkEl = previewLink;

  function renderPreview(): void {
    previewCard.className = toneClasses(toneInput.value);
    previewTitleEl.textContent = titleInput.value.trim() || "Núdzový oznam";
    previewMessageEl.textContent = messageInput.value.trim() || "Text bannera sa zobrazí tu.";

    if (linkLabelInput.value.trim() && linkUrlInput.value.trim()) {
      previewLinkEl.classList.remove("hidden");
      previewLinkEl.textContent = linkLabelInput.value.trim();
      previewLinkEl.href = linkUrlInput.value.trim();
    } else {
      previewLinkEl.classList.add("hidden");
      previewLinkEl.href = "#";
    }
  }

  async function loadBanner(): Promise<void> {
    try {
      const banner = await api.admin.getEmergencyBanner();
      if (banner) {
        activeInput.checked = banner.is_active;
        toneInput.value = banner.tone;
        titleInput.value = banner.title;
        messageInput.value = banner.message;
        linkLabelInput.value = banner.link_label || "";
        linkUrlInput.value = banner.link_url || "";
      }
      renderPreview();
    } catch (err) {
      console.error("Failed to load emergency banner:", err);
      renderPreview();
    }
  }

  [activeInput, toneInput, titleInput, messageInput, linkLabelInput, linkUrlInput].forEach((field) => {
    field.addEventListener("input", renderPreview);
    field.addEventListener("change", renderPreview);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    success?.classList.add("hidden");
    error?.classList.add("hidden");

    try {
      await api.admin.saveEmergencyBanner({
        title: titleInput.value.trim(),
        message: messageInput.value.trim(),
        tone: toneInput.value,
        link_label: linkLabelInput.value.trim(),
        link_url: linkUrlInput.value.trim(),
        is_active: activeInput.checked,
      });
      if (success) {
        success.textContent = "Banner bol uložený.";
        success.classList.remove("hidden");
      }
      await loadBanner();
    } catch (err) {
      if (error) {
        error.textContent = err instanceof Error ? err.message : "Chyba pri ukladaní bannera.";
        error.classList.remove("hidden");
      }
    }
  });

  deleteBtn.addEventListener("click", async () => {
    success?.classList.add("hidden");
    error?.classList.add("hidden");

    try {
      await api.admin.deleteEmergencyBanner();
      form.reset();
      renderPreview();
      if (success) {
        success.textContent = "Banner bol vymazaný.";
        success.classList.remove("hidden");
      }
    } catch (err) {
      if (error) {
        error.textContent = err instanceof Error ? err.message : "Chyba pri mazaní bannera.";
        error.classList.remove("hidden");
      }
    }
  });

  loadBanner();
}
