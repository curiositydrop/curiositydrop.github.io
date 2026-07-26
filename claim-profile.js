import { auth, db } from './firebase-dev.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { collection, doc, getDocs, query, serverTimestamp, setDoc, where } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const params = new URLSearchParams(location.search);
const legacyPage = params.get('page') || '';
const profileName = params.get('name') || 'Existing Profile';
const accountType = (params.get('type') || '').toLowerCase();
const imageUrl = params.get('image') || '';
const locationText = params.get('location') || '';
const genre = params.get('genre') || '';
const instruments = params.get('instruments') || '';
const venueType = params.get('venueType') || '';

const status = document.getElementById('claim-status');
const summary = document.getElementById('claim-summary');
const controls = document.getElementById('claim-controls');
const certify = document.getElementById('claim-certify');
const certifyCopy = document.getElementById('claim-certify-copy');
const claimButton = document.getElementById('claim-button');
const returnTo = `${location.pathname.split('/').pop()}${location.search}`;

let currentUser = null;

function buildSummary() {
  summary.replaceChildren();

  if (imageUrl) {
    const image = document.createElement('img');
    image.className = 'claim-image';
    image.src = imageUrl;
    image.alt = '';
    summary.appendChild(image);
  }

  const copy = document.createElement('div');
  const title = document.createElement('h2');
  title.textContent = profileName;

  const meta = document.createElement('p');
  meta.className = 'approval-meta';
  meta.textContent = [accountType, locationText, genre || instruments || venueType]
    .filter(Boolean)
    .join(' • ');

  copy.append(title, meta);
  summary.appendChild(copy);
}

function certificationText() {
  if (accountType === 'musician') {
    return `I certify that I am ${profileName}, or that I am authorized to manage this profile on their behalf.`;
  }

  if (accountType === 'venue') {
    return `I certify that I own, manage, or am authorized to manage the ${profileName} profile.`;
  }

  return `I certify that I am a member of ${profileName}, or that I am authorized to manage this profile on behalf of the band.`;
}

async function findExistingOwner() {
  const snapshot = await getDocs(
    query(collection(db, 'profiles'), where('legacyPage', '==', legacyPage))
  );

  if (snapshot.empty) return null;
  return snapshot.docs[0].data();
}

buildSummary();
certifyCopy.textContent = certificationText();

certify.addEventListener('change', () => {
  claimButton.disabled = !certify.checked;
});

onAuthStateChanged(auth, async user => {
  currentUser = user;
  controls.hidden = true;

  if (!legacyPage || !profileName || !['band', 'musician', 'venue'].includes(accountType)) {
    status.textContent = 'This claim link is missing required profile information.';
    return;
  }

  if (!user) {
    const login = `login.html?returnTo=${encodeURIComponent(returnTo)}`;
    const signup = `signup.html?returnTo=${encodeURIComponent(returnTo)}`;
    status.innerHTML = `To claim this profile, <a href="${signup}">create an account</a> or <a href="${login}">log in</a>. You will return here after signing in.`;
    return;
  }

  try {
    const existingOwner = await findExistingOwner();

    if (existingOwner?.ownerId === user.uid) {
      status.innerHTML = `This profile is already connected to your account. <a href="profile.html?id=${encodeURIComponent(user.uid)}">Open your profile</a>.`;
      return;
    }

    if (existingOwner?.ownerId && existingOwner.ownerId !== user.uid) {
      status.textContent = 'This profile has already been claimed. Contact BANDtroductions if ownership needs to be corrected.';
      return;
    }

    status.textContent = `Logged in as ${user.email || user.displayName || 'your account'}. Check the certification below, then claim the profile.`;
    controls.hidden = false;
  } catch (error) {
    console.error('Could not check profile ownership:', error);
    status.textContent = 'This profile could not be checked right now. Please try again.';
  }
});

claimButton.addEventListener('click', async () => {
  if (!currentUser || !certify.checked) return;

  claimButton.disabled = true;
  status.textContent = 'Connecting this profile to your account…';

  try {
    const existingOwner = await findExistingOwner();

    if (existingOwner?.ownerId && existingOwner.ownerId !== currentUser.uid) {
      throw new Error('This profile has already been claimed.');
    }

    const profileData = {
      ownerId: currentUser.uid,
      accountType,
      displayName: profileName,
      imageUrl,
      location: locationText,
      genre,
      instruments,
      venueType,
      legacyPage,
      claimedLegacyProfile: true,
      claimMethod: 'self-certification',
      ownershipCertified: true,
      ownershipCertifiedByEmail: currentUser.email || '',
      ownershipCertifiedAt: serverTimestamp(),
      approvalStatus: 'approved',
      published: true,
      approvedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(doc(db, 'profiles', currentUser.uid), profileData, { merge: true });
    await setDoc(doc(db, 'users', currentUser.uid), {
      accountType,
      displayName: profileName,
      profileComplete: true,
      claimedLegacyProfile: true,
      updatedAt: serverTimestamp()
    }, { merge: true });

    controls.hidden = true;
    status.innerHTML = `<strong>Profile claimed!</strong><br>${profileName} is now connected to your account.`;

    setTimeout(() => {
      window.location.href = `profile.html?id=${encodeURIComponent(currentUser.uid)}`;
    }, 1000);
  } catch (error) {
    console.error('Profile claim failed:', error);
    status.textContent = error.message || 'The profile could not be connected to your account.';
    claimButton.disabled = false;
  }
});
