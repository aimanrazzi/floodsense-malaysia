import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDD-nSv_SY_e9N-091Q6GTueirY0vkTIlU",
  authDomain: "scam-detector-3ebee.firebaseapp.com",
  projectId: "scam-detector-3ebee",
  storageBucket: "scam-detector-3ebee.firebasestorage.app",
  messagingSenderId: "414393200615",
  appId: "1:414393200615:web:5cf0aab8de2ea1cba8d742",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
