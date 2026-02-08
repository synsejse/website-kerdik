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
  description: string | null;
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

import { apiClient, ApiError } from "./api-client";

class AdminApi {
  async login(password: string): Promise<void> {
    const res = await fetch("/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) throw new Error("Nesprávne heslo");
  }

  async logout(): Promise<void> {
    await fetch("/admin/logout", { method: "POST" });
  }

  async checkAuth(): Promise<boolean> {
    const res = await fetch("/admin/check");
    return res.ok;
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

  getOfferImageUrl(id: number): string {
    return `/api/offers/${id}/image`;
  }

  async getBlogPosts(): Promise<BlogPost[]> {
    return apiClient.get<BlogPost[]>("/api/blog");
  }

  async getBlogPostBySlug(slug: string): Promise<BlogPost> {
    return apiClient.get<BlogPost>(`/api/blog/${slug}`);
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
