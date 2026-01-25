export interface ApiConfig {
  baseUrl?: string;
  defaultHeaders?: Record<string, string>;
}

export interface ApiRequestOptions extends RequestInit {
  params?: Record<string, string | number>;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class ApiClient {
  private config: Required<ApiConfig>;

  constructor(config: ApiConfig = {}) {
    this.config = {
      baseUrl: config.baseUrl || "",
      defaultHeaders: {
        "Content-Type": "application/json",
        ...config.defaultHeaders,
      },
    };
  }

  private buildUrl(
    path: string,
    params?: Record<string, string | number>,
  ): string {
    const baseUrl = this.config.baseUrl || window.location.origin;
    const url = new URL(path, baseUrl);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }
    return url.toString();
  }

  private normalizeHeaders(
    headersInit?: HeadersInit | Record<string, string>,
  ): Record<string, string> {
    if (!headersInit) {
      return {};
    }

    // Handle Headers object
    if (headersInit instanceof Headers) {
      const plainHeaders: Record<string, string> = {};
      headersInit.forEach((value, key) => {
        plainHeaders[key] = value;
      });
      return plainHeaders;
    }

    // Handle array of tuples
    if (Array.isArray(headersInit)) {
      const plainHeaders: Record<string, string> = {};
      for (const [key, value] of headersInit) {
        plainHeaders[key] = value;
      }
      return plainHeaders;
    }

    // Handle plain object (Record<string, string>)
    return headersInit as Record<string, string>;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const contentType = response.headers.get("content-type");
      let errorData: unknown;

      try {
        if (contentType?.includes("application/json")) {
          errorData = await response.json();
        } else {
          errorData = await response.text();
        }
      } catch {
        errorData = response.statusText;
      }

      throw new ApiError(
        response.status,
        typeof errorData === "string" ? errorData : response.statusText,
        errorData,
      );
    }

    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      return response.json();
    }

    const text = await response.text();
    return text ? JSON.parse(text) : ({} as T);
  }

  async get<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    const { params, ...fetchOptions } = options;
    const url = this.buildUrl(path, params);

    const response = await fetch(url, {
      ...fetchOptions,
      method: "GET",
      headers: {
        ...this.config.defaultHeaders,
        ...fetchOptions.headers,
      },
    });

    return this.handleResponse<T>(response);
  }

  async post<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    const { params, body, ...fetchOptions } = options;
    const url = this.buildUrl(path, params);

    const response = await fetch(url, {
      ...fetchOptions,
      method: "POST",
      headers: {
        ...this.config.defaultHeaders,
        ...fetchOptions.headers,
      },
      body,
    });

    return this.handleResponse<T>(response);
  }

  async put<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    const { params, body, ...fetchOptions } = options;
    const url = this.buildUrl(path, params);

    const response = await fetch(url, {
      ...fetchOptions,
      method: "PUT",
      headers: {
        ...this.config.defaultHeaders,
        ...fetchOptions.headers,
      },
      body,
    });

    return this.handleResponse<T>(response);
  }

  async delete<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    const { params, ...fetchOptions } = options;
    const url = this.buildUrl(path, params);

    const response = await fetch(url, {
      ...fetchOptions,
      method: "DELETE",
      headers: {
        ...this.config.defaultHeaders,
        ...fetchOptions.headers,
      },
    });

    return this.handleResponse<T>(response);
  }

  // Specialized method for multipart/form-data (file uploads)
  async postMultipart<T>(
    path: string,
    formData: FormData,
    options: Omit<ApiRequestOptions, "body"> = {},
  ): Promise<T> {
    const { params, ...fetchOptions } = options;
    const url = this.buildUrl(path, params);

    // For multipart, don't set Content-Type - browser will add boundary
    // Normalize headers first to ensure we have a plain object
    const combinedHeaders: Record<string, string> = {
      ...this.config.defaultHeaders,
      ...this.normalizeHeaders(fetchOptions.headers),
    };
    const { "Content-Type": _, ...headers } = combinedHeaders;

    const response = await fetch(url, {
      ...fetchOptions,
      method: "POST",
      headers,
      body: formData,
    });

    return this.handleResponse<T>(response);
  }

  // Specialized method for multipart/form-data (file uploads)
  async putMultipart<T>(
    path: string,
    formData: FormData,
    options: Omit<ApiRequestOptions, "body"> = {},
  ): Promise<T> {
    const { params, ...fetchOptions } = options;
    const url = this.buildUrl(path, params);

    // For multipart, don't set Content-Type - browser will add boundary
    // Normalize headers first to ensure we have a plain object
    const combinedHeaders: Record<string, string> = {
      ...this.config.defaultHeaders,
      ...this.normalizeHeaders(fetchOptions.headers),
    };
    const { "Content-Type": _, ...headers } = combinedHeaders;

    const response = await fetch(url, {
      ...fetchOptions,
      method: "PUT",
      headers,
      body: formData,
    });

    return this.handleResponse<T>(response);
  }
}

export const apiClient = new ApiClient();
