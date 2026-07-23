import { auth, db } from './firebase-dev.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { collection, doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const ADMIN_EMAIL='newleafpaintingcompany@gmail.com';
let currentUser=null;

async function isAdmin(user){
  if(!user)return false;
  if(String(user.email||'').toLowerCase()===ADMIN_EMAIL)return true;
  try{return (await getDoc(doc(db,'admins',user.uid))).exists()}catch{return false}
}

function injectSection(){
  const main=document.querySelector('.admin-shell');
  if(!main||document.getElementById('claim-approval-list'))return null;
  const heading=document.createElement('section');heading.className='admin-head';
  heading.innerHTML='<p class="profile-meta">EXISTING PROFILE CLAIMS</p><h1>Ownership Claims</h1><p class="auth-subtitle">Verify requests before transferring a legacy profile to a logged-in account.</p>';
  const list=document.createElement('section');list.id='claim-approval-list';list.className='approval-list';
  const status=document.createElement('p');status.id='claim-admin-status';status.className='auth-message';status.textContent='Loading ownership claims…';
  main.append(heading,list,status);
  return {list,status};
}

function claimCard(claim,id){
  const article=document.createElement('article');article.className='approval-card';
  const title=document.createElement('h2');title.textContent=claim.profileName||'Unnamed legacy profile';
  const meta=document.createElement('p');meta.className='approval-meta';meta.textContent=[claim.accountType,claim.location,claim.claimantEmail].filter(Boolean).join(' • ');
  const role=document.createElement('p');role.className='approval-bio';role.textContent=`Connection: ${claim.role||'Not provided'}`;
  const proof=document.createElement('p');proof.className='approval-bio';proof.textContent=`Verification: ${claim.proof||'Not provided'}`;
  const actions=document.createElement('div');actions.className='approval-actions';

  const oldPage=document.createElement('a');oldPage.className='auth-button auth-button-secondary';oldPage.href=claim.legacyPage||'#';oldPage.target='_blank';oldPage.rel='noopener';oldPage.textContent='Open Existing Profile';

  const approve=document.createElement('button');approve.type='button';approve.className='auth-button approve-button';approve.textContent='Approve & Transfer';
  approve.addEventListener('click',async()=>{
    if(!confirm(`Transfer ${claim.profileName||'this profile'} to ${claim.claimantEmail||'this account'}?`))return;
    approve.disabled=true;
    try{
      const profileData={
        ownerId:claim.claimantId,
        accountType:claim.accountType,
        displayName:claim.profileName||'',
        imageUrl:claim.imageUrl||'',
        location:claim.location||'',
        genre:claim.genre||'',
        instruments:claim.instruments||'',
        venueType:claim.venueType||'',
        legacyPage:claim.legacyPage||'',
        claimedLegacyProfile:true,
        approvalStatus:'approved',
        published:true,
        approvedAt:serverTimestamp(),
        approvedBy:currentUser.uid,
        updatedAt:serverTimestamp()
      };
      await setDoc(doc(db,'profiles',claim.claimantId),profileData,{merge:true});
      await setDoc(doc(db,'users',claim.claimantId),{accountType:claim.accountType,displayName:claim.profileName||'',profileComplete:true,updatedAt:serverTimestamp()},{merge:true});
      await updateDoc(doc(db,'profileClaims',id),{status:'approved',approvedAt:serverTimestamp(),approvedBy:currentUser.uid,updatedAt:serverTimestamp()});
    }catch(error){console.error(error);alert('The profile claim could not be approved.');approve.disabled=false}
  });

  const reject=document.createElement('button');reject.type='button';reject.className='auth-button reject-button';reject.textContent='Reject Claim';
  reject.addEventListener('click',async()=>{
    const reason=prompt('Reason for rejection (optional):','');if(reason===null)return;
    reject.disabled=true;
    try{await updateDoc(doc(db,'profileClaims',id),{status:'rejected',rejectionReason:reason.trim(),reviewedAt:serverTimestamp(),reviewedBy:currentUser.uid,updatedAt:serverTimestamp()})}
    catch(error){console.error(error);alert('The claim could not be rejected.');reject.disabled=false}
  });

  actions.append(oldPage,approve,reject);article.append(title,meta,role,proof,actions);return article;
}

onAuthStateChanged(auth,async user=>{
  currentUser=user;if(!(await isAdmin(user)))return;
  const ui=injectSection();if(!ui)return;
  onSnapshot(collection(db,'profileClaims'),snapshot=>{
    const pending=snapshot.docs.filter(d=>d.data().status==='pending').map(d=>({id:d.id,...d.data()}));
    ui.list.replaceChildren();
    if(!pending.length){ui.status.hidden=false;ui.status.textContent='No ownership claims are waiting for review.';return}
    ui.status.hidden=true;
    pending.sort((a,b)=>(a.submittedAt?.seconds||0)-(b.submittedAt?.seconds||0)).forEach(claim=>ui.list.appendChild(claimCard(claim,claim.id)));
  },error=>{console.error(error);ui.status.textContent='Ownership claims could not be loaded.'});
});