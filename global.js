fetch('global.html?v=3')
  .then(response => response.text())
  .then(async data => {
    const temp = document.createElement('div');
    temp.innerHTML = data;

    const header = temp.querySelector('#site-header');
    const footer = temp.querySelector('#site-footer');

    const headerTarget = document.getElementById('global-header');
    const footerTarget = document.getElementById('global-footer');

    if (header && headerTarget) {
      headerTarget.innerHTML = header.innerHTML;
      await initializeAuthNavigation();
    }

    if (footer && footerTarget) {
      footerTarget.innerHTML = footer.innerHTML;
    }
  })
  .catch(error => {
    console.error('Error loading global header/footer:', error);
  });

async function initializeAuthNavigation() {
  const loginLink = document.getElementById('auth-login-link');
  const accountLink = document.getElementById('auth-account-link');
  const profileLink = document.getElementById('auth-profile-link');
  const logoutLink = document.getElementById('auth-logout-link');
  const accountStatus = document.getElementById('auth-account-status');

  if (!loginLink || !accountLink || !profileLink || !logoutLink) return;

  try {
    const [{ auth }, { onAuthStateChanged, signOut }] = await Promise.all([
      import('./firebase-dev.js'),
      import('https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js')
    ]);

    onAuthStateChanged(auth, (user) => {
      const signedIn = Boolean(user);
      loginLink.hidden = signedIn;
      accountLink.hidden = signedIn;
      profileLink.hidden = !signedIn;
      logoutLink.hidden = !signedIn;

      if (accountStatus) {
        accountStatus.textContent = user
          ? `Signed in${user.displayName ? ` as ${user.displayName}` : ''}`
          : 'You are browsing as a guest';
      }

      if (user) {
        profileLink.href = `profile.html?id=${encodeURIComponent(user.uid)}`;
      }
    });

    logoutLink.addEventListener('click', async (event) => {
      event.preventDefault();
      logoutLink.textContent = 'Logging Out…';
      logoutLink.style.pointerEvents = 'none';

      try {
        await signOut(auth);
        window.location.href = 'login.html';
      } catch (error) {
        console.error('Could not log out:', error);
        logoutLink.textContent = 'Log Out';
        logoutLink.style.pointerEvents = '';
        window.alert('You could not be logged out. Please try again.');
      }
    });
  } catch (error) {
    console.error('Error loading account navigation:', error);
    if (accountStatus) accountStatus.textContent = 'Account status unavailable';
  }
}

function toggleWatchNav() {
  const nav = document.getElementById('mainNav');
  if (nav) {
    nav.classList.toggle('show-watch-nav');
  }
}

/* 🔥 UPDATED SHARE FUNCTION (mobile + desktop friendly) */
function shareCurrentPage() {
  const path = window.location.pathname;
  const fullUrl = 'https://curiositydrop.com' + path;

  if (navigator.share) {
    navigator.share({
      title: document.title,
      url: fullUrl
    }).catch(() => {});
    return;
  }

  window.open(
    'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(fullUrl),
    '_blank',
    'width=600,height=500'
  );
}

/* Temporary popup kill switch — remove when the release is ready. */
document.addEventListener('DOMContentLoaded', function () {
  const featuredPopup = document.getElementById('featured-popup');

  if (featuredPopup) {
    featuredPopup.classList.add('is-hidden');
    featuredPopup.style.display = 'none';
  }
});

/* Test community controls: owners can edit/delete; admins can delete any post. */
if (window.location.pathname.endsWith('/community.html')) {
  import('./post-owner-controls.js').catch((error) => {
    console.error('Error loading post owner controls:', error);
  });
}