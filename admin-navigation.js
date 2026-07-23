import { auth, db } from './firebase-dev.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const ADMIN_EMAIL='newleafpaintingcompany@gmail.com';

async function isAdmin(user){
  if(!user)return false;
  if(String(user.email||'').toLowerCase()===ADMIN_EMAIL)return true;
  try{return (await getDoc(doc(db,'admins',user.uid))).exists();}
  catch(error){console.error('Could not check admin navigation status:',error);return false;}
}

function install(){
  const bar=document.getElementById('auth-account-bar');
  if(!bar||document.getElementById('admin-dashboard-link'))return false;
  const link=document.createElement('a');link.id='admin-dashboard-link';link.href='admin.html';link.textContent='Admin';link.style.color='#ffcb9e';link.style.fontWeight='900';
  const logout=document.getElementById('auth-logout-link');bar.insertBefore(link,logout||null);return true;
}

onAuthStateChanged(auth,async user=>{
  if(!(await isAdmin(user)))return;
  if(install())return;
  const observer=new MutationObserver(()=>{if(install())observer.disconnect()});observer.observe(document.documentElement,{childList:true,subtree:true});setTimeout(()=>observer.disconnect(),10000);
});