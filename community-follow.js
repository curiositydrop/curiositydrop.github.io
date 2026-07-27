import { auth, db } from './firebase-dev.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { addDoc, collection, deleteDoc, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, where } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

let currentUser=null;
let posts=[];
let initialPostIds=new Set();
let initialized=false;
const followId=(followerId,targetId)=>`${followerId}_${targetId}`;

const style=document.createElement('style');
style.textContent=`
  .post-follow-button{margin-left:auto;border:1px solid #0ccfbd;border-radius:999px;padding:6px 10px;background:#0d0d0d;color:#0ccfbd;font:inherit;font-size:.75rem;font-weight:900;cursor:pointer}
  .post-follow-button.is-active{background:#0ccfbd;color:#06110f}
`;
document.head.appendChild(style);

function findPost(article){
  const authorLink=article.querySelector('.community-author');
  const authorId=authorLink?new URL(authorLink.href,location.href).searchParams.get('id'):'';
  const body=article.querySelector('.community-post-body')?.textContent||'';
  return posts.find(post=>post.authorId===authorId&&(post.content||'')===body);
}

async function installButtons(){
  if(!currentUser)return;
  const articles=[...document.querySelectorAll('.community-post')];
  for(const article of articles){
    if(article.dataset.followReady==='true')continue;
    const post=findPost(article);
    if(!post||!post.authorId||post.authorId===currentUser.uid)continue;
    article.dataset.followReady='true';
    const header=article.querySelector('.community-post-header');
    if(!header)continue;
    const button=document.createElement('button');
    button.type='button';button.className='post-follow-button';button.textContent='Follow';
    header.appendChild(button);
    const ref=doc(db,'follows',followId(currentUser.uid,post.authorId));
    const refresh=async()=>{const snap=await getDoc(ref);button.classList.toggle('is-active',snap.exists());button.textContent=snap.exists()?'Following':'Follow'};
    button.addEventListener('click',async()=>{button.disabled=true;try{const snap=await getDoc(ref);if(snap.exists())await deleteDoc(ref);else await setDoc(ref,{followerId:currentUser.uid,targetId:post.authorId,targetName:post.authorName||'Profile',targetType:post.accountType||'member',createdAt:serverTimestamp()});await refresh()}catch(error){console.error(error);alert(error?.code==='permission-denied'?'Follow permissions are not enabled yet.':'Follow could not be updated.')}finally{button.disabled=false}});
    refresh().catch(console.error);
  }
}

async function notifyFollowers(post){
  if(!currentUser||post.authorId!==currentUser.uid)return;
  try{
    const followers=await new Promise((resolve,reject)=>{
      const stop=onSnapshot(query(collection(db,'follows'),where('targetId','==',currentUser.uid)),snap=>{stop();resolve(snap.docs.map(d=>d.data()))},reject);
    });
    for(const follower of followers){
      if(!follower.followerId||follower.followerId===currentUser.uid)continue;
      const marker=doc(db,'postFollowerNotifications',`${post.id}_${follower.followerId}`);
      const existing=await getDoc(marker);
      if(existing.exists())continue;
      await addDoc(collection(db,'notifications'),{recipientId:follower.followerId,actorId:currentUser.uid,actorName:post.authorName||'BANDtroductions Member',type:'new-post',message:'published a new community post.',linkUrl:`profile.html?id=${encodeURIComponent(currentUser.uid)}`,read:false,createdAt:serverTimestamp()});
      await setDoc(marker,{postId:post.id,recipientId:follower.followerId,createdAt:serverTimestamp()});
    }
  }catch(error){console.warn('Follower notifications unavailable',error)}
}

const feed=document.getElementById('feed');
if(feed)new MutationObserver(installButtons).observe(feed,{childList:true,subtree:true});

onAuthStateChanged(auth,user=>{currentUser=user;installButtons()});
onSnapshot(collection(db,'posts'),snapshot=>{
  posts=snapshot.docs.map(d=>({id:d.id,...d.data()}));
  if(!initialized){initialPostIds=new Set(posts.map(p=>p.id));initialized=true;installButtons();return;}
  snapshot.docChanges().filter(change=>change.type==='added'&&!initialPostIds.has(change.doc.id)).forEach(change=>notifyFollowers({id:change.doc.id,...change.doc.data()}));
  posts.forEach(p=>initialPostIds.add(p.id));
  document.querySelectorAll('.community-post').forEach(a=>delete a.dataset.followReady);
  installButtons();
});
