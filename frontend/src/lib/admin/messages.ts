import { api, type Message, type ArchivedMessage } from "../../lib/api";
import { format } from "date-fns";
import { sk } from "date-fns/locale";
import {
  escapeHtml,
  showConfirmDialog,
  showLoading,
  hideLoading,
  updatePaginationControls,
  switchTab,
} from "./utils";
import type { PaginationState, TabConfig } from "./types";

// Extend window with admin actions
declare global {
  interface Window {
    archiveMessage?: (id: number) => Promise<void>;
    deleteMessage?: (id: number) => Promise<void>;
    restoreMessage?: (id: number) => Promise<void>;
    permanentlyDeleteArchivedMessage?: (id: number) => Promise<void>;
  }
}

export interface MessagesPageElements {
  activeTab: HTMLButtonElement | null;
  archivedTab: HTMLButtonElement | null;
  activeContainer: HTMLElement | null;
  archivedContainer: HTMLElement | null;
  loading: HTMLElement | null;
  noActiveMessages: HTMLElement | null;
  noArchivedMessages: HTMLElement | null;
  paginationControls: HTMLElement | null;
  prevPageBtn: HTMLButtonElement | null;
  nextPageBtn: HTMLButtonElement | null;
  currentPageNum: HTMLElement | null;
  refreshBtn: HTMLButtonElement | null;
  activeCount: HTMLElement | null;
  archivedCount: HTMLElement | null;
}

export class MessagesPageController {
  private currentView: "active" | "archived" = "active";
  private currentPage = 1;
  private activeTotal = 0;
  private archivedTotal = 0;
  private tabs: TabConfig[];
  private elements: MessagesPageElements;

  constructor(elements: MessagesPageElements) {
    this.elements = elements;
    this.tabs = [
      { id: "active", label: "Aktívne správy" },
      { id: "archived", label: "Archív správ" },
    ];
    this.initialize();
  }

  private initialize(): void {
    this.setupEventListeners();
    this.loadInitialData();
  }

  private setupEventListeners(): void {
    const { activeTab, archivedTab, refreshBtn, prevPageBtn, nextPageBtn } =
      this.elements;

    activeTab?.addEventListener("click", () => {
      if (this.currentView === "archived") {
        this.switchToActiveView();
      }
    });

    archivedTab?.addEventListener("click", () => {
      if (this.currentView === "active") {
        this.switchToArchivedView();
      }
    });

    refreshBtn?.addEventListener("click", () => {
      this.currentPage = 1;
      this.loadCurrentView();
    });

    prevPageBtn?.addEventListener("click", () => this.handlePrevPage());
    nextPageBtn?.addEventListener("click", () => this.handleNextPage());

    this.setupWindowFunctions();
  }

  private setupWindowFunctions(): void {
    window.archiveMessage = async (id: number) => {
      showConfirmDialog("Naozaj chcete archivovať túto správu?", async () => {
        try {
          await api.admin.archiveMessage(id);
          await this.loadAllCounts();
          await this.loadCurrentView();
        } catch (error) {
          console.error("Failed to archive message:", error);
          alert("Nepodarilo sa archivovať správu.");
        }
      });
    };

    window.deleteMessage = async (id: number) => {
      showConfirmDialog(
        "Naozaj chcete natrvalo zmazať túto správu? Táto akcia je nezvratná!",
        async () => {
          try {
            await api.admin.deleteMessage(id);
            await this.loadAllCounts();
            await this.loadCurrentView();
          } catch (error) {
            console.error("Failed to delete message:", error);
            alert("Nepodarilo sa zmazať správu.");
          }
        },
      );
    };

    window.restoreMessage = async (id: number) => {
      showConfirmDialog("Naozaj chcete obnoviť túto správu?", async () => {
        try {
          await api.admin.restoreMessage(id);
          await this.loadAllCounts();
          await this.loadCurrentView();
        } catch (error) {
          console.error("Failed to restore message:", error);
          alert("Nepodarilo sa obnoviť správu.");
        }
      });
    };

    window.permanentlyDeleteArchivedMessage = async (id: number) => {
      showConfirmDialog(
        "Naozaj chcete natrvalo zmazať túto archivovanú správu? Táto akcia je nezvratná!",
        async () => {
          try {
            await api.admin.permanentlyDeleteArchivedMessage(id);
            await this.loadAllCounts();
            await this.loadCurrentView();
          } catch (error) {
            console.error("Failed to delete archived message:", error);
            alert("Nepodarilo sa zmazať archivovanú správu.");
          }
        },
      );
    };
  }

  private async loadInitialData(): Promise<void> {
    try {
      await this.loadAllCounts();
      await this.loadCurrentView();
    } catch (error) {
      console.error("Initialization error:", error);
    }
  }

