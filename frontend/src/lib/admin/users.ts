import { api, type AdminStatus, type AdminUser } from "../api";
import { escapeHtml, showConfirmDialog } from "./utils";

declare global {
  interface Window {
    editAdminUser?: (id: number) => void;
    deleteAdminUser?: (id: number) => Promise<void>;
  }
}

export interface UsersPageElements {
  container: HTMLElement | null;
  loading: HTMLElement | null;
  noUsers: HTMLElement | null;
  addUserBtn: HTMLButtonElement | null;
  modal: HTMLElement | null;
  modalClose: HTMLButtonElement | null;
  modalCancel: HTMLButtonElement | null;
  form: HTMLFormElement | null;
  userId: HTMLInputElement | null;
  username: HTMLInputElement | null;
  password: HTMLInputElement | null;
}

class UsersPageController {
  private users: AdminUser[] = [];
  private status: AdminStatus | null = null;

  constructor(private elements: UsersPageElements) {
    this.bindEvents();
    this.loadUsers();
  }

  private bindEvents(): void {
    this.elements.addUserBtn?.addEventListener("click", () => this.openModal());
    this.elements.modalClose?.addEventListener("click", () => this.closeModal());
    this.elements.modalCancel?.addEventListener("click", () => this.closeModal());
    this.elements.form?.addEventListener("submit", (event) => this.handleSubmit(event));

    window.editAdminUser = (id: number) => this.editUser(id);
    window.deleteAdminUser = async (id: number) => this.deleteUser(id);
  }

  private async loadUsers(): Promise<void> {
    const { loading, container, noUsers } = this.elements;

    if (loading) loading.classList.remove("hidden");
    if (container) container.innerHTML = "";

    try {
      const [status, users] = await Promise.all([
        api.admin.getStatus(),
        api.admin.getUsers(),
      ]);
      this.status = status;
      this.users = users;

      if (this.users.length === 0) {
        noUsers?.classList.remove("hidden");
      } else {
        noUsers?.classList.add("hidden");
        this.renderUsers();
      }
    } catch (error) {
      console.error("Failed to load users:", error);
      alert("Chyba pri načítaní používateľov.");
    } finally {
      if (loading) loading.classList.add("hidden");
    }
  }

  private renderUsers(): void {
    if (!this.elements.container) return;

    this.elements.container.innerHTML = this.users
      .map((user) => this.renderUserCard(user))
      .join("");

    const editTemplate = document.getElementById("icon-edit") as HTMLTemplateElement | null;
    const trashTemplate = document.getElementById("icon-trash") as HTMLTemplateElement | null;

    if (editTemplate) {
      this.elements.container.querySelectorAll(".icon-edit").forEach((placeholder) => {
        placeholder.replaceWith(editTemplate.content.cloneNode(true));
      });
    }

    if (trashTemplate) {
      this.elements.container.querySelectorAll(".icon-trash").forEach((placeholder) => {
        placeholder.replaceWith(trashTemplate.content.cloneNode(true));
      });
    }
  }

  private renderUserCard(user: AdminUser): string {
    const createdAt = new Date(user.created_at).toLocaleDateString("sk-SK");
    const updatedAt = new Date(user.updated_at).toLocaleDateString("sk-SK");
    const isCurrentUser = this.status?.current_user_id === user.id;

    return `
      <div class="h-full bg-white border border-gray-200 rounded-2xl p-6 shadow-sm transition-all duration-300 hover:shadow-xl hover:border-primary/20 hover:-translate-y-1 flex flex-col">
        <div class="flex items-start justify-between gap-4 mb-3">
          <h3 class="m-0 text-lg font-bold text-gray-900 leading-tight break-words">${escapeHtml(user.username)}</h3>
          ${isCurrentUser ? '<span class="px-2 py-1 text-xs font-bold uppercase tracking-wider bg-blue-100 text-primary rounded">Vy</span>' : ""}
        </div>
        <p class="text-sm text-gray-500 mb-2"><strong>ID:</strong> <code class="bg-gray-100 px-2 py-1 rounded text-xs">${user.id}</code></p>
        <div class="text-xs text-gray-400 space-y-1 mb-4">
          <div>Vytvorený: ${createdAt}</div>
          <div>Aktualizovaný: ${updatedAt}</div>
        </div>
        <div class="mt-auto pt-4 flex gap-2">
          <button onclick="window.editAdminUser && window.editAdminUser(${user.id})" class="flex-1 px-3 py-2 bg-primary hover:bg-blue-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2">
            <span class="icon-edit"></span>
            Upraviť
          </button>
          <button ${isCurrentUser ? "disabled" : `onclick="window.deleteAdminUser && window.deleteAdminUser(${user.id})"`} class="px-3 py-2 bg-gray-50 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            <span class="icon-trash"></span>
          </button>
        </div>
      </div>
    `;
  }

  private openModal(user?: AdminUser): void {
    if (this.elements.userId) this.elements.userId.value = user ? String(user.id) : "";
    if (this.elements.username) this.elements.username.value = user?.username ?? "";
    if (this.elements.password) this.elements.password.value = "";
    this.elements.modal?.classList.remove("hidden");
  }

  private closeModal(): void {
    this.elements.modal?.classList.add("hidden");
    this.elements.form?.reset();
  }

  private editUser(id: number): void {
    const user = this.users.find((entry) => entry.id === id);
    if (!user) return;
    this.openModal(user);
  }

  private async deleteUser(id: number): Promise<void> {
    showConfirmDialog("Naozaj chcete odstrániť tohto používateľa?", async () => {
      try {
        await api.admin.deleteUser(id);
        await this.loadUsers();
      } catch (error) {
        console.error("Failed to delete user:", error);
        alert(error instanceof Error ? error.message : "Chyba pri mazaní používateľa.");
      }
    });
  }

  private async handleSubmit(event: Event): Promise<void> {
    event.preventDefault();

    const id = this.elements.userId?.value.trim();
    const username = this.elements.username?.value.trim() || "";
    const password = this.elements.password?.value || "";

    try {
      if (id) {
        await api.admin.updateUser(Number(id), username, password || undefined);
      } else {
        if (!password) {
          alert("Pri vytváraní používateľa je heslo povinné.");
          return;
        }
        await api.admin.createUser(username, password);
      }

      this.closeModal();
      await this.loadUsers();
    } catch (error) {
      console.error("Failed to save user:", error);
      alert(error instanceof Error ? error.message : "Chyba pri ukladaní používateľa.");
    }
  }
}

export function initializeUsersPage(elements: UsersPageElements): UsersPageController {
  return new UsersPageController(elements);
}
