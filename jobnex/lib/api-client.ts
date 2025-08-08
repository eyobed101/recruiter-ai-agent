import { User } from "firebase/auth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export async function fetchWithAuth(
  endpoint: string,
  user: User,
  options: RequestInit = {}
) {
  try {
    const token = await user.getIdToken();
    
    // Create headers without Content-Type for FormData
    const headers = new Headers(options.headers);
    headers.append("Authorization", `Bearer ${token}`);
    
    // Only set Content-Type if not FormData
    if (!(options.body instanceof FormData)) {
      headers.append("Content-Type", "application/json");
    }

    console.log("Request details:", {
      method: options.method || "GET",
      endpoint,
      headers: Object.fromEntries(headers.entries()),
      body: options.body
    });

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("API Error:", {
        status: response.status,
        statusText: response.statusText,
        errorData
      });
      throw new Error(errorData.detail || "Request failed");
    }

    return response.json();
  } catch (error) {
    console.error("Network Error:", error);
    throw error;
  }
}

// Public fetch without auth
export async function fetchPublic(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Request failed");
  }
  return response.json();
}