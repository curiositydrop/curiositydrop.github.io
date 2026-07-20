import { auth, db } from './firebase-dev.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const style = document.createElement('style');
style.textContent = `
  .community-author-wrap,
  .community-composer-identity {
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
  const cleaned = (name || '').trim();
  if (!cleaned || cleaned === 'Create a post') return 'BT';

  return cleaned
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase() || 'BT';
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
        console.error('Could not load community profile image:', error);
        return {};
      }
    })());
  }
  return profileCache.get(userId);
}

function makePlaceholder(name) {
  const placeholder = document.createElement('span');
  placeholder.className = 'community-author-avatar community-author-placeholder';
  placeholder.textContent = initialsFor(name);
  placeholder.setAttribute('aria-hidden', 'true');
  return placeholder;
}

async function replaceWithProfileImage(placeholder, profile, fallbackName) {
  const imageUrl = profile.imageUrl || profile.profileImageUrl || profile.photoURL || '';
  if (!imageUrl || !placeholder.isConnected) return;

  const image = document.createElement('img');
  image.className = 'community-author-avatar';
  image.src = imageUrl;
  image.alt = `${profile.displayName || fallbackName || 'Member'} profile image`;
  image.loading = 'lazy';
  image.addEventListener('error', () => image.replaceWith(placeholder));
  placeholder.replaceWith(image);
}

async function addPostAvatar(article) {
  if (article.dataset.authorAvatarReady === 'true') return;

  const author = article.querySelector('.community-author');
  if (!author) return;

  const url = new URL(author.href, window.location.href);
  const userId = url.searchParams.get('id');
  if (!userId) return;

  article.dataset.authorAvatarReady = 'true';

  const wrap = document.createElement('div');
  wrap.className = 'community-author-wrap';

  const placeholder = makePlaceholder(author.textContent);
  author.parentNode.insertBefore(wrap, author);
  wrap.append(placeholder, author);

  const profile = await getProfile(userId);
  await replaceWithProfileImage(placeholder, profile, author.textContent);
}

function scanPosts() {
  document.querySelectorAll('.community-post').forEach((article) => {
    addPostAvatar(article);
  });
}

async function setupComposerAvatar(user) {
  const heading = document.querySelector('.community-composer-heading');
  const nameElement = document.getElementById('composer-name');
  if (!heading || !nameElement || !user) return;

  let identity = heading.querySelector('.community-composer-identity');
  let placeholder;

  if (!identity) {
    const textBlock = nameElement.parentElement;
    identity = document.createElement('div');
    identity.className = 'community-composer-identity';
    textBlock.parentNode.insertBefore(identity, textBlock);

    placeholder = makePlaceholder(nameElement.textContent);
    identity.append(placeholder, textBlock);
  } else {
    placeholder = identity.querySelector('.community-author-placeholder');
  }

  const updateInitials = () => {
    const currentPlaceholder = identity.querySelector('.community-author-placeholder');
    if (currentPlaceholder) {
      currentPlaceholder.textContent = initialsFor(nameElement.textContent);
    }
  };

  updateInitials();
  new MutationObserver(updateInitials).observe(nameElement, {
    childList: true,
    characterData: true,
    subtree: true
  });

  const profile = await getProfile(user.uid);
  const currentPlaceholder = identity.querySelector('.community-author-placeholder');
  if (currentPlaceholder) {
    currentPlaceholder.textContent = initialsFor(profile.displayName || nameElement.textContent);
    await replaceWithProfileImage(
      currentPlaceholder,
      profile,
      profile.displayName || nameElement.textContent
    );
  }
}

const feed = document.getElementById('feed');
if (feed) {
  new MutationObserver(scanPosts).observe(feed, { childList: true, subtree: true });
  scanPosts();
}

onAuthStateChanged(auth, (user) => {
  if (user) setupComposerAvatar(user);
});