  private async loadAllCounts(): Promise<void> {
    try {
      const [activeResponse, archivedResponse] = await Promise.all([
        api.admin.getMessages(1, 5),
        api.admin.getArchivedMessages(1, 5),
      ]);

      this.activeTotal = activeResponse.total;
      this.archivedTotal = archivedResponse.total;

      if (this.elements.activeCount) {
        this.elements.activeCount.textContent = String(this.activeTotal);
      }
      if (this.elements.archivedCount) {
        this.elements.archivedCount.textContent = String(this.archivedTotal);
      }
    } catch (error) {
      console.error("Failed to load counts:", error);
      if (this.elements.activeCount)
        this.elements.activeCount.textContent = "0";
      if (this.elements.archivedCount)
        this.elements.archivedCount.textContent = "0";
    }
  }

  private async loadCurrentView(): Promise<void> {
    if (this.currentView === "active") {
      await this.loadActiveMessages();
    } else {
      await this.loadArchivedMessages();
    }
  }

  private async loadActiveMessages(): Promise<void> {
    const {
      loading,
      noActiveMessages,
      activeContainer,
      noArchivedMessages,
      archivedContainer,
    } = this.elements;

    showLoading(loading);
    noActiveMessages?.classList.add("hidden");
    noArchivedMessages?.classList.add("hidden");
    if (activeContainer) activeContainer.innerHTML = "";
    if (archivedContainer) archivedContainer.classList.add("hidden");
    this.elements.paginationControls?.classList.add("hidden");

    try {
      const response = await api.admin.getMessages(this.currentPage);
      const messages = response.data;

      if (messages.length === 0) {
        noActiveMessages?.classList.remove("hidden");
      } else {
        this.renderActiveMessages(messages);
        this.updatePagination(response.total, response.limit);
        if (activeContainer) activeContainer.classList.remove("hidden");
      }

      this.activeTotal = response.total;
      if (this.elements.activeCount) {
        this.elements.activeCount.textContent = String(response.total);
      }
    } catch (error) {
      console.error("Failed to load active messages:", error);
      noActiveMessages?.classList.remove("hidden");
    } finally {
      hideLoading(this.elements.loading);
    }
  }

  private async loadArchivedMessages(): Promise<void> {
    const {
      loading,
      noActiveMessages,
      noArchivedMessages,
      archivedContainer,
      activeContainer,
    } = this.elements;

    showLoading(loading);
    noActiveMessages?.classList.add("hidden");
    noArchivedMessages?.classList.add("hidden");
    if (archivedContainer) archivedContainer.innerHTML = "";
    if (activeContainer) activeContainer.classList.add("hidden");
    this.elements.paginationControls?.classList.add("hidden");

    try {
      const response = await api.admin.getArchivedMessages(this.currentPage);
      const messages = response.data;

      if (messages.length === 0) {
        noArchivedMessages?.classList.remove("hidden");
      } else {
        this.renderArchivedMessages(messages);
        this.updatePagination(response.total, response.limit);
        if (archivedContainer) archivedContainer.classList.remove("hidden");
      }

      this.archivedTotal = response.total;
      if (this.elements.archivedCount) {
        this.elements.archivedCount.textContent = String(response.total);
      }
    } catch (error) {
      console.error("Failed to load archived messages:", error);
      noArchivedMessages?.classList.remove("hidden");
    } finally {
      hideLoading(this.elements.loading);
    }
  }

  private renderActiveMessages(messages: Message[]): void {
    if (!this.elements.activeContainer) return;

    const html = messages
      .map((msg) => this.createActiveMessageCard(msg))
      .join("");
    this.elements.activeContainer.innerHTML = html;
    
    // Replace icon placeholders with cloned templates
    this.replaceIconPlaceholders(this.elements.activeContainer);
  }

  private renderArchivedMessages(messages: ArchivedMessage[]): void {
    if (!this.elements.archivedContainer) return;

    const html = messages
      .map((msg) => this.createArchivedMessageCard(msg))
      .join("");
    this.elements.archivedContainer.innerHTML = html;
    
    // Replace icon placeholders with cloned templates
    this.replaceIconPlaceholders(this.elements.archivedContainer);
  }

