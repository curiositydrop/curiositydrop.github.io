import { auth, db } from './firebase-dev.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { collection, onSnapshot, orderBy, query, where } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const profileId=new URLSearchParams(location.search).get('id');
if(profileId){
  const content=document.getElementById('profile-content');
  const section=document.createElement('section');
  section.className='profile-card';
  section.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><h2 style="margin:0">Media</h2><a id="open-media-library" class="auth-button auth-button-secondary" href="media.html?owner=${encodeURIComponent(profileId)}">View All Media</a></div><div id="profile-media-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;margin-top:12px"></div><p id="profile-media-status" class="profile-side-note">Loading media…</p>`;
  content?.appendChild(section);
  const grid=section.querySelector('#profile-media-grid'),status=section.querySelector('#profile-media-status'),open=section.querySelector('#open-media-library');
  onAuthStateChanged(auth,user=>{if(user?.uid===profileId){open.textContent='Manage My Media';open.classList.remove('auth-button-secondary');}});
  const q=query(collection(db,'media'),where('ownerId','==',profileId),orderBy('createdAt','desc'));
  onSnapshot(q,snapshot=>{
    grid.replaceChildren();const docs=snapshot.docs.slice(0,6);status.hidden=docs.length>0;status.textContent='No media has been uploaded yet.';
    docs.forEach(d=>{const item=d.data(),wrap=document.createElement('a');wrap.href=`media.html?owner=${encodeURIComponent(profileId)}`;wrap.style.cssText='display:block;aspect-ratio:1/1;border:1px solid #333;border-radius:10px;overflow:hidden;background:#080808';const media=item.mediaType==='video'?document.createElement('video'):document.createElement('img');media.src=item.downloadUrl;media.alt=item.caption||'';media.loading='lazy';media.style.cssText='width:100%;height:100%;object-fit:cover';if(item.mediaType==='video'){media.muted=true;media.preload='metadata'}wrap.appendChild(media);grid.appendChild(wrap);});
  },error=>{console.error(error);status.textContent=error.code==='permission-denied'?'Media permissions are not enabled yet.':'Media could not be loaded.';});
}