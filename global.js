fetch('global.html?v=4')
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
  const accountBar = document.getElementById('auth-account-bar');
  const loginLink = document.getElementById('auth-login-link');
  const accountLink = document.getElementById('auth-account-link');
  const profileLink = document.getElementById('auth-profile-link');
  const logoutLink = document.getElementById('auth-logout-link');
  const accountStatus = document.getElementById('auth-account-status');

  if (!accountBar || !loginLink || !accountLink || !profileLink || !logoutLink) return;

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
        accountStatus.textContent = signedIn ? 'Signed in' : 'Browsing as a guest';
      }

      if (user) {
        profileLink.href = `profile.html?id=${encodeURIComponent(user.uid)}`;
      }

      accountBar.hidden = false;
      accountBar.style.display = 'flex';
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
    accountBar.hidden = true;
  }
}

function toggleWatchNav() {
  const nav = document.getElementById('mainNav');
  if (nav) nav.classList.toggle('show-watch-nav');
}

function shareCurrentPage() {
  const path = window.location.pathname;
  const fullUrl = 'https://curiositydrop.com' + path;

  if (navigator.share) {
    navigator.share({ title: document.title, url: fullUrl }).catch(() => {});
    return;
  }

  window.open(
    'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(fullUrl),
    '_blank',
    'width=600,height=500'
  );
}

document.addEventListener('DOMContentLoaded', function () {
  const featuredPopup = document.getElementById('featured-popup');
  if (featuredPopup) {
    featuredPopup.classList.add('is-hidden');
    featuredPopup.style.display = 'none';
  }
});

function removeLegacyComposerAvatar() {
  const heading = document.querySelector('.community-composer-heading');
  if (!heading) return;

  heading.querySelectorAll('.community-composer-identity').forEach((legacy) => {
    const nameBlock = legacy.querySelector('#composer-name')?.parentElement;
    const currentPerson = heading.querySelector('.community-composer-person');

    if (nameBlock && currentPerson && !currentPerson.contains(nameBlock)) {
      currentPerson.appendChild(nameBlock);
    }

    legacy.remove();
  });

  const avatars = [...heading.querySelectorAll('.community-author-avatar')];
  const preferred = heading.querySelector('.community-composer-person > .community-author-avatar');
  avatars.forEach((avatar) => {
    if (preferred && avatar !== preferred) avatar.remove();
  });
}

if (window.location.pathname.endsWith('/community.html')) {
  import('./post-owner-controls.js?v=8').then(() => {
    removeLegacyComposerAvatar();
    const composer = document.getElementById('post-composer');
    if (composer) {
      new MutationObserver(removeLegacyComposerAvatar).observe(composer, {
        childList: true,
        subtree: true
      });
    }
  }).catch((error) => {
    console.error('Error loading post owner controls:', error);
  });

  import('./admin-comment-controls.js?v=2').catch((error) => {
    console.error('Error loading comment controls:', error);
  });
}

if (window.location.pathname.endsWith('/profile.html')) {
  import('./profile-owner-guard.js?v=1').catch((error) => {
    console.error('Error loading profile ownership guard:', error);
  });
}