  private replaceIconPlaceholders(container: HTMLElement): void {
    const iconMap: { [key: string]: string } = {
      'icon-calendar': 'icon-calendar',
      'icon-calendar-small': 'icon-calendar-small',
      'icon-user': 'icon-user',
      'icon-envelope': 'icon-envelope',
      'icon-phone': 'icon-phone',
      'icon-archive': 'icon-archive',
      'icon-trash': 'icon-trash',
      'icon-clock': 'icon-clock',
      'icon-undo': 'icon-undo',
    };

    Object.entries(iconMap).forEach(([className, templateId]) => {
      const template = document.getElementById(templateId) as HTMLTemplateElement;
      if (template) {
        container.querySelectorAll(`.${className}`).forEach((placeholder) => {
          placeholder.replaceWith(template.content.cloneNode(true));
        });
      }
    });
  }

  private createActiveMessageCard(msg: Message): string {
    const date = new Date(msg.created_at);
    const formattedDate = format(date, "d. MMMM yyyy HH:mm", { locale: sk });

    return `
      <div class="bg-white p-6 md:p-8 rounded-2xl border border-gray-100 shadow-sm transition-all duration-300 hover:shadow-xl hover:border-primary/20">
        <div class="flex flex-col lg:flex-row justify-between lg:items-start gap-6 mb-6">
          <div class="space-y-4 min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-3">
              <span class="px-3 py-1 bg-blue-50 text-primary text-[10px] font-black uppercase tracking-widest rounded-full border border-blue-100">Nová Správa</span>
              <span class="flex items-center gap-1.5 text-xs text-gray-400 font-bold uppercase tracking-wider">
                <span class="icon-calendar"></span>
                ${formattedDate}
              </span>
            </div>
            <h3 class="text-xl md:text-2xl font-black text-gray-900 tracking-tight break-words">${escapeHtml(msg.subject || "(Bez predmetu)")}</h3>
            <div class="flex flex-wrap items-center gap-4 text-xs md:text-sm">
              <div class="flex items-center gap-2 font-black text-gray-900 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                <span class="icon-user"></span>
                ${escapeHtml(msg.name)}
              </div>
              <a href="mailto:${escapeHtml(msg.email)}" class="text-primary font-bold hover:underline transition-colors break-all flex items-center gap-2">
                <span class="icon-envelope"></span>
                ${escapeHtml(msg.email)}
              </a>
              ${
                msg.phone
                  ? `
                <a href="tel:${escapeHtml(msg.phone)}" class="text-gray-600 font-bold hover:text-gray-900 transition-colors flex items-center gap-2">
                  <span class="icon-phone"></span>
                  ${escapeHtml(msg.phone)}
                </a>`
                  : ""
              }
            </div>
          </div>
          <div class="flex shrink-0 gap-3">
            <button
              onclick="window.archiveMessage && window.archiveMessage(${msg.id})"
              class="px-5 py-2.5 bg-gray-50 border border-gray-200 text-gray-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all duration-300 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest rounded-xl group"
              title="Archivovať správu"
            >
              <span class="icon-archive"></span>
              Archivovať
            </button>
            <button
              onclick="window.deleteMessage && window.deleteMessage(${msg.id})"
              class="px-5 py-2.5 bg-gray-50 border border-gray-200 text-gray-400 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-all duration-300 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest rounded-xl"
              title="Zmazať správu natrvalo"
            >
              <span class="icon-trash"></span>
              Zmazať
            </button>
          </div>
        </div>
        <div class="bg-gray-50 p-6 rounded-xl border-l-4 border-primary text-gray-700 whitespace-pre-wrap break-words leading-relaxed text-sm font-medium italic">
          ${escapeHtml(msg.message)}
        </div>
      </div>
    `;
  }

