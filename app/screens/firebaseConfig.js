/**
 * ============================================================================
 * FIREBASE SCREENS CONFIGURATION (DISCLOSED & DEPRECATED)
 * ============================================================================
 * NOTICE: Firebase authentication and Firestore database have been completely
 * replaced by the EduNex MongoDB REST Backend Ecosystem (https://edunex-backend-rmvx.onrender.com/api/v1).
 *
 * All user authentication (Login, Register, Demo Switching) and data persistence
 * are now handled via MongoDB user records and REST API services in `app/services/api.js`.
 * ============================================================================
 */

/*
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCRU_3LMXxpK8Dbkw8x5CfsbRYENeImxdU",
  authDomain: "sample-firebase-ai-app-f21e1.firebaseapp.com",
  projectId: "sample-firebase-ai-app-f21e1",
  storageBucket: "sample-firebase-ai-app-f21e1.firebasestorage.app",
  messagingSenderId: "12642862123",
  appId: "1:12642862123:web:xxxxxxxxxxxxxxx",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { app, db };
*/

export const app = null;
export const db = null;
export default null;