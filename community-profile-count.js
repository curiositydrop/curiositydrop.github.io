import { db } from './firebase-dev.js';
import { collection, onSnapshot } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const intro=document.querySelector('.community-intro');
if(intro&&!document.getElementById('community-profile-count')){
  const badge=document.createElement('div');
  badge.id='community-profile-count';
  badge.style.cssText='display:inline-flex;align-items:center;gap:8px;margin-top:8px;padding:8px 12px;border:1px solid #2f625e;border-radius:999px;background:#111;color:#ddd;font-weight:800;font-size:.86rem';
  badge.innerHTML='<span style="color:#0ccfbd">Community Profiles</span><strong>…</strong>';
  intro.appendChild(badge);
  const number=badge.querySelector('strong');
  onSnapshot(collection(db,'profiles'),snap=>{number.textContent=String(snap.size)},error=>{console.warn('Profile count unavailable:',error);badge.remove()});
}
