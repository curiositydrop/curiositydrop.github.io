import { auth, db } from './firebase-dev.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { deleteDoc, doc, serverTimestamp, setDoc } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

export const ADMIN_EMAIL = 'mbergeron79@gmail.com';
export const SCENE_SUPPORTER_EMAIL = 'newleafpaintingcompany@gmail.com';

export function isAdminAccount(user) {
  return Boolean(user && String(user.email || '').trim().toLowerCase() === ADMIN_EMAIL);
}

async function normalizeSceneSupporter(user) {
  if (!user || String(user.email || '').trim().toLowerCase() !== SCENE_SUPPORTER_EMAIL) return;

  const roleData = {
    accountType: 'fan',
    sceneSupporter: true,
    isAdmin: false,
    updatedAt: serverTimestamp()
  };

  try {
    await Promise.all([
      setDoc(doc(db, 'users', user.uid), roleData, { merge: true }),
      setDoc(doc(db, 'profiles', user.uid), roleData, { merge: true })
    ]);
  } catch (error) {
    console.error('Could not update the Scene Supporter role:', error);
  }

  // Remove any old admins document when existing rules permit it.
  try {
    await deleteDoc(doc(db, 'admins', user.uid));
  } catch (error) {
    if (error?.code !== 'permission-denied' && error?.code !== 'not-found') {
      console.error('Could not remove the old administrator record:', error);
    }
  }
}

onAuthStateChanged(auth, normalizeSceneSupporter);
