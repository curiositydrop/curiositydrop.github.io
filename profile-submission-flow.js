import { auth, db, storage } from './firebase-dev.js';
import { onAuthStateChanged, updateProfile } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';
import { getDownloadURL, ref, uploadBytes } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-storage.js';

if(new URLSearchParams(location.search).has('adminProfile')){
  // The dedicated admin editor owns the submit event on that screen.
}else{
  const form=document.getElementById('profile-form');
  const status=document.getElementById('setup-status');
  const saveButton=document.getElementById('save-button');
  const bannerFile=document.getElementById('banner-image-file');
  const avatarFile=document.getElementById('image-file');
  let currentUser=null,accountType='fan',existingProfile=null;

  const value=id=>document.getElementById(id)?.value.trim()||'';
  const normalizeUrl=raw=>{const url=(raw||'').trim();if(!url)return '';return /^https?:\/\//i.test(url)?url:`https://${url}`};
  const safeName=name=>String(name||'image').replace(/[^a-z0-9._-]+/gi,'-').replace(/-+/g,'-');

  async function upload(file,kind){
    if(!file)return '';
    const path=`profile-media/${currentUser.uid}/${kind}-${Date.now()}-${safeName(file.name)}`;
    const snapshot=await uploadBytes(ref(storage,path),file,{contentType:file.type,customMetadata:{ownerId:currentUser.uid,profileImageType:kind}});
    return getDownloadURL(snapshot.ref);
  }

  onAuthStateChanged(auth,async user=>{
    currentUser=user;if(!user)return;
    try{
      const [userSnap,profileSnap]=await Promise.all([getDoc(doc(db,'users',user.uid)),getDoc(doc(db,'profiles',user.uid))]);
      accountType=userSnap.exists()?(userSnap.data().accountType||'fan'):'fan';
      existingProfile=profileSnap.exists()?profileSnap.data():null;
      if(accountType!=='fan'&&existingProfile?.approvalStatus==='pending'){
        const message=document.getElementById('setup-message');
        if(message)message.textContent='Your profile is waiting for BANDtroductions approval. You can still make changes while it is being reviewed.';
        if(saveButton)saveButton.textContent='Update Pending Profile';
      }
    }catch(error){console.error('Could not load profile approval status:',error)}
  });

  form?.addEventListener('submit',async event=>{
    event.preventDefault();event.stopImmediatePropagation();if(!currentUser)return;
    saveButton.disabled=true;status.textContent='Saving your profile…';
    try{
      let bannerImageUrl=value('banner-image-url'),imageUrl=value('image-url');
      if(bannerFile.files?.[0]){status.textContent='Uploading optimized banner…';bannerImageUrl=await upload(bannerFile.files[0],'banner')}
      if(avatarFile.files?.[0]){status.textContent='Uploading optimized avatar…';imageUrl=await upload(avatarFile.files[0],'avatar')}
      const previouslyApproved=existingProfile?.approvalStatus==='approved';
      const needsApproval=accountType!=='fan'&&!previouslyApproved;
      const profileData={
        ownerId:currentUser.uid,accountType,displayName:value('display-name'),location:value('location'),bannerImageUrl,imageUrl,bio:value('bio'),
        genre:value('genre'),yearFormed:value('year-formed'),members:value('members'),bookingEmail:value('booking-email'),
        instruments:value('instruments'),experience:value('experience'),lookingForBand:value('looking-for-band'),capacity:value('capacity'),venueType:value('venue-type'),venueBooking:value('venue-booking'),
        profileEmoji:value('profile-emoji'),favoriteGenres:value('favorite-genres'),fanInterests:value('fan-interests'),website:normalizeUrl(value('website')),mediaLink:normalizeUrl(value('media-link')),
        approvalStatus:needsApproval?'pending':'approved',published:!needsApproval,submittedAt:needsApproval?(existingProfile?.submittedAt||serverTimestamp()):(existingProfile?.submittedAt||null),updatedAt:serverTimestamp()
      };
      await setDoc(doc(db,'profiles',currentUser.uid),profileData,{merge:true});
      await updateDoc(doc(db,'users',currentUser.uid),{displayName:profileData.displayName,profileComplete:true,updatedAt:serverTimestamp()});
      await updateProfile(currentUser,{displayName:profileData.displayName,photoURL:imageUrl||null});
      if(needsApproval){
        status.textContent='Submitted for approval. BANDtroductions has been notified.';
        setTimeout(()=>location.href=`profile-pending.html?fresh=${Date.now()}`,900);
      }else location.href=`profile.html?id=${encodeURIComponent(currentUser.uid)}&fresh=${Date.now()}`;
    }catch(error){console.error(error);status.textContent=error.message||'Your profile could not be saved.';saveButton.disabled=false}
  },{capture:true});
}