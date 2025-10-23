import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  limit,
  setDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  deleteField,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { firebaseConfig } from './config.js';

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

const WALL_COLLECTION = 'walls';
const ROUTE_COLLECTION = 'routes';
const USER_COLLECTION = 'users';
const ROUTE_SCORE_SUBCOLLECTION = 'scores';
const ROUTE_BETATIPS_COLLECTION = 'routes_users_betatips';
const BETATIP_UPVOTES_SUBCOLLECTION = 'upvotes';
const SUBCOLLECTIONS_FIELD = '__subcollections';

export {
  auth,
  db,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  limit,
  setDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  deleteField,
  WALL_COLLECTION,
  ROUTE_COLLECTION,
  USER_COLLECTION,
  ROUTE_SCORE_SUBCOLLECTION,
  ROUTE_BETATIPS_COLLECTION,
  BETATIP_UPVOTES_SUBCOLLECTION,
  SUBCOLLECTIONS_FIELD,
};
