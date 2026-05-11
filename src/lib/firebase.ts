import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  applyActionCode,
  createUserWithEmailAndPassword,
  FirebaseAuthTypes,
  getAuth,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signOut,
  updateProfile,
} from '@react-native-firebase/auth';
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
  where,
} from '@react-native-firebase/firestore';
import {
  getDownloadURL,
  getStorage,
  ref,
  uploadString,
} from '@react-native-firebase/storage';

// `@react-native-firebase/firestore@24` doesn't ship .d.ts for the modular
// subpath, so we derive the constraint type from `query()`'s second argument.
type QueryConstraint = NonNullable<Parameters<typeof query>[1]>;

// RN Firebase auto-initializes the default app from
// `GoogleService-Info.plist` (iOS) and `google-services.json` (Android)
// at native startup. No `initializeApp` / `firebaseConfig` needed.

export const auth = getAuth();
export const db = getFirestore();
export const storage = getStorage();
export const listenToAuthState = onAuthStateChanged;

interface Credentials {
  email: string;
  password: string;
}

// ------------------------------------------------------------------
// ActionCodeSettings — mejora entregabilidad y permite abrir el
// enlace directamente en la app (handleCodeInApp).
// TODO: reemplazar la URL por un dominio propio verificado en
// Firebase Console > Authentication > Settings > Authorized domains.
// ------------------------------------------------------------------
export const verificationActionCodeSettings: FirebaseAuthTypes.ActionCodeSettings =
  {
    url: 'https://gofare.app/verify-email',
    handleCodeInApp: true,
    iOS: {
      bundleId: 'com.gofare.app',
    },
    android: {
      packageName: 'com.gofare.app',
      installApp: true,
      minimumVersion: '12',
    },
  };

export const createUser = ({ email, password }: Credentials) =>
  createUserWithEmailAndPassword(auth, email, password);

export const signIn = ({ email, password }: Credentials) =>
  signInWithEmailAndPassword(auth, email, password);

// Envía un correo de verificación pasando el user directamente
// (evita race conditions con auth.currentUser en RN Firebase v22).
// NOTA: NO pasamos ActionCodeSettings por defecto porque el dominio
// https://gofare.app aún no está allowlisted en Firebase Console.
// Cuando compres y verifiques un dominio propio, pasa
// `verificationActionCodeSettings` como segundo argumento.
export const sendVerificationEmail = async (
  user: FirebaseAuthTypes.User,
  actionCodeSettings?: FirebaseAuthTypes.ActionCodeSettings,
) => {
  try {
    if (actionCodeSettings) {
      await sendEmailVerification(user, actionCodeSettings);
    } else {
      await sendEmailVerification(user);
    }
    console.log(
      '[Firebase] Verification email sent successfully to:',
      user.email,
    );
  } catch (error) {
    console.error('[Firebase] Error sending verification email:', error);
    throw error;
  }
};

// Aplica un código de acción recibido por deep-link (verificación de email,
// reset de contraseña, etc.).
export const applyEmailVerificationCode = (code: string) =>
  applyActionCode(auth, code);

export const updateUser = (
  user: FirebaseAuthTypes.User,
  profile: { displayName?: string | null; photoURL?: string | null },
) => updateProfile(user, profile);

export const sigOutAccount = async () => {
  await AsyncStorage.removeItem('user');
  try {
    await signOut(auth);
  } catch (error: any) {
    // Si ya no hay usuario activo en el módulo nativo, es seguro ignorar.
    if (error?.code !== 'auth/no-current-user') {
      throw error;
    }
  }
};

export const sentResetEmail = (email: string) =>
  sendPasswordResetEmail(auth, email);

export const sendPhoneVerificationCode = (phoneNumber: string) =>
  signInWithPhoneNumber(auth, phoneNumber);

export const confirmPhoneCode = (
  confirmation: FirebaseAuthTypes.ConfirmationResult,
  verificationCode: string,
) => confirmation.confirm(verificationCode);

export const getUserByCedula = async (
  cedula: string,
): Promise<string | null> => {
  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('cedula', '==', cedula.trim()));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const data = snap.docs[0].data() as { phone?: string };
  return data.phone ?? null;
};

export const getCollection = async (
  collectionName: string,
  queryConstraints: QueryConstraint[] = [],
) => {
  const collectionRef = collection(db, collectionName);
  const collectionQuery = query(collectionRef, ...queryConstraints);
  return (await getDocs(collectionQuery)).docs.map((snapshot) => ({
    id: snapshot.id,
    ...snapshot.data(),
  }));
};

export const getDocument = async (path: string) => {
  return (await getDoc(doc(db, path))).data();
};

export const setDocument = (path: string, data: Record<string, unknown>) => {
  return setDoc(doc(db, path), { ...data, createAt: serverTimestamp() });
};

export const updateDocument = (path: string, data: Record<string, unknown>) => {
  return updateDoc(doc(db, path), data);
};

export const deleteDocument = (path: string) => deleteDoc(doc(db, path));

export const addDocument = (path: string, data: Record<string, unknown>) => {
  return addDoc(collection(db, path), { ...data, createAt: serverTimestamp() });
};

export const uploadBase64 = async (path: string, base64: string) => {
  await uploadString(ref(storage, path), base64, 'data_url');
  return getDownloadURL(ref(storage, path));
};
