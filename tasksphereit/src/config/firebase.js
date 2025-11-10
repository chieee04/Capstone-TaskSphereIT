// src/config/firebase.js
import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAr8KuLBOOs0JcZJXCiy-uliI4NC49-_K0",
  authDomain: "tasksphereit-6d23f.firebaseapp.com",
  projectId: "tasksphereit-6d23f",
  storageBucket: "tasksphereit-6d23f.firebasestorage.app",
  messagingSenderId: "478108689425",
  appId: "1:478108689425:web:edaaf3cc050165573cbdb0",
  measurementId: "G-SXCXT1NFVN",
};

const app = initializeApp(firebaseConfig);

// Analytics only when available (avoids SSR/dev errors)
isSupported().then((ok) => {
  if (ok) getAnalytics(app);
});

export const auth = getAuth(app);
export const db = getFirestore(app);
