export interface Message {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
  created_at: string;
}

export interface PaginatedMessages {
  data: Message[];
  total: number;
  page: number;
  limit: number;
}

export interface ArchivedMessage {
  id: number;
  original_id: number;
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
  created_at: string;
  archived_at: string;
}

export interface PaginatedArchivedMessages {
  data: ArchivedMessage[];
  total: number;
  page: number;
  limit: number;
}

export interface OfferSummary {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string | null;
  link: string | null;
  image_mime: string | null;
  created_at: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface BlogPost {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  image_mime: string | null;
  published: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminStatus {
  authenticated: boolean;
  setup_required: boolean;
  current_user_id: number | null;
  current_username: string | null;
}

export interface AdminUser {
  id: number;
  username: string;
  created_at: string;
  updated_at: string;
}

export interface AdminUserInvite {
  id: number;
  username: string;
  token: string;
  invite_path: string;
  expires_at: string;
  created_at: string;
}

export interface EmergencyBanner {
  id: number;
  title: string;
  message: string;
  tone: "critical" | "warning" | "info" | string;
  link_label: string | null;
  link_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

import { apiClient } from "./api-client";

class AdminApi {
  async getStatus(): Promise<AdminStatus> {
    return apiClient.get<AdminStatus>("/admin/status");
  }

  async login(username: string, password: string): Promise<void> {
    await apiClient.post<void>("/admin/login", {
      body: JSON.stringify({ username, password }),
    });
  }

  async setupFirstUser(username: string, password: string): Promise<AdminUser> {
    return apiClient.post<AdminUser>("/admin/setup", {
      body: JSON.stringify({ username, password }),
    });
  }

  async getInviteStatus(token: string): Promise<AdminUserInvite> {
    return apiClient.get<AdminUserInvite>("/admin/invite/status", {
      params: { token },
    });
  }

  async acceptInvite(token: string, password: string): Promise<AdminUser> {
    return apiClient.post<AdminUser>("/admin/invite/accept", {
      body: JSON.stringify({ token, password }),
    });
  }

  async logout(): Promise<void> {
    await fetch("/admin/logout", { method: "POST" });
  }

  async checkAuth(): Promise<boolean> {
    const status = await this.getStatus();
    return status.authenticated;
  }

  async getMessages(
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedMessages> {
    return apiClient.get<PaginatedMessages>("/admin/api/messages", {
      params: { page, limit },
    });
  }

  async deleteMessage(id: number): Promise<void> {
    return apiClient.delete<void>(`/admin/api/messages/${id}`);
  }

  async archiveMessage(id: number): Promise<void> {
    return apiClient.post<void>(`/admin/api/messages/${id}/archive`, {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "archive" }),
    });
  }

  async restoreMessage(id: number): Promise<void> {
    return apiClient.post<void>(`/admin/api/messages/${id}/archive`, {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "restore" }),
    });
  }

  async getArchivedMessages(
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedArchivedMessages> {
    return apiClient.get<PaginatedArchivedMessages>(
      "/admin/api/archived/messages",
      {
        params: { page, limit },
      },
    );
  }

  async permanentlyDeleteArchivedMessage(id: number): Promise<void> {
    return apiClient.delete<void>(`/admin/api/archived/messages/${id}`);
  }

  async createOffer(formData: FormData): Promise<OfferSummary> {
    return apiClient.postMultipart<OfferSummary>("/admin/api/offers", formData);
  }

  async getUsers(): Promise<AdminUser[]> {
    return apiClient.get<AdminUser[]>("/admin/api/users");
  }

  async getInvites(): Promise<AdminUserInvite[]> {
    return apiClient.get<AdminUserInvite[]>("/admin/api/users/invites");
  }

  async createInvite(username: string): Promise<AdminUserInvite> {
    return apiClient.post<AdminUserInvite>("/admin/api/users/invites", {
      body: JSON.stringify({ username }),
    });
  }

  async deleteInvite(id: number): Promise<void> {
    return apiClient.delete<void>(`/admin/api/users/invites/${id}`);
  }

  async getEmergencyBanner(): Promise<EmergencyBanner | null> {
    return apiClient.get<EmergencyBanner | null>("/admin/api/emergency-banner");
  }

  async saveEmergencyBanner(payload: {
    title: string;
    message: string;
    tone: string;
    link_label: string;
    link_url: string;
    is_active: boolean;
  }): Promise<EmergencyBanner> {
    return apiClient.put<EmergencyBanner>("/admin/api/emergency-banner", {
      body: JSON.stringify(payload),
    });
  }

  async deleteEmergencyBanner(): Promise<void> {
    return apiClient.delete<void>("/admin/api/emergency-banner");
  }

  async createUser(username: string, password: string): Promise<AdminUser> {
    return apiClient.post<AdminUser>("/admin/api/users", {
      body: JSON.stringify({ username, password }),
    });
  }

  async updateUser(id: number, username: string, password?: string): Promise<void> {
    return apiClient.put<void>(`/admin/api/users/${id}`, {
      body: JSON.stringify({ username, password: password || null }),
    });
  }

  async deleteUser(id: number): Promise<void> {
    return apiClient.delete<void>(`/admin/api/users/${id}`);
  }

  async updateOffer(id: number, formData: FormData): Promise<void> {
    return apiClient.putMultipart<void>(`/admin/api/offers/${id}`, formData);
  }

  async deleteOffer(id: number): Promise<void> {
    return apiClient.delete<void>(`/admin/api/offers/${id}`);
  }

  async createBlogPost(formData: FormData): Promise<BlogPost> {
    return apiClient.postMultipart<BlogPost>("/admin/api/blog", formData);
  }

  async updateBlogPost(id: number, formData: FormData): Promise<void> {
    return apiClient.putMultipart<void>(`/admin/api/blog/${id}`, formData);
  }

  async deleteBlogPost(id: number): Promise<void> {
    return apiClient.delete<void>(`/admin/api/blog/${id}`);
  }

  async getAllBlogPosts(): Promise<BlogPost[]> {
    return apiClient.get<BlogPost[]>("/admin/api/blog");
  }
}

class PublicApi {
  async getOffers(): Promise<OfferSummary[]> {
    return apiClient.get<OfferSummary[]>("/api/offers");
  }

  async getOfferBySlug(slug: string): Promise<OfferSummary> {
    return apiClient.get<OfferSummary>(`/api/offers/${encodeURIComponent(slug)}`);
  }

  getOfferImageUrl(id: number): string {
    return `/api/offers/${id}/image`;
  }

  async getBlogPosts(): Promise<BlogPost[]> {
    return apiClient.get<BlogPost[]>("/api/blog");
  }

  async getEmergencyBanner(): Promise<EmergencyBanner | null> {
    return apiClient.get<EmergencyBanner | null>("/api/emergency-banner");
  }

  async getBlogPostBySlug(slug: string): Promise<BlogPost> {
    return apiClient.get<BlogPost>(`/api/blog/${encodeURIComponent(slug)}`);
  }

  getBlogPostImageUrl(id: number): string {
    return `/api/blog/${id}/image`;
  }
}

const publicApi = new PublicApi();

export const api = {
  admin: new AdminApi(),
  offers: publicApi,
  blog: publicApi,
};
