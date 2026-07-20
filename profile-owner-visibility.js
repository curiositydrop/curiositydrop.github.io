import { auth } from './firebase-dev.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';

const style = document.createElement('style');
style.textContent = `
  .profile-page {
    width: 100% !important;
    max-width: none !important;
    padding: 14px 0 30px !important;
  }

  #profile-content {
    width: min(calc(100% - 16px), 760px) !important;
    margin-inline: auto !important;
    gap: 10px !important;
  }

  .profile-card {
    width: 100% !important;
    box-sizing: border-box !important;
    margin: 0 !important;
    padding: 18px !important;
    border: 1px solid #3b3b3b !important;
    border-radius: 16px !important;
    background: linear-gradient(145deg, #1a1a1a, #121212) !important;
    box-shadow: 0 8px 20px rgba(0,0,0,.28) !important;
  }

  .profile-cover {
    padding: 0 !important;
    border-color: #343434 !important;
    background-color: #111 !important;
  }

  .profile-cover::after {
    border-color: rgba(255,255,255,.08) !important;
  }

  .profile-avatar {
    border-color: #0ccfbd !important;
  }

  .profile-kicker,
  .profile-detail strong,
  .profile-feature-link span {
    color: #0ccfbd !important;
  }

  .profile-detail,
  .profile-feature-link {
    border-color: #333 !important;
    background: #0d0d0d !important;
  }

  .profile-badge,
  .profile-support-pill {
    border-color: #3a3a3a !important;
    background: #111 !important;
  }

  .profile-actions .auth-button,
  .profile-links .auth-button {
    border-radius: 999px !important;
  }

  @media (max-width: 650px) {
    #profile-content {
      width: calc(100% - 16px) !important;
      gap: 10px !important;
    }

    .profile-card {
      padding: 16px !important;
      border-radius: 15px !important;
    }

    .profile-cover {
      padding: 0 !important;
    }
  }
`;
document.head.appendChild(style);

const profileId = new URLSearchParams(window.location.search).get('id');
const editButton = document.getElementById('edit-profile');

onAuthStateChanged(auth, (user) => {
  if (!editButton) return;
  editButton.hidden = !user || !profileId || user.uid !== profileId;
});
