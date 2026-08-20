import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDyPIK-a1cdEezznjuSEEB9ix0Mmpukex8",
  authDomain: "nexus-gamified-campus.firebaseapp.com",
  projectId: "nexus-gamified-campus",
  storageBucket: "nexus-gamified-campus.firebasestorage.app",
  messagingSenderId: "852415451641",
  appId: "1:852415451641:web:7fd5433d6545b94cb12d28"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkLogs() {
  const q = collection(db, 'qa_logs');
  const snap = await getDocs(q);
  console.log("qa_logs count:", snap.size);
  snap.forEach(doc => console.log(doc.id, doc.data()));
  process.exit(0);
}

checkLogs();
