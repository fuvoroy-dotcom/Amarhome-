import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { firebaseConfig } from "./config";

let persistenceInitialized = false;

export function initializeFirebase() {
  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  const firestore = getFirestore(app);

  // Enable offline persistence for Firestore to save data locally and sync when online
  if (typeof window !== "undefined" && !persistenceInitialized) {
    persistenceInitialized = true;
    enableIndexedDbPersistence(firestore).catch((err) => {
      if (err.code === 'failed-precondition') {
        // Multiple tabs open, persistence can only be enabled in one tab at a time.
        console.warn("Firestore persistence: multiple tabs open.");
      } else if (err.code === 'unimplemented') {
        // The current browser does not support all of the features required to enable persistence
        console.warn("Firestore persistence: browser not supported.");
      }
    });
  }

  const auth = getAuth(app);
  const storage = getStorage(app);
  return { app, firestore, auth, storage };
}
