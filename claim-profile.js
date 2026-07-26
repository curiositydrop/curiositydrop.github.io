import { auth, db } from './firebase-dev.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { doc, serverTimestamp, setDoc } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const params = new URLSearchParams(location.search);
const legacyPage = params.get('page') || '';
const profileName = params.get('name') || 'Existing Profile';
const accountType = (params.get('type') || '').toLowerCase();
const imageUrl = params.get('image') || '';
const locationText = params.get('location') || '';
const genre = params.get('genre') || '';
const instruments = params.get('instruments') || '';
const venueType = params.get('venueType') || '';
const linkEmail = normalizeEmail(params.get('email') || '');

const claimEmailOverrides = {
  'burning-time.html': 'bandtroductions@gmail.com'
};

const legacyProfileSeeds = {
  'burning-time.html': {
    accountType: 'band',
    displayName: 'Burning Time',
    location: 'Saco, ME',
    genre: 'Rock / Metal',
    imageUrl: 'IMG_5121.jpeg',
    bannerImageUrl: 'IMG_0389.jpeg',
    bio: "Burning Time has been playing together since 2014 with a sound described as heavy meets melodic rock. They have performed at local clubs and festivals while building a loyal fan base and keeping the spirit of rock alive.",
    members: 'Kris Hype – Vocals/Guitar; Dan Aldrich – Drums; Doug Waycott – Bass; Carl Watson – Guitar; Jarred Desrochers – Guitar',
    bookingEmail: 'bandtroductions@gmail.com',
    website: 'https://www.burningtimemusic.com',
    mediaLink: 'https://www.youtube.com/watch?v=RyAK3AAX49g',
    yearFormed: '2014'
  }
};

const status = document.getElementById('claim-status');
const summary = document.getElementById('claim-summary');
const controls = document.getElementById('claim-controls');
const claimButton = document.getElementById('claim-button');
const returnTo = `${location.pathname.split('/').pop()}${location.search}`;

let currentUser = null;
let requiredEmail = '';

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function pageKey() {
  return legacyPage.split('/').pop().toLowerCase();
}

function buildSummary() {
  summary.replaceChildren();

  if (imageUrl) {
    const image = document.createElement('img');
    image.className = 'claim-image';
    image.src = imageUrl;
    image.alt = `${profileName} profile image`;
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

function getRequiredEmail() {
  return normalizeEmail(claimEmailOverrides[pageKey()] || linkEmail);
}

function showSignedOutPrompt() {
  const login = `login.html?returnTo=${encodeURIComponent(returnTo)}`;
  const signup = `signup.html?returnTo=${encodeURIComponent(returnTo)}`;
  status.innerHTML = `Please <a href="${signup}">create an account</a> using the email address associated with this profile, or <a href="${login}">log in</a> if you already have one.`;
}

function buildProfileData() {
  const seed = legacyProfileSeeds[pageKey()] || {};
  return {
    ...seed,
    accountType: seed.accountType || accountType,
    displayName: seed.displayName || profileName,
    imageUrl: seed.imageUrl || imageUrl,
    location: seed.location || locationText,
    genre: seed.genre || genre,
    instruments: seed.instruments || instruments,
    venueType: seed.venueType || venueType,
    ownerId: currentUser.uid,
    legacyPage,
    claimEmail: requiredEmail,
    claimedLegacyProfile: true,
    claimMethod: 'matching-account-email',
    claimedByEmail: currentUser.email || '',
    claimedAt: serverTimestamp(),
    approvalStatus: 'approved',
    published: true,
    approvedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
}

buildSummary();

onAuthStateChanged(auth, user => {
  currentUser = user;
  controls.hidden = true;

  if (!legacyPage || !profileName || !['band', 'musician', 'venue'].includes(accountType)) {
    status.textContent = 'This claim link is missing required profile information.';
    return;
  }

  requiredEmail = getRequiredEmail();

  if (!requiredEmail) {
    status.textContent = 'This legacy profile does not have a claim email assigned yet. Contact BANDtroductions so it can be prepared.';
    return;
  }

  if (!user) {
    showSignedOutPrompt();
    return;
  }

  const signedInEmail = normalizeEmail(user.email);
  if (signedInEmail !== requiredEmail) {
    status.innerHTML = `You are logged in as <strong>${user.email || 'an account without an email'}</strong>, but that email does not match the email associated with <strong>${profileName}</strong>. Log out and use the correct account.`;
    return;
  }

  status.innerHTML = `<strong>We found you!</strong><br>Your account matches the existing <strong>${profileName}</strong> profile. Click <strong>Finalize Claim</strong> to connect it.`;
  controls.hidden = false;
});

claimButton.addEventListener('click', async () => {
  if (!currentUser) return;

  requiredEmail = getRequiredEmail();
  if (!requiredEmail || normalizeEmail(currentUser.email) !== requiredEmail) {
    status.textContent = 'Your account email does not match the email associated with this profile.';
    return;
  }

  claimButton.disabled = true;
  status.textContent = 'Connecting the existing profile to your account…';

  try {
    const profileData = buildProfileData();

    // Replace the account profile document so old test data cannot blend into the legacy profile.
    await setDoc(doc(db, 'profiles', currentUser.uid), profileData);

    await setDoc(doc(db, 'users', currentUser.uid), {
      accountType: profileData.accountType,
      displayName: profileData.displayName,
      activeProfileId: currentUser.uid,
      profileComplete: true,
      claimedLegacyProfile: true,
      updatedAt: serverTimestamp()
    }, { merge: true });

    controls.hidden = true;
    status.innerHTML = `<strong>Profile claimed!</strong><br>${profileData.displayName} is now connected to your account. Loading your profile…`;
    setTimeout(() => {
      window.location.href = `profile.html?id=${encodeURIComponent(currentUser.uid)}`;
    }, 800);
  } catch (error) {
    console.error('Profile claim failed:', error);
    const code = error?.code ? ` (${error.code})` : '';
    status.textContent = `The profile could not be connected${code}. Please try again.`;
    claimButton.disabled = false;
  }
});
