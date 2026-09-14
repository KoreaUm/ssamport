import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from './config';

export async function createUserProfile(user, displayName = '') {
  await setDoc(doc(db, 'users', user.uid), {
    email: user.email || '',
    displayName,
    approved: false,
    role: 'user',
    createdAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
  }, { merge: true });
}

export async function updateLastLogin(uid) {
  await updateDoc(doc(db, 'users', uid), {
    lastLoginAt: serverTimestamp(),
  });
}

export async function getUserProfile(uid) {
  const snapshot = await getDoc(doc(db, 'users', uid));
  return snapshot.exists() ? snapshot.data() : null;
}
