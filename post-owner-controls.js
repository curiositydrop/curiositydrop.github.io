import { auth, db } from './firebase-dev.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import {
  collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc
} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const style = document.createElement('style');
style.textContent = `
  .post-owner-controls { display:flex; gap:8px; flex-wrap:wrap; margin-left:auto; }
  .post-owner-button { border:1px solid #555; border-radius:999px; padding:7px 12px; background:#0d0d0d; color:#ddd; font:inherit; font-size:.82rem; font-weight:800; cursor:pointer; }
  .post-owner-button:hover { border-color:#00c8b4; color:#00c8b4; }
  .post-owner-button.delete { border-color:#6b3535; color:#ffb4b4; }
  .post-owner-editor { display:grid; gap:10px; padding:14px; border:1px solid rgba(0,200,180,.38); border-radius:14px; background:#0d0d0d; }
  .post-owner-editor textarea, .post-owner-editor input { width:100%; box-sizing:border-box; padding:12px 13px; border:1px solid #444; border-radius:11px; background:#090909; color:#fff; font:inherit; }
  .post-owner-editor textarea { min-height:110px; resize:vertical; }
  .post-owner-editor-actions { display:flex; gap:8px; flex-wrap:wrap; }
  .post-owner-status { min-height:20px; margin:0; color:#ffb4b4; font-weight:700; }
  @media (max-width:600px) { .post-owner-controls { width:100%; margin-left:0; } }
`;
document.head.appendChild(style);

let currentUser = null;
let posts = [];

const normalizeUrl = (raw) => {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

const formatDate = (timestamp) => {
  if (!timestamp?.toDate) return 'Just now';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
  }).format(timestamp.toDate());
};

function findPostForArticle(article) {
  const author = article.querySelector('.community-author')?.textContent?.trim() || '';
  const body = article.querySelector('.community-post-body')?.textContent || '';
  const meta = article.querySelector('.community-post-meta')?.textContent?.trim() || '';

  return posts.find((post) => {
    const expectedMeta = `${post.accountType || 'member'} • ${post.category || 'general'} • ${formatDate(post.createdAt)}`;
    return post.authorName === author && (post.content || '') === body && expectedMeta === meta;
  });
}

function buildEditor(article, post, controls) {
  if (article.querySelector('.post-owner-editor')) return;

  const editor = document.createElement('form');
  editor.className = 'post-owner-editor';

  const content = document.createElement('textarea');
  content.maxLength = 3000;
  content.required = true;
  content.value = post.content || '';

  const link = document.createElement('input');
  link.type = 'text';
  link.maxLength = 500;
  link.placeholder = 'Optional link';
  link.value = post.linkUrl || '';

  const actions = document.createElement('div');
  actions.className = 'post-owner-editor-actions';

  const save = document.createElement('button');
  save.type = 'submit';
  save.className = 'post-owner-button';
  save.textContent = 'Save Changes';

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'post-owner-button';
  cancel.textContent = 'Cancel';

  const status = document.createElement('p');
  status.className = 'post-owner-status';

  actions.append(save, cancel);
  editor.append(content, link, actions, status);
  controls.insertAdjacentElement('afterend', editor);

  cancel.addEventListener('click', () => editor.remove());

  editor.addEventListener('submit', async (event) => {
    event.preventDefault();
    const newContent = content.value.trim();
    if (!newContent) {
      status.textContent = 'The post cannot be empty.';
      return;
    }

    save.disabled = true;
    status.textContent = 'Saving…';
    try {
      await updateDoc(doc(db, 'posts', post.id), {
        content: newContent,
        linkUrl: normalizeUrl(link.value),
        updatedAt: serverTimestamp()
      });
      editor.remove();
    } catch (error) {
      console.error(error);
      status.textContent = error.code === 'permission-denied'
        ? 'Post-edit permissions are not enabled yet.'
        : 'The post could not be updated.';
    } finally {
      save.disabled = false;
    }
  });
}

function addOwnerControls() {
  document.querySelectorAll('.community-post').forEach((article) => {
    if (article.dataset.ownerControlsReady === 'true') return;
    const post = findPostForArticle(article);
    if (!post || !currentUser || post.authorId !== currentUser.uid) return;

    article.dataset.ownerControlsReady = 'true';
    const header = article.querySelector('.community-post-header');
    if (!header) return;

    const controls = document.createElement('div');
    controls.className = 'post-owner-controls';

    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'post-owner-button';
    edit.textContent = 'Edit';

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'post-owner-button delete';
    remove.textContent = 'Delete';

    controls.append(edit, remove);
    header.appendChild(controls);

    edit.addEventListener('click', () => buildEditor(article, post, controls));

    remove.addEventListener('click', async () => {
      const confirmed = window.confirm('Delete this post permanently? This cannot be undone.');
      if (!confirmed) return;
      remove.disabled = true;
      try {
        await deleteDoc(doc(db, 'posts', post.id));
      } catch (error) {
        console.error(error);
        window.alert(error.code === 'permission-denied'
          ? 'Post-delete permissions are not enabled yet.'
          : 'The post could not be deleted.');
        remove.disabled = false;
      }
    });
  });
}

const observer = new MutationObserver(() => addOwnerControls());
const feed = document.getElementById('feed');
if (feed) observer.observe(feed, { childList: true, subtree: true });

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  document.querySelectorAll('.post-owner-controls, .post-owner-editor').forEach((item) => item.remove());
  document.querySelectorAll('.community-post').forEach((item) => delete item.dataset.ownerControlsReady);
  addOwnerControls();
});

const postsQuery = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
onSnapshot(postsQuery, (snapshot) => {
  posts = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  document.querySelectorAll('.community-post').forEach((item) => delete item.dataset.ownerControlsReady);
  addOwnerControls();
});
