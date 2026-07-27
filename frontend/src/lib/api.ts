const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

class ApiClient {
  private token: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('kasirmu_token');
      if (!localStorage.getItem('kasirmu_device_id')) {
        const id = 'dev_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
        localStorage.setItem('kasirmu_device_id', id);
      }
    }
  }

  setToken(token: string) {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('kasirmu_token', token);
    }
  }

  clearToken() {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('kasirmu_token');
      localStorage.removeItem('kasirmu_user');
    }
  }

  getToken(): string | null {
    if (this.token) return this.token;
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('kasirmu_token');
    }
    return this.token;
  }

  private async request(path: string, options: RequestInit = {}) {
    const token = this.getToken();
    
    const headers = new Headers(options.headers);
    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const config = {
      ...options,
      headers,
      credentials: 'include' as const,
    };

    let response = await fetch(`${API_URL}${path}`, config);
    
    if (response.status === 401 && path !== '/auth/refresh' && path !== '/auth/login' && path !== '/auth/google') {
      try {
        const refreshResponse = await fetch(`${API_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });
        
        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          if (refreshData.accessToken) {
            this.setToken(refreshData.accessToken);
            headers.set('Authorization', `Bearer ${refreshData.accessToken}`);
            
            // Retry original request
            response = await fetch(`${API_URL}${path}`, {
              ...options,
              headers,
              credentials: 'include',
            });
          }
        }
      } catch (refreshErr) {
        console.error('Silent token refresh failed:', refreshErr);
      }

      if (response.status === 401) {
        this.clearToken();
        if (typeof window !== 'undefined' && window.location.pathname !== '/login' && window.location.pathname !== '/register') {
          window.location.href = '/login';
        }
      }
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Something went wrong');
    }

    return data;
  }

  get(path: string, options: RequestInit = {}) {
    return this.request(path, { ...options, method: 'GET' });
  }

  post(path: string, body: any, options: RequestInit = {}) {
    let finalBody = body;
    if ((path === '/auth/login' || path === '/auth/google') && typeof window !== 'undefined') {
      const devId = localStorage.getItem('kasirmu_device_id') || '';
      const ua = navigator.userAgent;
      
      let browser = 'Unknown Browser';
      if (/chrome|crios/i.test(ua) && !/edge|opr/i.test(ua)) browser = 'Chrome';
      else if (/firefox|iceweasel/i.test(ua)) browser = 'Firefox';
      else if (/safari/i.test(ua) && !/chrome|crios|edge|opr/i.test(ua)) browser = 'Safari';
      else if (/edge|edg/i.test(ua)) browser = 'Edge';
      
      let deviceName = 'Windows PC';
      if (/android/i.test(ua)) deviceName = 'Android Mobile';
      else if (/ipad/i.test(ua)) deviceName = 'iPad Tablet';
      else if (/iphone/i.test(ua)) deviceName = 'iPhone Mobile';
      else if (/mac/i.test(ua)) deviceName = 'Mac PC';
      else if (/linux/i.test(ua)) deviceName = 'Linux PC';

      finalBody = {
        ...body,
        deviceId: devId,
        deviceName: deviceName,
        browser: browser,
      };
    }
    return this.request(path, {
      ...options,
      method: 'POST',
      body: finalBody instanceof FormData ? finalBody : JSON.stringify(finalBody),
    });
  }

  put(path: string, body: any, options: RequestInit = {}) {
    return this.request(path, {
      ...options,
      method: 'PUT',
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  }

  patch(path: string, body: any, options: RequestInit = {}) {
    return this.request(path, {
      ...options,
      method: 'PATCH',
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  }

  delete(path: string, options: RequestInit = {}) {
    return this.request(path, { ...options, method: 'DELETE' });
  }
}

export const api = new ApiClient();
export default api;
