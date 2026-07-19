fetch('global.html?v=1')
  .then(response => response.text())
  .then(data => {
    const temp = document.createElement('div');
    temp.innerHTML = data;

    const header = temp.querySelector('#site-header');
    const footer = temp.querySelector('#site-footer');

    const headerTarget = document.getElementById('global-header');
    const footerTarget = document.getElementById('global-footer');

    if (header && headerTarget) {
      headerTarget.innerHTML = header.innerHTML;
    }

    if (footer && footerTarget) {
      footerTarget.innerHTML = footer.innerHTML;
    }
  })
  .catch(error => {
    console.error('Error loading global header/footer:', error);
  });

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

/* Test community owner controls: edit and delete only the signed-in user's posts. */
if (window.location.pathname.endsWith('/community.html')) {
  import('./post-owner-controls.js').catch((error) => {
    console.error('Error loading post owner controls:', error);
  });
}
