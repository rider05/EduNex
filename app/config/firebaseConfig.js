/**
 * ============================================================================
 * FIREBASE CONFIGURATION (DISCLOSED & DEPRECATED)
 * ============================================================================
 * NOTICE: Firebase authentication and Firestore database have been completely
 * replaced by the EduNex MongoDB REST Backend Ecosystem (https://edunex-backend-rmvx.onrender.com/api/v1).
 *
 * All user authentication (Login, Register, Demo Switching) and data persistence
 * are now handled via MongoDB user records and REST API services in `app/services/api.js`.
 *
 * This configuration file is retained in dormant mode for backward compatibility.
 * ============================================================================
 */

/*
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { 
  getAuth, 
  GoogleAuthProvider, 
  PhoneAuthProvider 
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCRU_3LMXxpK8Dbkw8x5CfsbRYENeImxdU",
  authDomain: "sample-firebase-ai-app-f21e1.firebaseapp.com",
  projectId: "sample-firebase-ai-app-f21e1",
  storageBucket: "sample-firebase-ai-app-f21e1.firebasestorage.app",
  messagingSenderId: "12642862123",
  appId: "1:12642862123:android:768b62018294a03e0a166e",
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider(auth);
const phoneProvider = new PhoneAuthProvider(auth);

export { app, db, storage, auth, googleProvider, phoneProvider };
export default app;
*/

// Dormant stub exports
export const app = null;
export const db = null;
export const storage = null;
export const auth = null;
export const googleProvider = null;
export const phoneProvider = null;
export default app;