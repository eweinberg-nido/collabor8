///src/context/Authcontext.js
import React, { createContext, useState, useEffect, useContext } from 'react';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'firebase/auth';
import { db } from '../util/firebase-config';
import { collection, doc, getDoc, setDoc, getDocs, query, where } from 'firebase/firestore';

const AuthContext = createContext();

const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, 'users', user.email);
        const userSnap = await getDoc(userRef);
        let userData;
        if (!userSnap.exists()) {
          const groupQuery = query(collection(db, "groups"), where("members", "array-contains", user.email));
          const groupSnapshot = await getDocs(groupQuery);
          let classBlock = '';
          if (!groupSnapshot.empty) {
            const groupDoc = groupSnapshot.docs[0].data();
            classBlock = groupDoc.classBlock || '';
          }
          userData = {
            email: user.email,
            displayName: user.displayName,
            role: 'student',
            classBlock: classBlock,
            uid: user.uid,
          };
          await setDoc(userRef, userData);
        } else {
          userData = userSnap.data();
          if (userData.uid !== user.uid || userData.displayName !== user.displayName) {
            await setDoc(userRef, {
              uid: user.uid,
              displayName: user.displayName,
            }, { merge: true });
            userData = { ...userData, uid: user.uid, displayName: user.displayName };
          }
        }
        setCurrentUser({ ...user, role: userData.role, classBlock: userData.classBlock });
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signInWithGoogle = async () => {
    const auth = getAuth();
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Error during sign in with Google:", error);
    }
  };

  const logout = async () => {
    const auth = getAuth();
    try {
      await signOut(auth);
      setCurrentUser(null);
    } catch (error) {
      console.error("Error during sign out:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ currentUser, signInWithGoogle, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export { AuthContext, AuthProvider };
