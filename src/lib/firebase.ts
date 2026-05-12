import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  applyActionCode,
  createUserWithEmailAndPassword,
  type FirebaseAuthTypes,
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithCredential,
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
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';

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

// ── Google Sign-In ───────────────────────────────────────────────────────────
// Requires enabling Google Sign-In in Firebase Console and re-downloading
// google-services.json / GoogleService-Info.plist with the OAuth client IDs.
// Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID to the Web Client ID from Firebase Console.

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

if (GOOGLE_WEB_CLIENT_ID) {
  GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
}

export const signInWithGoogle =
  async (): Promise<FirebaseAuthTypes.UserCredential> => {
    if (!GOOGLE_WEB_CLIENT_ID) {
      throw new Error(
        'Google Sign-In no está configurado. Establece EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.',
      );
    }

    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();

    if (!isSuccessResponse(response)) {
      if (
        isErrorWithCode(response) &&
        (response as any).code === statusCodes.SIGN_IN_CANCELLED
      ) {
        throw Object.assign(new Error('Cancelled'), { code: 'auth/cancelled' });
      }
      throw new Error('Google Sign-In falló');
    }

    const { idToken } = response.data;
    if (!idToken) throw new Error('No se obtuvo el ID token de Google');

    const credential = GoogleAuthProvider.credential(idToken);
    return signInWithCredential(auth, credential);
  };

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

/** Ruta tipo `coleccion/id` (un solo segmento de documento). */
function docRefFromPath(path: string) {
  const parts = path.split('/').filter(Boolean);
  if (parts.length !== 2) {
    throw new Error(`doc path must be "collection/docId", got: ${path}`);
  }
  return doc(db, parts[0], parts[1]);
}

export const getDocument = async (path: string) => {
  return (await getDoc(docRefFromPath(path))).data();
};

export const setDocument = (path: string, data: Record<string, unknown>) => {
  return setDoc(docRefFromPath(path), { ...data, createAt: serverTimestamp() });
};

/** Fusiona campos en `users/{uid}` sin borrar el resto (onboarding / ediciones). */
export const mergeUserProfile = (uid: string, data: Record<string, unknown>) =>
  setDoc(
    doc(db, 'users', uid),
    { ...data, updatedAt: serverTimestamp() },
    { merge: true },
  );

/** Perfil listo para usar la app: flag explícito o documento legacy completo (registro email). */
export async function isProfileOnboardingComplete(
  uid: string,
): Promise<boolean> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return false;
  const d = snap.data() as Record<string, unknown>;
  if (d.onboardingCompleted === true) return true;
  const phoneOk =
    typeof d.phoneNumber === 'string' &&
    /^(0412|0414|0424|0416|0426|0212)\d{7}$/.test(d.phoneNumber);
  const idOk = typeof d.idNumber === 'string' && /^\d{5,10}$/.test(d.idNumber);
  const nameOk =
    typeof d.fullName === 'string' && d.fullName.trim().length >= 3;
  return Boolean(nameOk && idOk && phoneOk);
}

export const updateDocument = (path: string, data: Record<string, unknown>) => {
  return updateDoc(docRefFromPath(path), data);
};

export const deleteDocument = (path: string) => deleteDoc(docRefFromPath(path));

export const addDocument = (path: string, data: Record<string, unknown>) => {
  return addDoc(collection(db, path), { ...data, createAt: serverTimestamp() });
};

export const uploadBase64 = async (path: string, base64: string) => {
  await uploadString(ref(storage, path), base64, 'data_url');
  return getDownloadURL(ref(storage, path));
};
