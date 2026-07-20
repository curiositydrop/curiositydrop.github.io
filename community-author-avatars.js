import { db } from './firebase-dev.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const style = document.createElement('style');
style.textContent = `
  .community-author-wrap {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .community-author-avatar {
    width: 44px;
    height: 44px;
    flex: 0 0 44px;
    border-radius: 10px;
    border: 1px solid rgba(0, 200, 180, 0.55);
    background: #0b0b0b;
    object-fit: cover;
  }

  .community-author-placeholder {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #00c8b4;
    font-weight: 900;
    font-size: 1rem;
    text-transform: uppercase;
  }

  @media (max-width: 600px) {
    .community-author-avatar {
      width: 40px;
      height: 40px;
      flex-basis: 40px;
    }
  }
`;
document.head.appendChild(style);

const profileCache = new Map();

function initialsFor(name) {
  return (name || 'BT')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('') || 'BT';
}

async function getProfile(userId) {
  if (!userId) return {};
  if (!profileCache.has(userId)) {
    profileCache.set(userId, (async () => {
      try {
        const profileSnapshot = await getDoc(doc(db, 'profiles', userId));
        if (profileSnapshot.exists()) return profileSnapshot.data();

        const userSnapshot = await getDoc(doc(db, 'users', userId));
        return userSnapshot.exists() ? userSnapshot.data() : {};
      } catch (error) {
        console.error('Could not load post author profile:', error);
        return {};
      }
    })());
  }
  return profileCache.get(userId);
}

async function addAvatar(article) {
  if (article.dataset.authorAvatarReady === 'true') return;

  const author = article.querySelector('.community-author');
  if (!author) return;

  const url = new URL(author.href, window.location.href);
  const userId = url.searchParams.get('id');
  if (!userId) return;

  article.dataset.authorAvatarReady = 'true';

  const wrap = document.createElement('div');
  wrap.className = 'community-author-wrap';

  const placeholder = document.createElement('span');
  placeholder.className = 'community-author-avatar community-author-placeholder';
  placeholder.textContent = initialsFor(author.textContent);
  placeholder.setAttribute('aria-hidden', 'true');

  author.parentNode.insertBefore(wrap, author);
  wrap.append(placeholder, author);

  const profile = await getProfile(userId);
  const imageUrl = profile.imageUrl || profile.profileImageUrl || profile.photoURL || '';
  if (!imageUrl || !placeholder.isConnected) return;

  const image = document.createElement('img');
  image.className = 'community-author-avatar';
  image.src = imageUrl;
  image.alt = `${profile.displayName || author.textContent || 'Member'} profile image`;
  image.loading = 'lazy';
  image.addEventListener('error', () => image.replaceWith(placeholder));
  placeholder.replaceWith(image);
}

function scanPosts() {
  document.querySelectorAll('.community-post').forEach((article) => {
    addAvatar(article);
  });
}

const feed = document.getElementById('feed');
if (feed) {
  new MutationObserver(scanPosts).observe(feed, { childList: true, subtree: true });
  scanPosts();
}
