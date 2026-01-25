import type { ConfirmCallback, PaginationState, TabConfig } from "./types";

export function escapeHtml(text?: string | null): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function showConfirmDialog(message: string, onConfirm: ConfirmCallback): void {
  if (confirm(message)) {
    onConfirm();
  }
}

export function showLoading(element: HTMLElement | null): void {
  if (element) element.style.display = "block";
}

export function hideLoading(element: HTMLElement | null): void {
  if (element) element.style.display = "none";
}

export function updatePaginationControls(
  pagination: PaginationState,
  currentPageEl: HTMLElement | null,
  prevBtn: HTMLButtonElement | null,
  nextBtn: HTMLButtonElement | null,
  controlsEl: HTMLElement | null
): void {
  if (!controlsEl || !currentPageEl || !prevBtn || !nextBtn) return;

  if (pagination.totalPages > 1) {
    controlsEl.classList.remove("hidden");
    controlsEl.classList.add("flex");
    currentPageEl.textContent = String(pagination.currentPage);
    prevBtn.disabled = pagination.currentPage <= 1;
    nextBtn.disabled = pagination.currentPage >= pagination.totalPages;
  } else {
    controlsEl.classList.add("hidden");
    controlsEl.classList.remove("flex");
  }
}

export function switchTab(
  activeTabId: string,
  tabs: TabConfig[],
  tabElements: Map<string, HTMLButtonElement>,
  contentElements: Map<string, HTMLElement>
): void {
  tabs.forEach((tab) => {
    const tabEl = tabElements.get(tab.id);
    const contentEl = contentElements.get(tab.id);

    if (!tabEl || !contentEl) return;

    if (tab.id === activeTabId) {
      tabEl.classList.add("text-primary", "border-primary");
      tabEl.classList.remove("text-gray-400", "border-transparent");
      contentEl.classList.remove("hidden");
    } else {
      tabEl.classList.add("text-gray-400", "border-transparent");
      tabEl.classList.remove("text-primary", "border-primary");
      contentEl.classList.add("hidden");
    }
  });
}
