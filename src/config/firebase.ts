
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { firebaseConfig } from '@/config/env';

// Initialize Firebase
try {
  console.log('Initializing Firebase with config:', {
    projectId: firebaseConfig.projectId,
    authDomain: firebaseConfig.authDomain,
    hasApiKey: !!firebaseConfig.apiKey
  });
  
  const app = initializeApp(firebaseConfig);
  
  // Initialize Firebase services
  const auth = getAuth(app);
  const db = getFirestore(app);
  const storage = getStorage(app);

  // Use emulators in development if needed
  if (import.meta.env.DEV && window.location.hostname === 'localhost') {
    // Uncomment the following lines if you're using Firebase emulators
    // connectFirestoreEmulator(db, 'localhost', 8080);
  }
  
  console.log('Firebase initialized successfully');
  
  export { auth, db, storage };
  export default app;
} catch (error) {
  console.error('Firebase initialization error:', error);
  
  // Provide fallback implementations to prevent app crashes
  const dummyApp = {} as any;
  const dummyAuth = {} as any;
  const dummyDb = {
    collection: () => ({
      doc: () => ({
        get: () => Promise.resolve({ exists: false, data: () => ({}) }),
        set: () => Promise.resolve(),
        update: () => Promise.resolve()
      }),
      where: () => ({
        get: () => Promise.resolve({ empty: true, docs: [] })
      }),
      orderBy: () => ({
        get: () => Promise.resolve({ empty: true, docs: [] })
      }),
      add: () => Promise.resolve({ id: 'dummy-id' })
    })
  } as any;
  const dummyStorage = {} as any;

  export const auth = dummyAuth;
  export const db = dummyDb;
  export const storage = dummyStorage;
  export default dummyApp;
}
