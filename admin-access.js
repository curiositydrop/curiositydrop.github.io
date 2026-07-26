import { auth, db } from './firebase-dev.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { deleteDoc, doc, serverTimestamp, setDoc } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

export const ADMIN_EMAIL = 'mbergeron79@gmail.com';
export const SCENE_SUPPORTER_EMAIL = 'newleafpaintingcompany@gmail.com';

const normalized = (value) => String(value || '').trim().toLowerCase();

export function isAdminAccount(user) {
  return Boolean(user && normalized(user.email) === ADMIN_EMAIL);
}

async function normalizeAccountRoles(user) {
  if (!user) return;
  const email = normalized(user.email);

  if (email === ADMIN_EMAIL) {
    try {
      await Promise.all([
        setDoc(doc(db, 'users', user.uid), {
          accountType: 'fan',
          displayName: 'BANDtroductions Admin',
          activeProfileId: user.uid,
          profileComplete: true,
          sceneSupporter: true,
          isAdmin: true,
          updatedAt: serverTimestamp()
        }, { merge: true }),
        setDoc(doc(db, 'profiles', user.uid), {
          ownerId: user.uid,
          accountType: 'fan',
          displayName: 'BANDtroductions Admin',
          profileEmoji: '🤘',
          bio: 'BANDtroductions administrator.',
          sceneSupporter: true,
          isAdmin: true,
          approvalStatus: 'approved',
          published: true,
          updatedAt: serverTimestamp()
        }),
        setDoc(doc(db, 'admins', user.uid), {
          email: ADMIN_EMAIL,
          active: true,
          updatedAt: serverTimestamp()
        }, { merge: true })
      ]);
    } catch (error) {
      console.error('Could not normalize the administrator account:', error);
    }
    return;
  }

  if (email === SCENE_SUPPORTER_EMAIL) {
    try {
      await Promise.all([
        setDoc(doc(db, 'users', user.uid), {
          accountType: 'fan',
          displayName: 'New Leaf Painting Company',
          activeProfileId: user.uid,
          profileComplete: true,
          sceneSupporter: true,
          isAdmin: false,
          updatedAt: serverTimestamp()
        }, { merge: true }),
        setDoc(doc(db, 'profiles', user.uid), {
          ownerId: user.uid,
          accountType: 'fan',
          displayName: 'New Leaf Painting Company',
          profileEmoji: '🍃',
          bio: 'Scene Supporter of independent and local music.',
          sceneSupporter: true,
          isAdmin: false,
          approvalStatus: 'approved',
          published: true,
          updatedAt: serverTimestamp()
        })
      ]);
    } catch (error) {
      console.error('Could not normalize the Scene Supporter account:', error);
    }

    try {
      await deleteDoc(doc(db, 'admins', user.uid));
    } catch (error) {
      if (error?.code !== 'permission-denied' && error?.code !== 'not-found') {
        console.error('Could not remove the old administrator record:', error);
      }
    }
  }
}

onAuthStateChanged(auth, normalizeAccountRoles);
