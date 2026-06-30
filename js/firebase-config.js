// Import Firebase modules
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, where,onSnapshot } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAicYeEKvV0FBDfob0agOOWOu1naKH5Nuo",
    authDomain: "neksus-crm.firebaseapp.com",
    projectId: "neksus-crm",
    storageBucket: "neksus-crm.firebasestorage.app",
    messagingSenderId: "447759905247",
    appId: "1:447759905247:web:cb7f052e2f435bc974546a",
    measurementId: "G-XVJT5E5PGP"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

// Export Firebase instances and functions
export { 
    db, 
    storage,
    collection, 
    getDocs, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    doc, 
    serverTimestamp,
    query,
    orderBy,
    where,
    ref,
    uploadBytes,
    getDownloadURL,
    deleteObject,
    onSnapshot
};
