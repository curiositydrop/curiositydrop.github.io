import { auth, db } from './firebase-dev.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { collection, doc, getDoc, onSnapshot, query, where } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const ADMIN_EMAIL='newleafpaintingcompany@gmail.com';
let stopPendingListener=null;

async function isAdmin(user){
  if(!user)return false;
  if(String(user.email||'').toLowerCase()===ADMIN_EMAIL)return true;
  try{return (await getDoc(doc(db,'admins',user.uid))).exists();}
  catch(error){console.error('Could not check admin navigation status:',error);return false;}
}

function updateLabel(count){
  const link=document.getElementById('admin-dashboard-link');
  if(!link)return;
  link.textContent=count>0?`Admin — ${count} Pending`:'Admin';
  link.setAttribute('aria-label',count>0?`Admin dashboard, ${count} profiles pending approval`:'Admin dashboard');
  link.title=count>0?`${count} profile${count===1?'':'s'} waiting for approval`:'Admin dashboard';
  link.style.color=count>0?'#ffd166':'#ffcb9e';
}

function install(){
  const bar=document.getElementById('auth-account-bar');
  if(!bar)return false;
  if(document.getElementById('admin-dashboard-link'))return true;
  const link=document.createElement('a');
  link.id='admin-dashboard-link';
  link.href='admin.html';
  link.textContent='Admin';
  link.style.color='#ffcb9e';
  link.style.fontWeight='900';
  const logout=document.getElementById('auth-logout-link');
  bar.insertBefore(link,logout||null);
  return true;
}

function watchPendingProfiles(){
  if(stopPendingListener)stopPendingListener();
  const pendingQuery=query(collection(db,'profiles'),where('approvalStatus','==','pending'));
  stopPendingListener=onSnapshot(pendingQuery,snapshot=>{
    const pendingCount=snapshot.docs.filter(item=>item.data().published!==true).length;
    updateLabel(pendingCount);
  },error=>{
    console.error('Could not load pending profile count:',error);
    updateLabel(0);
  });
}

onAuthStateChanged(auth,async user=>{
  if(stopPendingListener){stopPendingListener();stopPendingListener=null;}
  if(!(await isAdmin(user)))return;
  if(!install()){
    const observer=new MutationObserver(()=>{
      if(install()){
        observer.disconnect();
        watchPendingProfiles();
      }
    });
    observer.observe(document.documentElement,{childList:true,subtree:true});
    setTimeout(()=>observer.disconnect(),10000);
    return;
  }
  watchPendingProfiles();
});
