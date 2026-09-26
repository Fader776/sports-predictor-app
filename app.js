// Frontend API client for Stickers Predictor
class StickersAPI {
  constructor(baseURL = 'http://localhost:3000') {
    this.baseURL = baseURL;
    this.token = localStorage.getItem('stickers_token');
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'API error');
    }

    return response.json();
  }

  // Auth
  async register(email, password, name) {
    return this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name })
    });
  }

  async login(email, password) {
    const data = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    this.token = data.token;
    localStorage.setItem('stickers_token', data.token);
    return data;
  }

  logout() {
    this.token = null;
    localStorage.removeItem('stickers_token');
  }

  // Plans
  async getPlans() {
    return this.request('/api/plans');
  }

  // Checkout
  async createCheckoutSession(planId, email, fullName) {
    return this.request('/api/checkout/session', {
      method: 'POST',
      body: JSON.stringify({ planId, email, fullName })
    });
  }

  // User
  async getProfile() {
    return this.request('/api/user/profile');
  }

  async getOrders() {
    return this.request('/api/user/orders');
  }

  async cancelSubscription() {
    return this.request('/api/user/subscription/cancel', { method: 'POST' });
  }
}

// Initialize API client
const api = new StickersAPI(window.STICKERS_API_BASE || 'http://localhost:3000');

// UI Bindings
const modal = document.getElementById('checkoutModal');
const selectedPlanName = document.getElementById('selectedPlanName');
const selectedPlanPrice = document.getElementById('selectedPlanPrice');
const checkoutForm = document.getElementById('checkoutForm');
const copyNumberBtn = document.getElementById('copyNumberBtn');
const headerCta = document.getElementById('headerCta');
const planCards = document.querySelectorAll('.plan-card');
const methodOptions = document.querySelectorAll('.method-option');

let activePlan = { id: 'starter', name: 'Starter Plan', amount: 20, price: 'GHS 20' };

function openCheckout(plan = activePlan) {
  activePlan = plan;
  selectedPlanName.textContent = plan.name;
  selectedPlanPrice.textContent = `GHS ${plan.amount}`;
  modal.classList.remove('hidden');
}

function closeCheckout() {
  modal.classList.add('hidden');
}

function selectPlan(card) {
  planCards.forEach(c => c.classList.remove('selected'));
  card.classList.add('selected');
  activePlan = {
    id: card.dataset.plan.toLowerCase().replace(/\s+/g, ''),
    name: card.dataset.name,
    amount: Number(card.dataset.plan.match(/\d+/)[0]),
    price: card.querySelector('.price')?.textContent || `GHS ${card.dataset.plan}`
  };
}

planCards.forEach(card => {
  card.addEventListener('click', () => {
    selectPlan(card);
    openCheckout();
  });
});

document.querySelectorAll('[data-target]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.getElementById(btn.dataset.target)?.scrollIntoView({ behavior: 'smooth' });
  });
});

copyNumberBtn?.addEventListener('click', async () => {
  const number = '0534185665';
  try {
    await navigator.clipboard.writeText(number);
    copyNumberBtn.textContent = 'COPIED';
    setTimeout(() => { copyNumberBtn.textContent = 'COPY'; }, 1200);
  } catch {
    alert(`Payment number: ${number}`);
  }
});

headerCta?.addEventListener('click', () => openCheckout());
modal?.addEventListener('click', e => { if (e.target.dataset.close) closeCheckout(); });
document.getElementById('closeModal')?.addEventListener('click', closeCheckout);

methodOptions.forEach(opt => {
  opt.addEventListener('click', () => {
    methodOptions.forEach(o => o.classList.remove('selected'));
    opt.classList.add('selected');
    opt.querySelector('input').checked = true;
  });
});

function showNotice(msg, kind = 'info') {
  const notice = document.createElement('div');
  notice.className = `fixed bottom-5 left-1/2 -translate-x-1/2 z-[100] rounded-xl px-4 py-3 text-sm shadow-lg ${
    kind === 'error' ? 'bg-red-600 text-white' : 'bg-brand text-black'
  }`;
  notice.textContent = msg;
  document.body.appendChild(notice);
  setTimeout(() => notice.remove(), 5000);
}

checkoutForm?.addEventListener('submit', async e => {
  e.preventDefault();
  const btn = checkoutForm.querySelector('button[type="submit"]');
  const email = document.getElementById('email').value.trim();
  const fullName = document.getElementById('fullName').value.trim();

  if (!email || !fullName) {
    showNotice('Please enter your name and email.', 'error');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Creating checkout...';

  try {
    const result = await api.createCheckoutSession(activePlan.id, email, fullName);
    if (result.checkoutUrl) {
      window.location.href = result.checkoutUrl;
    } else {
      showNotice('Checkout created. In production, you would be redirected to Stripe.');
      closeCheckout();
    }
  } catch (error) {
    showNotice(error.message || 'Checkout failed', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Continue to Stripe';
  }
});

window.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeCheckout();
});

window.addEventListener('load', () => {
  selectedPlanName.textContent = activePlan.name;
  selectedPlanPrice.textContent = activePlan.price;
});
