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
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    if (response.status === 401) {
      throw new ApiError(response.status, "Unauthorized");
    }
    const text = await response.text();
    throw new ApiError(response.status, text || response.statusText);
  }
  const text = await response.text();
  return text ? JSON.parse(text) : ({} as T);
}

export const api = {
  admin: {
    async login(password: string): Promise<void> {
      const res = await fetch("/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) throw new Error("Nesprávne heslo");
    },

    async logout(): Promise<void> {
      await fetch("/admin/logout", { method: "POST" });
    },

    async checkAuth(): Promise<boolean> {
      const res = await fetch("/admin/check");
      return res.ok;
    },

    async getMessages(
      page: number = 1,
      limit: number = 10,
    ): Promise<PaginatedMessages> {
      const res = await fetch(
        `/admin/api/messages?page=${page}&limit=${limit}`,
      );
      return handleResponse<PaginatedMessages>(res);
    },

    async deleteMessage(id: number): Promise<void> {
      // This endpoint was repurposed on the server side to archive messages.
      // It remains as a convenience wrapper for the "archive" DELETE action.
      const res = await fetch(`/admin/api/messages/${id}`, {
        method: "DELETE",
      });
      return handleResponse<void>(res);
    },

    async archiveMessage(id: number): Promise<void> {
      const res = await fetch(`/admin/api/messages/${id}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive" }),
      });
      return handleResponse<void>(res);
    },

    async restoreMessage(id: number): Promise<void> {
      const res = await fetch(`/admin/api/messages/${id}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore" }),
      });
      return handleResponse<void>(res);
    },

    async getArchivedMessages(
      page: number = 1,
      limit: number = 10,
    ): Promise<PaginatedArchivedMessages> {
      const res = await fetch(
        `/admin/api/archived/messages?page=${page}&limit=${limit}`,
      );
      return handleResponse<PaginatedArchivedMessages>(res);
    },

    async permanentlyDeleteArchivedMessage(id: number): Promise<void> {
      const res = await fetch(`/admin/api/archived/messages/${id}`, {
        method: "DELETE",
      });
      return handleResponse<void>(res);
    },

    // --- Admin Offer Mutations ---
    async createOffer(data: any): Promise<OfferSummary> {
      // Accept either a FormData (from the form) or a plain object and convert to FormData
      let body: FormData;
      if (data instanceof FormData) {
        body = data;
      } else {
        body = new FormData();
        body.append("title", data.title);
        body.append("slug", data.slug);
        if (data.description !== undefined && data.description !== null) {
          body.append("description", data.description);
        }
        if (data.link !== undefined && data.link !== null) {
          body.append("link", data.link);
        }

        // If a file input was provided use it directly
        if (data.image_file) {
          body.append("image", data.image_file);
        }
      }

      const res = await fetch("/admin/api/offers", {
        method: "POST",
        // Do not set Content-Type header when sending FormData; the browser will set the boundary
        body,
      });
      return handleResponse<OfferSummary>(res);
    },

    async updateOffer(id: number, data: any): Promise<void> {
      // Accept either a FormData (from the form) or a plain object and convert to FormData
      let body: FormData;
      if (data instanceof FormData) {
        body = data;
      } else {
        body = new FormData();
        body.append("title", data.title);
        body.append("slug", data.slug);
        if (data.description !== undefined && data.description !== null) {
          body.append("description", data.description);
        }
        if (data.link !== undefined && data.link !== null) {
          body.append("link", data.link);
        }
        // keep_existing_image is expected by the backend as 'true'/'false' string
        body.append(
          "keep_existing_image",
          data.keep_existing_image ? "true" : "false",
        );

        if (data.image_file) {
          body.append("image", data.image_file);
        }
      }

      const res = await fetch(`/admin/api/offers/${id}`, {
        method: "PUT",
        // Do not set Content-Type header for FormData requests
        body,
      });
      return handleResponse<void>(res);
    },

    async deleteOffer(id: number): Promise<void> {
      const res = await fetch(`/admin/api/offers/${id}`, { method: "DELETE" });
      return handleResponse<void>(res);
    },
  },

  // Shared Offers API (Used by both Public site and Admin UI)
  offers: {
    async getOffers(): Promise<OfferSummary[]> {
      const res = await fetch("/api/offers");
      return handleResponse<OfferSummary[]>(res);
    },

    getOfferImageUrl(id: number): string {
      // Added a cache-buster 't' parameter as an option for updates
      return `/api/offers/${id}/image`;
    },
  },
};
