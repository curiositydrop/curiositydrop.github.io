import { auth, db } from './firebase-dev.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import {
  collection, deleteDoc, doc, getDoc, onSnapshot, orderBy, query
} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const style = document.createElement('style');
style.textContent = `
  .comment-delete-button {
    margin-left:auto;
    border:1px solid #6b3535;
    border-radius:999px;
    padding:5px 9px;
    background:#0d0d0d;
    color:#ffb4b4;
    font:inherit;
    font-size:.72rem;
    font-weight:800;
    cursor:pointer;
  }
  .comment-delete-button:hover { border-color:#ff7777; color:#fff; }
  .comment-delete-button:disabled { opacity:.55; cursor:wait; }
`;
document.head.appendChild(style);

let currentUser = null;
let isAdmin = false;
let posts = [];
const commentSubscriptions = new Map();

const formatDate = (timestamp) => {
  if (!timestamp?.toDate) return 'Just now';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
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

function addDeleteButtons(article, post, snapshot) {
  if (!currentUser) return;

  const items = [...article.querySelectorAll('.comment-list .comment-item')];
  const docs = snapshot.docs;

  items.forEach((item, index) => {
    const commentDoc = docs[index];
    if (!commentDoc) return;

    const comment = commentDoc.data();
    const isOwner = comment.authorId === currentUser.uid;
    const canDelete = isOwner || isAdmin;
    if (!canDelete) return;

    let button = item.querySelector('.comment-delete-button');
    if (button) {
      button.textContent = isAdmin && !isOwner ? 'Admin Delete' : 'Delete';
      return;
    }

    const top = item.querySelector('.comment-top');
    if (!top) return;

    button = document.createElement('button');
    button.type = 'button';
    button.className = 'comment-delete-button';
    button.textContent = isAdmin && !isOwner ? 'Admin Delete' : 'Delete';

    button.addEventListener('click', async () => {
      if (!window.confirm('Delete this comment permanently?')) return;
      const originalLabel = button.textContent;
      button.disabled = true;
      button.textContent = 'Deleting…';

      try {
        await deleteDoc(doc(db, 'posts', post.id, 'comments', commentDoc.id));
      } catch (error) {
        console.error('Could not delete comment:', error);
        window.alert(error.code === 'permission-denied'
          ? 'Comment-delete permission was denied.'
          : 'The comment could not be deleted.');
        button.disabled = false;
        button.textContent = originalLabel;
      }
    });

    top.appendChild(button);
  });
}

function subscribeToArticle(article) {
  if (!currentUser) return;
  const post = findPost(article);
  if (!post) return;

  article.dataset.commentControlsPostId = post.id;

  if (!commentSubscriptions.has(post.id)) {
    const commentsQuery = query(
      collection(db, 'posts', post.id, 'comments'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(commentsQuery, (snapshot) => {
      document.querySelectorAll(`.community-post[data-comment-controls-post-id="${post.id}"]`).forEach((matchingArticle) => {
        addDeleteButtons(matchingArticle, post, snapshot);
      });
    }, (error) => {
      console.error('Could not load comments for delete controls:', error);
    });

    commentSubscriptions.set(post.id, unsubscribe);
  }
}

function scan() {
  if (!currentUser || !posts.length) return;
  document.querySelectorAll('.community-post').forEach(subscribeToArticle);
}

const feed = document.getElementById('feed');
if (feed) {
  new MutationObserver(scan).observe(feed, { childList:true, subtree:true });
}

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  isAdmin = false;

  if (user) {
    try {
      const adminSnapshot = await getDoc(doc(db, 'admins', user.uid));
      isAdmin = adminSnapshot.exists();
    } catch (error) {
      console.error('Could not check comment-admin status:', error);
    }
  }

  scan();
});

onSnapshot(collection(db, 'posts'), (snapshot) => {
  posts = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  scan();
});