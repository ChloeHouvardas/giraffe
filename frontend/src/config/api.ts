const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const getApiUrl = (path: string): string => {
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
};

export const API_CONFIG = {
  baseUrl: API_BASE_URL,
} as const;
