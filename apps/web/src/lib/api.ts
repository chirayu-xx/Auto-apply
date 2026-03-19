const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface FetchOptions extends RequestInit {
  token?: string;
}

async function request<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { token, ...fetchOptions } = options;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...fetchOptions,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || body.message || `Request failed: ${res.status}`);
  }

  return res.json();
}

export const api = {
  auth: {
    register: (data: { email: string; password: string; name: string }) =>
      request<{ accessToken: string; refreshToken: string; user: any }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    login: (data: { email: string; password: string }) =>
      request<{ accessToken: string; refreshToken: string; user: any }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    me: (token: string) =>
      request<any>('/api/auth/me', { token }),
    refresh: (refreshToken: string) =>
      request<{ accessToken: string; refreshToken: string }>('/api/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      }),
  },
  user: {
    getProfile: (token: string) =>
      request<any>('/api/user/profile', { token }),
    updateProfile: (token: string, data: any) =>
      request<any>('/api/user/profile', {
        method: 'PUT',
        body: JSON.stringify(data),
        token,
      }),
  },
  resume: {
    upload: async (token: string, file: File) => {
      const formData = new FormData();
      formData.append('resume', file);
      const res = await fetch(`${API_BASE}/api/resume/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Upload failed');
      }
      return res.json();
    },
    getParsed: (token: string) =>
      request<any>('/api/resume/parsed', { token }),
    updateParsed: (token: string, data: any) =>
      request<any>('/api/resume/parsed', {
        method: 'PUT',
        body: JSON.stringify(data),
        token,
      }),
  },
  jobs: {
    list: (token: string, params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<{ jobs: any[]; pagination: { total: number; page: number; limit: number; totalPages: number } }>(
        `/api/jobs${qs}`,
        { token }
      );
    },
    get: (token: string, id: string) =>
      request<any>(`/api/jobs/${encodeURIComponent(id)}`, { token }),
    scan: (token: string) =>
      request<{ message: string }>('/api/jobs/scan', { method: 'POST', token }),
    scanStatus: (token: string) =>
      request<{
        isScanning: boolean;
        tasks: { id: string; source: string; status: string; jobsFound: number; jobsMatched: number; startedAt: string | null; completedAt: string | null }[];
        summary: { totalJobsFound: number; totalJobsMatched: number };
      }>('/api/jobs/scan-status', { token }),
  },
  applications: {
    list: (token: string, params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<{ applications: any[]; pagination: { total: number; page: number; limit: number; totalPages: number } }>(
        `/api/applications${qs}`,
        { token }
      );
    },
    apply: (token: string, jobId: string) =>
      request<any>(`/api/applications/${encodeURIComponent(jobId)}/apply`, {
        method: 'POST',
        token,
      }),
    stats: (token: string) =>
      request<{ total: number; byStatus: Record<string, number> }>('/api/applications/stats', {
        token,
      }),
  },
  preferences: {
    get: (token: string) =>
      request<any>('/api/preferences', { token }),
    update: (token: string, data: any) =>
      request<any>('/api/preferences', {
        method: 'PUT',
        body: JSON.stringify(data),
        token,
      }),
  },
};
