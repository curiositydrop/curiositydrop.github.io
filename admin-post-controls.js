import { auth, db } from './firebase-dev.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { collection, deleteDoc, doc, onSnapshot, orderBy, query } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';
import { isAdminAccount } from './admin-access.js';

const style = document.createElement('style');
style.textContent = `
  .admin-post-delete-button {
    border:1px solid #7d3b3b;
    border-radius:999px;
    padding:7px 12px;
    background:#180d0d;
    color:#ffc0c0;
    font:inherit;
    font-size:.82rem;
    font-weight:900;
    cursor:pointer;
  }
  .admin-post-delete-button:hover { border-color:#ff7777; color:#fff; }
  .admin-post-delete-button:disabled { opacity:.55; cursor:wait; }
`;
document.head.appendChild(style);

let currentUser = null;
let adminMode = false;
let posts = [];

const formatDate = (timestamp) => {
  if (!timestamp?.toDate) return 'Just now';
  return new Intl.DateTimeFormat('en-US', {
    month:'short', day:'numeric', year:'numeric', hour:'numeric', minute:'2-digit'
  }).format(timestamp.toDate());
};

function findPost(article) {
  const author = article.querySelector('.community-author')?.textContent?.trim() || '';
  const body = article.querySelector('.community-post-body')?.textContent || '';
  const meta = article.querySelector('.community-post-meta')?.textContent?.trim() || '';

  return posts.find((post) => {
    const expectedMeta = `${post.accountType || 'member'} • ${post.category || 'general'} • ${formatDate(post.createdAt)}`;
    return post.authorName === author && (post.content || '') === body && expectedMeta === meta;
  });
}

function removeNonAdminDeleteButtons() {
  if (adminMode) return;
  document.querySelectorAll('.post-owner-button.delete, .admin-post-delete-button').forEach((button) => button.remove());
}

function installAdminDeleteButtons() {
  removeNonAdminDeleteButtons();
  if (!adminMode || !currentUser || !posts.length) return;

  document.querySelectorAll('.community-post').forEach((article) => {
    const post = findPost(article);
    if (!post) return;

    const header = article.querySelector('.community-post-header');
    if (!header) return;

    let controls = header.querySelector('.post-owner-controls');
    if (!controls) {
      controls = document.createElement('div');
      controls.className = 'post-owner-controls';
      header.appendChild(controls);
    }

    controls.querySelectorAll('.post-owner-button.delete').forEach((button) => button.remove());
    if (controls.querySelector('.admin-post-delete-button')) return;

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'admin-post-delete-button';
    remove.textContent = 'Admin Delete';
    remove.addEventListener('click', async () => {
      if (!window.confirm('Delete this post permanently? This cannot be undone.')) return;
      remove.disabled = true;
      remove.textContent = 'Deleting…';
      try {
        await deleteDoc(doc(db, 'posts', post.id));
      } catch (error) {
        console.error('Admin post deletion failed:', error);
        window.alert(error?.code === 'permission-denied'
          ? 'The delete was blocked by Firestore permissions.'
          : 'The post could not be deleted.');
        remove.disabled = false;
        remove.textContent = 'Admin Delete';
      }
    });
    controls.appendChild(remove);
  });
}

const feed = document.getElementById('feed');
if (feed) {
  new MutationObserver(installAdminDeleteButtons).observe(feed, { childList:true, subtree:true });
}

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  adminMode = isAdminAccount(user);
  installAdminDeleteButtons();
});

onSnapshot(query(collection(db, 'posts'), orderBy('createdAt', 'desc')), (snapshot) => {
  posts = snapshot.docs.map((item) => ({ id:item.id, ...item.data() }));
  installAdminDeleteButtons();
});
