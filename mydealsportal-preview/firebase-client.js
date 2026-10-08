import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-analytics.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, addDoc, updateDoc, deleteDoc, collection, getDocs, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB206HdEqEIgaBLob1EWpR7GNUG1DQAyxM",
  authDomain: "mydealsportal.firebaseapp.com",
  projectId: "mydealsportal",
  storageBucket: "mydealsportal.firebasestorage.app",
  messagingSenderId: "423834035461",
  appId: "1:423834035461:web:bf44b49a0fc913d377836c",
  measurementId: "G-DT5YK1G6LK"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
if (await isSupported()) getAnalytics(app);

export function slugify(value=""){
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,80);
}

export function waitForUser(){
  return new Promise(resolve => {
    const stop = onAuthStateChanged(auth, user => { stop(); resolve(user); });
  });
}

export async function registerBusiness({email,password,name,phone,website,zip,city,category}){
  const cred = await createUserWithEmailAndPassword(auth,email,password);
  const uid = cred.user.uid;
  const slug = slugify(name);
  await setDoc(doc(db,"users",uid),{
    uid,email,role:"business",createdAt:serverTimestamp()
  });
  await setDoc(doc(db,"businesses",uid),{
    ownerUid:uid,name,slug,phone:phone||"",website:website||"",zip,city:city||"",
    category,status:"active",subscriptionStatus:"sandbox",foundingEligible:true,
    createdAt:serverTimestamp(),updatedAt:serverTimestamp()
  });
  return cred.user;
}

export function loginBusiness(email,password){
  return signInWithEmailAndPassword(auth,email,password);
}
export function logoutBusiness(){ return signOut(auth); }

export async function getMyBusiness(uid){
  const snap = await getDoc(doc(db,"businesses",uid));
  return snap.exists()?{id:snap.id,...snap.data()}:null;
}

export async function saveBusiness(uid,data){
  await setDoc(doc(db,"businesses",uid),{...data,ownerUid:uid,updatedAt:serverTimestamp()},{merge:true});
}

export async function getMyDeals(uid){
  const q = query(collection(db,"deals"),where("ownerUid","==",uid));
  const snap = await getDocs(q);
  return snap.docs.map(d=>({id:d.id,...d.data()}));
}

export async function saveDeal(uid,business,data,id=null){
  const payload={
    ...data,
    ownerUid:uid,
    businessId:business.id,
    business:business.name,
    businessSlug:business.slug,
    active:data.active!==false,
    updatedAt:serverTimestamp()
  };
  if(id){
    await updateDoc(doc(db,"deals",id),payload);
    return id;
  }
  payload.createdAt=serverTimestamp();
  const ref=await addDoc(collection(db,"deals"),payload);
  return ref.id;
}

export async function setDealActive(id,active){
  await updateDoc(doc(db,"deals",id),{active,updatedAt:serverTimestamp()});
}
export async function removeDeal(id){ await deleteDoc(doc(db,"deals",id)); }

export async function getPublicDeals(){
  const q=query(collection(db,"deals"),where("active","==",true));
  const snap=await getDocs(q);
  return snap.docs.map(d=>({id:d.id,...d.data()}));
}

export async function getDealById(id){
  const snap=await getDoc(doc(db,"deals",id));
  return snap.exists()?{id:snap.id,...snap.data()}:null;
}

export async function getBusinessByName(name){
  const q=query(collection(db,"businesses"),where("name","==",name));
  const snap=await getDocs(q);
  if(snap.empty) return null;
  const d=snap.docs[0];
  return {id:d.id,...d.data()};
}

export async function getBusinessBySlug(slug){
  const q=query(collection(db,"businesses"),where("slug","==",slug));
  const snap=await getDocs(q);
  if(snap.empty) return null;
  const d=snap.docs[0];
  return {id:d.id,...d.data()};
}
