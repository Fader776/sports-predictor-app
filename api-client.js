// Secure API client for SportIQ Analytics
class SportIQAPI {
  constructor(baseURL = 'http://localhost:3001') {
    this.baseURL = baseURL;
    this.token = localStorage.getItem('sportiq_token');
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;

    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'API error');
    }
    return response.json();
  }

  // Auth
  async register(email, password, name) {
    const data = await this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name })
    });
    this.token = data.token;
    localStorage.setItem('sportiq_token', data.token);
    return data;
  }

  async login(email, password) {
    const data = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    this.token = data.token;
    localStorage.setItem('sportiq_token', data.token);
    return data;
  }

  logout() {
    this.token = null;
    localStorage.removeItem('sportiq_token');
  }

  isLoggedIn() {
    return !!this.token;
  }

  // Data
  async getProfile() {
    return this.request('/api/user/profile');
  }

  async getReports() {
    return this.request('/api/reports');
  }

  async getPlans() {
    return this.request('/api/plans');
  }

  async createCheckout(planId, email, fullName) {
    return this.request('/api/checkout/session', {
      method: 'POST',
      body: JSON.stringify({ planId, email, fullName })
    });
  }

  async cancelSubscription() {
    return this.request('/api/user/subscription/cancel', { method: 'POST' });
  }
}

const api = new SportIQAPI(window.SPORTIQ_API_BASE || 'http://localhost:3001');
