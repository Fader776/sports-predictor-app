const modal = document.getElementById('checkoutModal');
const selectedPlanName = document.getElementById('selectedPlanName');
const selectedPlanPrice = document.getElementById('selectedPlanPrice');
const checkoutForm = document.getElementById('checkoutForm');
const copyNumberBtn = document.getElementById('copyNumberBtn');
const headerCta = document.getElementById('headerCta');
const planCards = document.querySelectorAll('.plan-card');
const methodOptions = document.querySelectorAll('.method-option');

let activePlan = {
  name: 'Starter Plan',
  price: 'GHS 20',
  amount: 20,
};

function openCheckout(plan) {
  activePlan = plan;
  selectedPlanName.textContent = plan.name;
  selectedPlanPrice.textContent = `GHS ${plan.amount}`;
  modal.classList.remove('hidden');
}

function closeCheckout() {
  modal.classList.add('hidden');
}

function selectPlan(el) {
  planCards.forEach((card) => card.classList.remove('selected'));
  el.classList.add('selected');

  const plan = {
    name: el.dataset.name,
    amount: Number(el.dataset.plan),
  };

  activePlan = { ...plan, price: `GHS ${plan.amount}` };
  selectedPlanName.textContent = plan.name;
  selectedPlanPrice.textContent = `GHS ${plan.amount}`;
}

planCards.forEach((card) => {
  card.addEventListener('click', (event) => {
    if (event.target.closest('.plan-btn') || event.target.closest('.plan-card')) {
      selectPlan(card);
      openCheckout(activePlan);
    }
  });
});

document.querySelectorAll('[data-target]').forEach((button) => {
  button.addEventListener('click', () => {
    const targetId = button.dataset.target;
    const target = document.getElementById(targetId);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

copyNumberBtn.addEventListener('click', async () => {
  const number = '0534185665';
  try {
    await navigator.clipboard.writeText(number);
    copyNumberBtn.textContent = 'COPIED';
    setTimeout(() => {
      copyNumberBtn.textContent = 'COPY';
    }, 1200);
  } catch (error) {
    alert('Payment number: 0534185665');
  }
});

headerCta.addEventListener('click', () => {
  openCheckout(activePlan);
});

modal.addEventListener('click', (event) => {
  if (event.target.dataset.close === 'true') {
    closeCheckout();
  }
});

document.getElementById('closeModal').addEventListener('click', closeCheckout);

methodOptions.forEach((option) => {
  option.addEventListener('click', () => {
    methodOptions.forEach((item) => item.classList.remove('selected'));
    option.classList.add('selected');
    option.querySelector('input').checked = true;
  });
});

checkoutForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const formData = new FormData(checkoutForm);
  const method = formData.get('method');
  const fullName = document.getElementById('fullName').value.trim();
  const email = document.getElementById('email').value.trim();

  if (!fullName || !email) {
    alert('Please fill in your name and email address.');
    return;
  }

  const paymentMessage = `Payment confirmed for ${activePlan.name} (${activePlan.price}) via ${method.toUpperCase()}.`;
  alert(paymentMessage + '\nA confirmation email will be sent to ' + email + '.');
  closeCheckout();
  checkoutForm.reset();
  methodOptions.forEach((item) => {
    item.classList.remove('selected');
  });
  const firstOption = methodOptions[0];
  firstOption.classList.add('selected');
  firstOption.querySelector('input').checked = true;
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !modal.classList.contains('hidden')) {
    closeCheckout();
  }
});

window.addEventListener('load', () => {
  selectedPlanName.textContent = activePlan.name;
  selectedPlanPrice.textContent = activePlan.price;
});

