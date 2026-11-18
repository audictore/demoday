/* Configuración de la app web de Firebase (proyecto "Evaluador admin").
   Estas claves NO son secretas: identifican el proyecto; la seguridad la dan las reglas de Firestore (firestore.rules).
   Si se vacían, el sistema vuelve al MODO DEMOSTRACIÓN (datos solo en este navegador). */
window.FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCgK5H47FOs3_G0h1Hfwj3h3PozeGoXj0k',
  authDomain: 'evaluador-admin.firebaseapp.com',
  projectId: 'evaluador-admin',
  storageBucket: 'evaluador-admin.firebasestorage.app',
  messagingSenderId: '408785133730',
  appId: '1:408785133730:web:754f4073bc0f0e6e7277fb',
};
// Dirección publicada: los QR la usan aunque el panel se abra desde localhost.
window.PUBLIC_URL = 'https://audictore.github.io/demoday/';
