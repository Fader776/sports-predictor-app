const API_BASE = window.STICKERS_API_BASE || 'http://localhost:3000';

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
  document.getElementById('fullName')?.focus();
}

function closeCheckout() {
  modal.classList.add('hidden');
}

function selectPlan(card) {
  planCards.forEach((item) => item.classList.remove('selected'));
  card.classList.add('selected');
  activePlan = {
    id: card.dataset.id || card.dataset.name.toLowerCase().replace(/ plan$/, '').replace(/\s+/g, '-'),
    name: card.dataset.name,
    amount: Number(card.dataset.plan),
    price: `GHS ${Number(card.dataset.plan)}`
  };
}

planCards.forEach((card) => {
  card.addEventListener('click', () => {
    selectPlan(card);
    openCheckout();
  });
});

document.querySelectorAll('[data-target]').forEach((button) => {
  button.addEventListener('click', () => {
    document.getElementById(button.dataset.target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

document.querySelectorAll('.primary-btn').forEach((button) => {
  if (button.textContent.toLowerCase().includes('unlock')) button.addEventListener('click', () => openCheckout());
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
modal?.addEventListener('click', (event) => {
  if (event.target.dataset.close === 'true') closeCheckout();
});
document.getElementById('closeModal')?.addEventListener('click', closeCheckout);

methodOptions.forEach((option) => {
  option.addEventListener('click', () => {
    methodOptions.forEach((item) => item.classList.remove('selected'));
    option.classList.add('selected');
    option.querySelector('input').checked = true;
  });
});

function showNotice(message, kind = 'info') {
  const notice = document.createElement('div');
  notice.setAttribute('role', 'status');
  notice.className = `fixed bottom-5 left-1/2 -translate-x-1/2 z-[100] max-w-[90vw] rounded-xl px-4 py-3 text-sm shadow-lg ${kind === 'error' ? 'bg-red-600 text-white' : 'bg-brand text-black'}`;
  notice.textContent = message;
  document.body.appendChild(notice);
  setTimeout(() => notice.remove(), 5000);
}

checkoutForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submitButton = checkoutForm.querySelector('button[type="submit"]');
  const fullName = document.getElementById('fullName').value.trim();
  const email = document.getElementById('email').value.trim();

  if (!fullName || !email) {
    showNotice('Please enter your name and a valid email address.', 'error');
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = 'Creating secure checkout…';

  try {
    const response = await fetch(`${API_BASE}/api/checkout/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId: activePlan.id, fullName, email })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not create checkout session.');

    if (result.checkoutUrl) {
      window.location.assign(result.checkoutUrl);
    } else {
      showNotice(result.message || 'Sandbox mode: no payment was collected.');
      closeCheckout();
    }
  } catch (error) {
    showNotice(error.message || 'Checkout is currently unavailable.', 'error');
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Continue to secure checkout';
  }
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !modal.classList.contains('hidden')) closeCheckout();
});

window.addEventListener('load', () => {
  selectedPlanName.textContent = activePlan.name;
  selectedPlanPrice.textContent = activePlan.price;

  const disclaimer = document.createElement('div');
  disclaimer.className = 'max-w-6xl mx-auto px-4 py-3 text-center text-xs text-gray-300 bg-white/5 border-x border-b border-white/10';
  disclaimer.textContent = 'Information only — no guaranteed outcomes. This demo checkout does not collect money. Check local laws before launch.';
  document.querySelector('header')?.insertAdjacentElement('afterend', disclaimer);
});
