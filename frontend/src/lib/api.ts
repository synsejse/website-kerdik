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
    throw new ApiError(response.status, response.statusText);
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
      if (!res.ok) {
        throw new Error("Nesprávne heslo");
      }
    },

    async logout(): Promise<void> {
      await fetch("/admin/logout", { method: "POST" });
    },

    async checkAuth(): Promise<boolean> {
      const res = await fetch("/admin/check");
      return handleResponse<boolean>(res);
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
      const res = await fetch(`/admin/api/messages/${id}`, {
        method: "DELETE",
      });
      return handleResponse<void>(res);
    },
  },
};
