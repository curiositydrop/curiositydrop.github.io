import { auth, db } from './firebase-dev.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { collection, doc, getDoc, getDocs, limit, query, where } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

let applying = false;
let resolvedProfile = null;
let resolvedProfileId = '';

const avatarUrlFor = (profile = {}) => profile.imageUrl || profile.avatarUrl || profile.profileImageUrl || profile.photoURL || '';

async function resolveOwnedProfile(user) {
  const composerName = document.getElementById('composer-name')?.textContent?.trim() || '';
  const preferredName = composerName && composerName !== 'Create a post'
    ? composerName
    : (user.displayName || '');

  try {
    const direct = await getDoc(doc(db, 'profiles', user.uid));
    if (direct.exists()) {
      const data = direct.data();
      if (avatarUrlFor(data) && (!preferredName || data.displayName === preferredName)) {
        return { id: direct.id, data };
      }
    }
  } catch (error) {
    console.error('Could not check direct community profile:', error);
  }

  try {
    const owned = await getDocs(query(collection(db, 'profiles'), where('ownerId', '==', user.uid), limit(20)));
    if (!owned.empty) {
      const choices = owned.docs.map((snapshot) => ({ id: snapshot.id, data: snapshot.data() }));
      const exact = choices.find(({ data }) => preferredName && data.displayName === preferredName);
      const admin = choices.find(({ data }) => /bandtroductions\s+admin/i.test(data.displayName || ''));
      const withAvatar = choices.find(({ data }) => Boolean(avatarUrlFor(data)));
      return exact || admin || withAvatar || choices[0];
    }
  } catch (error) {
    console.error('Could not find owned community profile:', error);
  }

  return null;
}

function applyComposerIdentity(user) {
  if (applying || !resolvedProfile) return;
  const avatar = document.getElementById('composer-avatar');
  const name = document.getElementById('composer-name');
  const type = document.getElementById('composer-type');
  const profileLink = document.getElementById('composer-profile-link');
  if (!avatar || !name) return;

  const imageUrl = avatarUrlFor(resolvedProfile);
  if (!imageUrl) return;

  applying = true;
  try {
    name.textContent = resolvedProfile.displayName || user.displayName || name.textContent;
    if (type) type.textContent = resolvedProfile.accountType === 'fan' ? 'Scene Supporter' : (resolvedProfile.accountType || 'Member');
    if (profileLink && resolvedProfileId) profileLink.href = `profile.html?id=${encodeURIComponent(resolvedProfileId)}`;

    const currentImage = avatar.querySelector('img');
    if (!currentImage || currentImage.src !== imageUrl) {
      const image = document.createElement('img');
      image.src = imageUrl;
      image.alt = `${resolvedProfile.displayName || 'Member'} profile image`;
      image.addEventListener('error', () => {
        avatar.textContent = (resolvedProfile.displayName || 'BT').split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
      });
      avatar.replaceChildren(image);
    }
  } finally {
    applying = false;
  }
}

onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  const match = await resolveOwnedProfile(user);
  if (!match) return;
  resolvedProfileId = match.id;
  resolvedProfile = match.data;

  const run = () => applyComposerIdentity(user);
  run();
  setTimeout(run, 250);
  setTimeout(run, 1000);

  const composer = document.getElementById('post-composer');
  if (composer) {
    new MutationObserver(run).observe(composer, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }
});
