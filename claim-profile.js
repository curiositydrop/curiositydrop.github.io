import { auth, db } from './firebase-dev.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { addDoc, collection, getDocs, query, serverTimestamp, where } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const params=new URLSearchParams(location.search);
const legacyPage=params.get('page')||'';
const profileName=params.get('name')||'Existing Profile';
const accountType=(params.get('type')||'').toLowerCase();
const imageUrl=params.get('image')||'';
const locationText=params.get('location')||'';
const genre=params.get('genre')||'';
const instruments=params.get('instruments')||'';
const venueType=params.get('venueType')||'';

const form=document.getElementById('claim-form');
const status=document.getElementById('claim-status');
const summary=document.getElementById('claim-summary');
const submit=document.getElementById('claim-submit');
let currentUser=null;

function buildSummary(){
  summary.replaceChildren();
  if(imageUrl){const image=document.createElement('img');image.className='claim-image';image.src=imageUrl;image.alt='';summary.appendChild(image)}
  const copy=document.createElement('div');
  const title=document.createElement('h2');title.textContent=profileName;
  const meta=document.createElement('p');meta.className='approval-meta';meta.textContent=[accountType,locationText,genre||instruments||venueType].filter(Boolean).join(' • ');
  copy.append(title,meta);summary.appendChild(copy);
}

buildSummary();

onAuthStateChanged(auth,async user=>{
  currentUser=user;
  if(!user){
    status.innerHTML='Please <a href="login.html">log in</a> or create an account before claiming a profile.';
    return;
  }
  if(!legacyPage||!profileName||!['band','musician','venue'].includes(accountType)){
    status.textContent='This claim link is missing required profile information.';
    return;
  }
  try{
    const existing=await getDocs(query(collection(db,'profileClaims'),where('claimantId','==',user.uid),where('legacyPage','==',legacyPage)));
    const active=existing.docs.find(doc=>['pending','approved'].includes(doc.data().status));
    if(active){
      status.textContent=active.data().status==='approved'?'This profile claim has already been approved.':'Your claim for this profile is already waiting for review.';
      return;
    }
  }catch(error){console.error('Could not check existing claims:',error)}
  form.hidden=false;status.textContent=`Signed in as ${user.email||'your account'}.`;
});

form.addEventListener('submit',async event=>{
  event.preventDefault();if(!currentUser)return;
  submit.disabled=true;status.textContent='Submitting your claim…';
  try{
    await addDoc(collection(db,'profileClaims'),{
      claimantId:currentUser.uid,
      claimantEmail:currentUser.email||'',
      claimantName:currentUser.displayName||'',
      legacyPage,
      profileName,
      accountType,
      imageUrl,
      location:locationText,
      genre,
      instruments,
      venueType,
      role:document.getElementById('claim-role').value.trim(),
      proof:document.getElementById('claim-proof').value.trim(),
      status:'pending',
      submittedAt:serverTimestamp(),
      updatedAt:serverTimestamp()
    });
    form.hidden=true;status.textContent='Claim submitted. BANDtroductions will review it before transferring ownership.';
  }catch(error){
    console.error(error);status.textContent=error.message||'The claim could not be submitted.';submit.disabled=false;
  }
});