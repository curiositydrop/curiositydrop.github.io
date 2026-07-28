import { auth, db } from './firebase-dev.js';
import { addDoc, collection, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const pendingForms = new WeakSet();

function profileIdFromLink(link) {
  if (!link) return '';
  try {
    return new URL(link.href, window.location.href).searchParams.get('id') || '';
  } catch {
    return '';
  }
}

document.addEventListener('submit', (event) => {
  const form = event.target.closest?.('.comment-form');
  if (!form || pendingForms.has(form)) return;

  const user = auth.currentUser;
  const article = form.closest('.community-post');
  const authorLink = article?.querySelector('.community-author');
  const recipientId = profileIdFromLink(authorLink);
  const input = form.querySelector('textarea');
  const submittedComment = input?.value.trim() || '';

  if (!user || !recipientId || recipientId === user.uid || !submittedComment) return;

  pendingForms.add(form);
  const actorName = document.getElementById('composer-name')?.textContent?.trim()
    || user.displayName
    || 'BANDtroductions Member';

  window.setTimeout(async () => {
    try {
      // The existing comment handler clears the textarea only after Firestore
      // successfully saves the comment. Do not notify if the save failed.
      if (!input || input.value.trim() !== '') return;

      await addDoc(collection(db, 'notifications'), {
        recipientId,
        actorId: user.uid,
        actorName,
        type: 'comment',
        message: `${actorName} commented on your post.`,
        linkUrl: 'community.html',
        read: false,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Could not create comment notification:', error);
    } finally {
      pendingForms.delete(form);
    }
  }, 900);
}, true);
