import { auth, db } from './firebase-dev.js';
import { onAuthStateChanged, reload, sendEmailVerification } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { addDoc, collection, doc, getDocs, query, serverTimestamp, setDoc, where } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const params = new URLSearchParams(location.search);
const legacyPage = params.get('page') || '';
const profileName = params.get('name') || 'Existing Profile';
const accountType = (params.get('type') || '').toLowerCase();
const imageUrl = params.get('image') || '';
const locationText = params.get('location') || '';
const genre = params.get('genre') || '';
const instruments = params.get('instruments') || '';
const venueType = params.get('venueType') || '';

const form = document.getElementById('claim-form');
const status = document.getElementById('claim-status');
const summary = document.getElementById('claim-summary');
const submit = document.getElementById('claim-submit');
const autoClaim = document.getElementById('auto-claim');
const claimChoices = document.getElementById('claim-choices');
const manualToggle = document.getElementById('manual-claim-toggle');
const returnTo = `${location.pathname.split('/').pop()}${location.search}`;
let currentUser = null;
let matchedEmail = false;

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

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
  meta.textContent = [accountType, locationText, genre || instruments || venueType].filter(Boolean).join(' • ');
  copy.append(title, meta);
  summary.appendChild(copy);
}

function showManualClaim(message = '') {
  claimChoices.hidden = true;
  form.hidden = false;
  if (message) status.textContent = message;
}

function safeLegacyUrl() {
  try {
    const url = new URL(legacyPage, location.href);
    if (url.origin !== location.origin) return null;
    return url;
  } catch {
    return null;
  }
}

async function profileEmails() {
  const url = safeLegacyUrl();
  if (!url) return [];
  const response = await fetch(url.href, { cache: 'no-store' });
  if (!response.ok) throw new Error('Existing profile could not be checked.');
  const html = await response.text();
  const page = new DOMParser().parseFromString(html, 'text/html');
  return [...page.querySelectorAll('a[href^="mailto:"]')]
    .map(link => {
      const href = link.getAttribute('href') || '';
      return normalizeEmail(decodeURIComponent(href.replace(/^mailto:/i, '').split('?')[0]));
    })
    .filter(Boolean);
}

async function checkExistingOwnership() {
  const owned = await getDocs(query(collection(db, 'profiles'), where('legacyPage', '==', legacyPage)));
  return owned.docs.find(profile => profile.id !== currentUser.uid && profile.data().ownerId !== currentUser.uid);
}

async function prepareClaim(user) {
  claimChoices.hidden = true;
  form.hidden = true;

  if (!user.emailVerified) {
    status.innerHTML = `We sent a verification link to <strong>${user.email || 'your email'}</strong>. Verify that address, then return here.`;
    claimChoices.hidden = false;
    autoClaim.hidden = true;
    document.getElementById('verification-actions').hidden = false;
    manualToggle.hidden = true;
    return;
  }

  document.getElementById('verification-actions').hidden = true;

  try {
    const alreadyOwned = await checkExistingOwnership();
    if (alreadyOwned) {
      status.textContent = 'This existing profile has already been claimed. Contact BANDtroductions if ownership needs to be corrected.';
      return;
    }

    const emails = await profileEmails();
    matchedEmail = emails.includes(normalizeEmail(user.email));

    if (matchedEmail) {
      status.innerHTML = `<strong>We found your profile!</strong><br>${profileName} matches the verified email on your BANDtroductions account.`;
      claimChoices.hidden = false;
      autoClaim.hidden = false;
      manualToggle.hidden = true;
      return;
    }

    status.textContent = emails.length
      ? 'That verified email does not match the email originally connected to this profile.'
      : 'This older profile does not have an email available for automatic matching.';
    claimChoices.hidden = false;
    autoClaim.hidden = true;
    manualToggle.hidden = false;
  } catch (error) {
    console.error('Could not check profile email:', error);
    status.textContent = 'Automatic matching is unavailable for this profile. You can still submit a manual claim.';
    claimChoices.hidden = false;
    autoClaim.hidden = true;
    manualToggle.hidden = false;
  }
}

