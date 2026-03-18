import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'

const firebaseConfig = {
  apiKey: "AIzaSyA_tot86_cT_ZIXYzTAIrELUkEnkdhlVZw",
  authDomain: "streamchat-d2448.firebaseapp.com",
  projectId: "streamchat-d2448",
  storageBucket: "streamchat-d2448.firebasestorage.app",
  messagingSenderId: "392007683619",
  appId: "1:392007683619:web:224d9cdaae531a03dd2b96"
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()
