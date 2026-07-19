import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBYvp4LDFplzcTqlPK_OI8NovAHc1tS7NU",
  authDomain: "bandtroductions-dev.firebaseapp.com",
  projectId: "bandtroductions-dev",
  storageBucket: "bandtroductions-dev.firebasestorage.app",
  messagingSenderId: "793568967411",
  appId: "1:793568967411:web:713ba123948c11dfdfd586"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
