/* eslint-disable @typescript-eslint/no-explicit-any */
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// Import Native Firebase Auth
import nativeAuth from '@react-native-firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { getDownloadURL, getStorage, ref, uploadString } from "firebase/storage";

// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
export const firebaseConfig = {
 piKey: "AIzaSyBwSf8p4VRmLtOA5s14-8upyv9rgTS37B0",
  authDomain: "urbanconectiontest.firebaseapp.com",
  projectId: "urbanconectiontest",
  storageBucket: "urbanconectiontest.firebasestorage.app",
  messagingSenderId: "29132479755",
  appId: "1:29132479755:web:0b483fdcca40164ced560e"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

import AsyncStorage from "@react-native-async-storage/async-storage";

// Para Firestore y Storage
export default app;

// Exportamos la instancia nativa de auth para usarla en el resto de la app
export const auth = nativeAuth();
export const db = getFirestore(app);
export const storage = getStorage(app);


//TODO Las FUNCIONES DEL AUTH //

//?CREAR NUEVO USUARIO///
export const createUser = async (user: { email: string; password: string }) => {
  return await nativeAuth().createUserWithEmailAndPassword(user.email, user.password);
};

//??ENTRAR CON EMAIL & CONTRASEÑA//
export const signIn = async (user: { email: string; password: string }) => {
  return await nativeAuth().signInWithEmailAndPassword(user.email, user.password);
};

//?ACTUALIZAR USUARIO//
export const updateUser = (user: {
  displayName?: string | null;
  photoURL?: string | null;
}) => {
  if (nativeAuth().currentUser) return nativeAuth().currentUser?.updateProfile(user);
};

//?CERRAR SESION//
export const sigOutAccount = async () => {
  await AsyncStorage.removeItem("user");
  return nativeAuth().signOut();
};

//? RECUPERAR CONTRASEÑA//
export const sentResetEmail = (email: string) => {
  return nativeAuth().sendPasswordResetEmail(email);
};


//TODO FUNCIONES AUTH - TELEFONO //

//?ENVIAR SMS VERIFICACION (NATIVO)//
export const sendPhoneVerificationCode = async (phoneNumber: string) => {
  // Con el SDK Nativo, esto llama a Google Play Integrity automáticamente sin Captcha
  const confirmation = await nativeAuth().signInWithPhoneNumber(phoneNumber);
  return confirmation; // Retornamos el objeto de confirmación
};

//?CONFIRMAR CODIGO Y AUTENTICAR CON TELEFONO (NATIVO)//
export const confirmPhoneCode = async (
  confirmation: any,
  verificationCode: string
) => {
  // Confirmamos directamente usando el objeto que nos devolvió Firebase Nativo
  return await confirmation.confirm(verificationCode);
};


//TODO FUNCIONES DATABASE///

export const getCollection = async (colectionName: string, queryArray?: any[]) => {
  const ref = collection(db, colectionName);
  const q = queryArray ? query(ref, ...queryArray) : query(ref);
  return (await getDocs(q)).docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

//?OBTENER UN DOCUMENTO DE UNA COLECCION//
export const getDocument = async (path: string) => {
  return (await getDoc(doc(db, path))).data();
};

//?SETEAR UN DOCUMENTO EN UNA COLECCION//
export const setDocument = (path: string, data: any) => {
  data.createAt = serverTimestamp();
  return setDoc(doc(db, path), data);
};

//? ACTUALIZAR UN DOCUMENTO EN UNA COLECCION//
export const updateDocument = (path: string, data: any) => {
  return updateDoc(doc(db, path), data);
};

//? ELIMINAR UN DOCUMENTO DE UNA COLECCION//
export const deleteDocument = (path: string) => {
  return deleteDoc(doc(db, path));
};

//? AGREGAR UN DOCUMENTO //////
export const addDocument = (path: string, data: any) => {
  data.createAt = serverTimestamp();
  return addDoc(collection(db, path), data);
};

//?TODO ===== FUNCIONES DEL STORAGE====== ///

//! SUBIR UN ARCHIVO CON FORMATO BASE64 & OBTENER SU URL//
export const uploadBase64 = async (path: string, base64: string) => {
  return uploadString(ref(storage, path), base64, "data_url").then(() => {
    return getDownloadURL(ref(storage, path));
  });
};
