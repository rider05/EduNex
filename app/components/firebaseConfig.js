/**
 * ============================================================================
 * FIREBASE COMPONENT CONFIGURATION (DISCLOSED & DEPRECATED)
 * ============================================================================
 * NOTICE: Firebase authentication and Firestore database have been completely
 * replaced by the EduNex MongoDB REST Backend Ecosystem (https://edunex-backend-rmvx.onrender.com/api/v1).
 *
 * All user authentication (Login, Register, Demo Switching) and data persistence
 * are now handled via MongoDB user records and REST API services in `app/services/api.js`.
 * ============================================================================
 */

/*
import { initializeApp } from '@react-native-firebase/app';
import { getFirestore, collection, query, onSnapshot, getDoc, doc } from '@react-native-firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCRU_3LMXxpK8Dbkw8x5CfsbRYENeImxdU",
  projectId: "sample-firebase-ai-app-f21e1",
  storageBucket: "sample-firebase-ai-app-f21e1.firebasestorage.app",
  authDomain: "sample-firebase-ai-app-f21e1.firebaseapp.com",
  messagingSenderId: "12642862123",
  appId: "1:12642862123:web:xxxxxxxxxxxxxxx"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db, collection, query, onSnapshot, getDoc, doc };
*/

export const db = null;
export const collection = null;
export const query = null;
export const onSnapshot = null;
export const getDoc = null;
export const doc = null;
export default null;