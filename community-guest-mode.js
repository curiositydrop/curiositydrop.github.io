import { auth } from './firebase-dev.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';

const updateGuestPrompt = () => {
  const prompt = document.getElementById('guest-prompt');
  if (!prompt) return;

  const message = prompt.querySelector('p');
  if (message) {
    message.textContent = 'Browsing read-only. Create an account to join the conversation.';
  }

  const loginLink = [...prompt.querySelectorAll('a')].find((link) =>
    /log in/i.test(link.textContent || '')
  );
  loginLink?.remove();

  const createLink = [...prompt.querySelectorAll('a')].find((link) =>
    /create account/i.test(link.textContent || '')
  );
  if (createLink) createLink.textContent = 'Create Account';
};

const observeGuestPrompt = () => {
  updateGuestPrompt();
  const prompt = document.getElementById('guest-prompt');
  if (!prompt) return;
  new MutationObserver(updateGuestPrompt).observe(prompt, {
    childList: true,
    subtree: true
  });
};

onAuthStateChanged(auth, (user) => {
  if (!user) observeGuestPrompt();
});
