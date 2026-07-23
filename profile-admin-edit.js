import { auth, db, storage } from './firebase-dev.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { doc, getDoc, serverTimestamp, setDoc } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';
import { getDownloadURL, ref, uploadBytes } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-storage.js';

const ADMIN_EMAIL='newleafpaintingcompany@gmail.com';
const targetId=new URLSearchParams(location.search).get('adminProfile');
if(!targetId)throw new Error('Admin profile editor loaded without a target profile.');

const form=document.getElementById('profile-form');
const title=document.getElementById('page-title');
const message=document.getElementById('setup-message');
const status=document.getElementById('setup-status');
const saveButton=document.getElementById('save-button');
const bannerFile=document.getElementById('banner-image-file');
const avatarFile=document.getElementById('image-file');
let adminUser=null;
let targetProfile=null;

const value=id=>document.getElementById(id)?.value.trim()||'';
const normalizeUrl=raw=>{const url=(raw||'').trim();if(!url)return '';return /^https?:\/\//i.test(url)?url:`https://${url}`;};
const safeName=name=>String(name||'image').replace(/[^a-z0-9._-]+/gi,'-').replace(/-+/g,'-');

async function isAdmin(user){
  if(!user)return false;
  if(String(user.email||'').toLowerCase()===ADMIN_EMAIL)return true;
  try{return (await getDoc(doc(db,'admins',user.uid))).exists();}
  catch(error){console.error('Could not verify administrator:',error);return false;}
}

function showFields(type){
  document.querySelectorAll('.account-fields').forEach(section=>section.hidden=true);
  const section=document.getElementById(`${type}-fields`);
  if(section)section.hidden=false;
  const emoji=document.getElementById('fan-emoji-editor');
  if(emoji)emoji.hidden=type!=='fan';
}

function setPreview(id,url,fallback){
  const element=document.getElementById(id);
  if(!element)return;
  element.replaceChildren();
  if(!url){element.textContent=fallback;return;}
  const image=document.createElement('img');image.src=url;image.alt='Profile image preview';element.appendChild(image);
}

function fillProfile(data){
  const ids=['display-name','location','banner-image-url','image-url','bio','genre','year-formed','members','booking-email','instruments','experience','looking-for-band','capacity','venue-type','venue-booking','profile-emoji','favorite-genres','fan-interests','website','media-link'];
  ids.forEach(id=>{
    const element=document.getElementById(id);if(!element)return;
    const key=id.replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase());
    if(data[key]!==undefined&&data[key]!==null)element.value=data[key];
  });
  setPreview('banner-preview',data.bannerImageUrl||'','No banner selected');
  setPreview('avatar-preview',data.imageUrl||'','Initials will appear');
  document.getElementById('profile-emoji')?.dispatchEvent(new Event('change'));
  document.getElementById('bio')?.dispatchEvent(new Event('input'));
}

async function uploadImage(file,kind){
  if(!file)return '';
  if(!file.type.startsWith('image/'))throw new Error(`${kind} must be an image file.`);
  if(file.size>12*1024*1024)throw new Error(`${kind} must be smaller than 12 MB.`);
  const path=`profile-media/${targetId}/${kind.toLowerCase()}-${Date.now()}-${safeName(file.name)}`;
  const snapshot=await uploadBytes(ref(storage,path),file,{contentType:file.type,customMetadata:{ownerId:targetId,profileImageType:kind.toLowerCase()}});
  return getDownloadURL(snapshot.ref);
}

onAuthStateChanged(auth,async user=>{
  adminUser=user;
  if(!user){location.href='login.html';return;}
  if(!(await isAdmin(user))){status.textContent='Administrator access is required.';form.hidden=true;return;}
  try{
    const snapshot=await getDoc(doc(db,'profiles',targetId));
    if(!snapshot.exists()){status.textContent='That profile no longer exists.';form.hidden=true;return;}
    targetProfile=snapshot.data();
    const name=targetProfile.displayName||'this member';
    title.textContent=`Admin Edit: ${name}`;
    message.textContent=`You are editing ${name}'s ${targetProfile.accountType||'member'} profile. Changes save to their profile, not yours.`;
    document.title=`Admin Edit ${name} | BANDtroductions`;
    showFields(targetProfile.accountType||'fan');
    fillProfile(targetProfile);
    const security=document.querySelector('.account-tools');if(security)security.hidden=true;
    saveButton.textContent='Save Admin Changes';
    form.hidden=false;status.textContent='';
  }catch(error){console.error(error);status.textContent='The selected profile could not be loaded.';}
});

form.addEventListener('submit',async event=>{
  event.preventDefault();
  event.stopImmediatePropagation();
  if(!adminUser||!targetProfile)return;
  saveButton.disabled=true;status.textContent='Saving admin changes…';
  try{
    let bannerImageUrl=value('banner-image-url');
    let imageUrl=value('image-url');
    if(bannerFile.files?.[0]){status.textContent='Uploading banner image…';bannerImageUrl=await uploadImage(bannerFile.files[0],'Banner');}
    if(avatarFile.files?.[0]){status.textContent='Uploading avatar image…';imageUrl=await uploadImage(avatarFile.files[0],'Avatar');}
    const accountType=targetProfile.accountType||'fan';
    const profileData={
      ownerId:targetProfile.ownerId||targetId,
      accountType,
      displayName:value('display-name'),location:value('location'),bannerImageUrl,imageUrl,bio:value('bio'),
      genre:value('genre'),yearFormed:value('year-formed'),members:value('members'),bookingEmail:value('booking-email'),
      instruments:value('instruments'),experience:value('experience'),lookingForBand:value('looking-for-band'),
      capacity:value('capacity'),venueType:value('venue-type'),venueBooking:value('venue-booking'),profileEmoji:value('profile-emoji'),
      favoriteGenres:value('favorite-genres'),fanInterests:value('fan-interests'),website:normalizeUrl(value('website')),
      mediaLink:normalizeUrl(value('media-link')),published:targetProfile.published!==false,updatedAt:serverTimestamp(),
      moderatedAt:serverTimestamp(),moderatedBy:adminUser.uid
    };
    await setDoc(doc(db,'profiles',targetId),profileData,{merge:true});
    location.href=`profile.html?id=${encodeURIComponent(targetId)}&fresh=${Date.now()}`;
  }catch(error){console.error(error);status.textContent=error.message||'The profile could not be updated.';saveButton.disabled=false;}
},{capture:true});