buildSummary();

onAuthStateChanged(auth, async user => {
  currentUser = user;
  if (!user) {
    const login = `login.html?returnTo=${encodeURIComponent(returnTo)}`;
    const signup = `signup.html?returnTo=${encodeURIComponent(returnTo)}`;
    status.innerHTML = `To claim this profile, <a href="${signup}">create an account</a> using the email originally connected to it, or <a href="${login}">log in</a>.`;
    return;
  }

  if (!legacyPage || !profileName || !['band', 'musician', 'venue'].includes(accountType)) {
    status.textContent = 'This claim link is missing required profile information.';
    return;
  }

  try {
    const existing = await getDocs(query(collection(db, 'profileClaims'), where('claimantId', '==', user.uid), where('legacyPage', '==', legacyPage)));
    const active = existing.docs.find(claim => ['pending', 'approved'].includes(claim.data().status));
    if (active) {
      status.textContent = active.data().status === 'approved'
        ? 'This profile claim has already been approved.'
        : 'Your manual claim for this profile is already waiting for review.';
      return;
    }
  } catch (error) {
    console.error('Could not check existing claims:', error);
  }

  await prepareClaim(user);
});

document.getElementById('verification-refresh').addEventListener('click', async () => {
  if (!currentUser) return;
  status.textContent = 'Checking your verification…';
  try {
    await reload(currentUser);
    currentUser = auth.currentUser;
    if (!currentUser.emailVerified) {
      status.textContent = 'That email is not verified yet. Click the link in your email, then check again.';
      return;
    }
    await prepareClaim(currentUser);
  } catch (error) {
    console.error(error);
    status.textContent = 'We could not refresh your verification status. Please try again.';
  }
});

document.getElementById('verification-resend').addEventListener('click', async () => {
  if (!currentUser) return;
  try {
    await sendEmailVerification(currentUser);
    status.textContent = `A new verification email was sent to ${currentUser.email}.`;
  } catch (error) {
    console.error(error);
    status.textContent = 'The verification email could not be resent yet. Please wait a moment and try again.';
  }
});

autoClaim.addEventListener('click', async () => {
  if (!currentUser || !currentUser.emailVerified || !matchedEmail) return;
  autoClaim.disabled = true;
  status.textContent = 'Connecting this profile to your account…';

  try {
    const alreadyOwned = await checkExistingOwnership();
    if (alreadyOwned) throw new Error('This profile has already been claimed.');

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
      claimMethod: 'verified-email',
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
      emailVerifiedForLegacyClaim: true,
      updatedAt: serverTimestamp()
    }, { merge: true });

    claimChoices.hidden = true;
    status.innerHTML = `<strong>Profile claimed!</strong><br>${profileName} is now connected to your account.`;
    setTimeout(() => {
      window.location.href = `profile.html?id=${encodeURIComponent(currentUser.uid)}`;
    }, 1200);
  } catch (error) {
    console.error(error);
    status.textContent = error.message || 'The profile could not be connected to your account.';
    autoClaim.disabled = false;
  }
});

manualToggle.addEventListener('click', () => {
  showManualClaim('Tell us how you are connected to this profile. BANDtroductions will review the request.');
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!currentUser) return;
  submit.disabled = true;
  status.textContent = 'Submitting your claim…';
  try {
    await addDoc(collection(db, 'profileClaims'), {
      claimantId: currentUser.uid,
      claimantEmail: currentUser.email || '',
      claimantName: currentUser.displayName || '',
      legacyPage,
      profileName,
      accountType,
      imageUrl,
      location: locationText,
      genre,
      instruments,
      venueType,
      role: document.getElementById('claim-role').value.trim(),
      proof: document.getElementById('claim-proof').value.trim(),
      status: 'pending',
      submittedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    form.hidden = true;
    status.textContent = 'Claim submitted. BANDtroductions will review it before transferring ownership.';
  } catch (error) {
    console.error(error);
    status.textContent = error.message || 'The claim could not be submitted.';
    submit.disabled = false;
  }
});