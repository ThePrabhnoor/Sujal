import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';

// Your web app's Firebase configuration
export const firebaseConfig = {
  apiKey: "AIzaSyAaltDDt6ZkpGQQGWRhbwif189EizNXSiM",
  authDomain: "sujalcbs.firebaseapp.com",
  projectId: "sujalcbs",
  storageBucket: "sujalcbs.firebasestorage.app",
  messagingSenderId: "766850056359",
  appId: "1:766850056359:web:6eb7d43b7208096e9c1b82",
  measurementId: "G-SC9L41BD8M"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

// Initialize Analytics conditionally (only in browser environments where supported)
export const analyticsPromise = isSupported().then((supported) => (supported ? getAnalytics(app) : null));

