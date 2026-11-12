'use strict';
/* GaronchiHisaab — sign-in and sync settings. Fill these in once; SETUP.md walks through it.

   1. FIREBASE_CONFIG: copy it from the Firebase console
      (Project settings > Your apps > Web app > "Config").
      These values are safe to publish. They only say which project to talk to;
      the database rules in firestore.rules are what keep your data private.

   2. ALLOWED_EMAILS: the Google accounts that may sign in, in lower case.
      Put the same addresses in firestore.rules.

   While apiKey still says PASTE_HERE the app runs exactly as before: no login, data on this device only. */

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyB3qMN33EwX7QD9_EoFLSbrCHm1XW4a9g4',
  authDomain: 'garonchi-hisaab.firebaseapp.com',
  projectId: 'garonchi-hisaab',
  storageBucket: 'garonchi-hisaab.firebasestorage.app',
  messagingSenderId: '549902966242',
  appId: '1:549902966242:web:c4562c361a522a996aadbb',
};

const ALLOWED_EMAILS = [
  'jaidevsinghchib@gmail.com',
  'kavishatalwar@gmail.com',
  'txbeast17@gmail.com',
  '10dvarunsharma@gmail.com',
];

const CLOUD_ON = !!FIREBASE_CONFIG.apiKey && !FIREBASE_CONFIG.apiKey.startsWith('PASTE');
