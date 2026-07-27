import { auth, db } from './firebase-dev.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { collection, deleteDoc, doc, onSnapshot, orderBy, query } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';
import { isAdminAccount } from './admin-access.js';

const style=document.createElement('style');
style.textContent=`
.comment-delete-button{margin-left:auto;border:1px solid #6b3535;border-radius:999px;padding:5px 9px;background:#0d0d0d;color:#ffb4b4;font:inherit;font-size:.72rem;font-weight:800;cursor:pointer}
.comment-delete-button:hover{border-color:#ff7777;color:#fff}.comment-delete-button:disabled{opacity:.55;cursor:wait}
`;
document.head.appendChild(style);

let currentUser=null,isAdmin=false,posts=[];
const subscriptions=new Map();
const formatDate=t=>!t?.toDate?'Just now':new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}).format(t.toDate());

function findPost(article){
  const directId=article.dataset.postId||article.getAttribute('data-post-id');
  if(directId)return posts.find(p=>p.id===directId);
  const link=article.querySelector('.community-author');
  const authorId=link?new URL(link.href,location.href).searchParams.get('id'):'';
  const meta=article.querySelector('.community-post-meta')?.textContent||'';
  return posts.find(post=>(authorId?post.authorId===authorId:post.authorName===link?.textContent?.trim())&&meta.includes(formatDate(post.createdAt)));
}

function addButtons(article,post,snapshot){
  if(!currentUser)return;
  const items=[...article.querySelectorAll('.comment-list .comment-item')];
  items.forEach((item,index)=>{
    const commentDoc=snapshot.docs[index];if(!commentDoc)return;
    const comment=commentDoc.data();
    const owner=comment.authorId===currentUser.uid;
    if(!owner&&!isAdmin)return;
    const top=item.querySelector('.comment-top');if(!top)return;
    let button=item.querySelector('.comment-delete-button');
    if(!button){button=document.createElement('button');button.type='button';button.className='comment-delete-button';top.appendChild(button)}
    button.textContent=isAdmin&&!owner?'Admin Delete':'Delete';
    if(button.dataset.ready==='true')return;
    button.dataset.ready='true';
    button.addEventListener('click',async()=>{
      if(!confirm('Delete this comment permanently? This cannot be undone.'))return;
      const label=button.textContent;button.disabled=true;button.textContent='Deleting…';
      try{await deleteDoc(doc(db,'posts',post.id,'comments',commentDoc.id))}
      catch(error){console.error(error);alert(error?.code==='permission-denied'?'Comment-delete permission was denied.':'The comment could not be deleted.');button.disabled=false;button.textContent=label}
    });
  });
}

function subscribe(article){
  if(!currentUser)return;
  const post=findPost(article);if(!post)return;
  article.dataset.commentControlsPostId=post.id;
  if(subscriptions.has(post.id))return;
  const stop=onSnapshot(query(collection(db,'posts',post.id,'comments'),orderBy('createdAt','asc')),snap=>{
    document.querySelectorAll(`.community-post[data-comment-controls-post-id="${post.id}"]`).forEach(a=>addButtons(a,post,snap));
  },error=>console.error('Could not load comments for moderation:',error));
  subscriptions.set(post.id,stop);
}

function scan(){if(!currentUser||!posts.length)return;document.querySelectorAll('.community-post').forEach(subscribe)}
const feed=document.getElementById('feed');if(feed)new MutationObserver(scan).observe(feed,{childList:true,subtree:true});
onAuthStateChanged(auth,user=>{currentUser=user;isAdmin=isAdminAccount(user);scan()});
onSnapshot(collection(db,'posts'),snap=>{posts=snap.docs.map(d=>({id:d.id,...d.data()}));scan()});