  private createArchivedMessageCard(msg: ArchivedMessage): string {
    const createdDate = new Date(msg.created_at);
    const archivedDate = new Date(msg.archived_at);
    const formattedCreated = format(createdDate, "d. MMMM yyyy HH:mm", {
      locale: sk,
    });
    const formattedArchived = format(archivedDate, "d. MMMM yyyy HH:mm", {
      locale: sk,
    });

    return `
      <div class="bg-white p-6 md:p-8 rounded-2xl border border-gray-100 shadow-sm transition-all duration-300 hover:shadow-xl hover:border-gray-300">
        <div class="flex flex-col lg:flex-row justify-between lg:items-start gap-6 mb-6">
          <div class="space-y-4 min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-3">
              <span class="px-3 py-1 bg-gray-100 text-gray-600 text-[10px] font-black uppercase tracking-widest rounded-full border border-gray-200">Archivované</span>
              <span class="flex items-center gap-1.5 text-xs text-gray-400 font-bold uppercase tracking-wider">
                <span class="icon-clock"></span>
                Archivované: ${formattedArchived}
              </span>
            </div>
            <h3 class="text-xl md:text-2xl font-black text-gray-900 tracking-tight break-words">${escapeHtml(msg.subject || "(Bez predmetu)")}</h3>
            <div class="flex flex-wrap items-center gap-4 text-xs md:text-sm">
              <div class="flex items-center gap-2 font-black text-gray-900 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                <span class="icon-user"></span>
                ${escapeHtml(msg.name)}
              </div>
              <a href="mailto:${escapeHtml(msg.email)}" class="text-gray-600 font-bold hover:text-gray-900 transition-colors break-all flex items-center gap-2">
                <span class="icon-envelope"></span>
                ${escapeHtml(msg.email)}
              </a>
              ${
                msg.phone
                  ? `
                <a href="tel:${escapeHtml(msg.phone)}" class="text-gray-600 font-bold hover:text-gray-900 transition-colors flex items-center gap-2">
                  <span class="icon-phone"></span>
                  ${escapeHtml(msg.phone)}
                </a>`
                  : ""
              }
            </div>
            <div class="flex items-center gap-4 text-xs text-gray-500">
              <span class="flex items-center gap-1.5">
                <span class="icon-calendar-small"></span>
                Vytvorené: ${formattedCreated}
              </span>
            </div>
          </div>
          <div class="flex shrink-0 gap-3">
            <button
              onclick="window.restoreMessage && window.restoreMessage(${msg.original_id})"
              class="px-5 py-2.5 bg-gray-50 border border-gray-200 text-gray-600 hover:bg-green-50 hover:text-green-600 hover:border-green-200 transition-all duration-300 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest rounded-xl group"
              title="Obnoviť správu"
            >
              <span class="icon-undo"></span>
              Obnoviť
            </button>
            <button
              onclick="window.permanentlyDeleteArchivedMessage && window.permanentlyDeleteArchivedMessage(${msg.id})"
              class="px-5 py-2.5 bg-gray-50 border border-gray-200 text-gray-400 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-all duration-300 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest rounded-xl"
              title="Zmazať natrvalo"
            >
              <span class="icon-trash"></span>
              Zmazať
            </button>
          </div>
        </div>
        <div class="bg-gray-50 p-6 rounded-xl border-l-4 border-gray-300 text-gray-700 whitespace-pre-wrap break-words leading-relaxed text-sm font-medium italic">
          ${escapeHtml(msg.message)}
        </div>
      </div>
    `;
  }

  private updatePagination(total: number, limit: number): void {
    const pagination: PaginationState = {
      currentPage: this.currentPage,
      totalPages: Math.ceil(total / limit),
      totalItems: total,
      itemsPerPage: limit,
    };

    updatePaginationControls(
      pagination,
      this.elements.currentPageNum,
      this.elements.prevPageBtn,
      this.elements.nextPageBtn,
      this.elements.paginationControls,
    );
  }

  private switchToActiveView(): void {
    this.currentView = "active";
    this.currentPage = 1;

    // Update tab styling
    if (this.elements.activeTab) {
      this.elements.activeTab.classList.add("text-primary", "border-primary");
      this.elements.activeTab.classList.remove(
        "text-gray-400",
        "border-transparent",
      );
    }
    if (this.elements.archivedTab) {
      this.elements.archivedTab.classList.add(
        "text-gray-400",
        "border-transparent",
      );
      this.elements.archivedTab.classList.remove(
        "text-primary",
        "border-primary",
      );
    }

    // Hide archived container and its empty state
    this.elements.archivedContainer?.classList.add("hidden");
    this.elements.noArchivedMessages?.classList.add("hidden");

    // Show active container
    this.elements.activeContainer?.classList.remove("hidden");

    this.loadActiveMessages();
  }

  private switchToArchivedView(): void {
    this.currentView = "archived";
    this.currentPage = 1;

    // Update tab styling
    if (this.elements.archivedTab) {
      this.elements.archivedTab.classList.add("text-primary", "border-primary");
      this.elements.archivedTab.classList.remove(
        "text-gray-400",
        "border-transparent",
      );
    }
    if (this.elements.activeTab) {
      this.elements.activeTab.classList.add(
        "text-gray-400",
        "border-transparent",
      );
      this.elements.activeTab.classList.remove(
        "text-primary",
        "border-primary",
      );
    }

    // Hide active container and its empty state
    this.elements.activeContainer?.classList.add("hidden");
    this.elements.noActiveMessages?.classList.add("hidden");

    // Show archived container
    this.elements.archivedContainer?.classList.remove("hidden");

    this.loadArchivedMessages();
  }

  private handlePrevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.loadCurrentView();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  private handleNextPage(): void {
    this.currentPage++;
    this.loadCurrentView();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

export function initializeMessagesPage(
  elements: MessagesPageElements,
): MessagesPageController {
  return new MessagesPageController(elements);
}
