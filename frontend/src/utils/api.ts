const BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';

class ApiError extends Error {
  public data: any;
  constructor(message: string, data?: any) {
    super(message);
    this.data = data;
  }
}

async function request(endpoint: string, options: RequestInit = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  try {
    const response = await fetch(url, { ...options, headers });
    
    // Attempt to parse JSON response
    let data;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      // Extract data.error or err.message
      const errorMessage = data?.error?.message || data?.error || data?.message || 'An error occurred while communicating with the server.';
      throw new ApiError(errorMessage, data);
    }

    return data;
  } catch (err: any) {
    // If it's already an ApiError (from the !response.ok block), just throw it
    if (err instanceof ApiError) {
      throw err;
    }
    // Network or other unexpected error
    throw new ApiError(err.message || 'An error occurred while communicating with the server.');
  }
}

export const api = {
  get: (endpoint: string, options?: RequestInit) => request(endpoint, { ...options, method: 'GET' }),
  post: (endpoint: string, data?: any, options?: RequestInit) => request(endpoint, { ...options, method: 'POST', body: data ? JSON.stringify(data) : undefined }),
  put: (endpoint: string, data?: any, options?: RequestInit) => request(endpoint, { ...options, method: 'PUT', body: data ? JSON.stringify(data) : undefined }),
  delete: (endpoint: string, options?: RequestInit) => request(endpoint, { ...options, method: 'DELETE' }),
};
