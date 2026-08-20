import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDyPIK-a1cdEezznjuSEEB9ix0Mmpukex8",
  authDomain: "nexus-gamified-campus.firebaseapp.com",
  projectId: "nexus-gamified-campus",
  storageBucket: "nexus-gamified-campus.firebasestorage.app",
  messagingSenderId: "852415451641",
  appId: "1:852415451641:web:7fd5433d6545b94cb12d28"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

export default app;
