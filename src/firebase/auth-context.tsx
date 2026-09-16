"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { 
  User, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile,
  signOut, 
  onAuthStateChanged 
} from "firebase/auth";
import { initializeFirebase } from "./index";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  signupWithEmail: (email: string, pass: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { auth } = initializeFirebase();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    const { auth } = initializeFirebase();
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const loginWithEmail = async (email: string, pass: string) => {
    const { auth } = initializeFirebase();
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const signupWithEmail = async (email: string, pass: string, name?: string) => {
    const { auth } = initializeFirebase();
    const credential = await createUserWithEmailAndPassword(auth, email, pass);
    if (name && credential.user) {
      await updateProfile(credential.user, { displayName: name });
      setUser({ ...credential.user, displayName: name });
    }
  };

  const logout = async () => {
    const { auth } = initializeFirebase();
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginWithGoogle, loginWithEmail, signupWithEmail, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
