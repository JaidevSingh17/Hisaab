/* GaronchiHisaab — Google sign-in and cloud sync (Firebase). Loaded as a module, only does anything when firebase-config.js is filled in.
   The app stays local-first: every change is saved on the device straight away, then copied to users/{uid} in Firestore.
   This file only talks to Firebase. Merging and screens live in store.js and app.js. */

const C = window.HisaabCloud;
const SDK = 'https://www.gstatic.com/firebasejs/10.12.5/';
const LAST_UID = 'gh-last-uid';

if (C && C.on) boot();

async function boot() {
  let app, auth, fs;
  try {
    [app, auth, fs] = await Promise.all([import(SDK + 'firebase-app.js'), import(SDK + 'firebase-auth.js'), import(SDK + 'firebase-firestore.js')]);
  } catch (e) { C.fallback(); return; }   /* no network and nothing cached */

  const fapp = app.initializeApp(FIREBASE_CONFIG);
  const A = auth.getAuth(fapp), db = fs.getFirestore(fapp);
  const provider = new auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  const allowed = email => !ALLOWED_EMAILS.length || ALLOWED_EMAILS.map(e => e.toLowerCase()).includes(String(email || '').toLowerCase());
  const explain = e => ({
    'auth/network-request-failed': 'No internet connection. Try again when you are online.',
    'auth/unauthorized-domain': 'This web address is not allowed to sign in yet. Add it under Authentication > Settings > Authorized domains.',
    'auth/operation-not-allowed': 'Google sign-in is not switched on in the Firebase console yet.',
  }[e && e.code] || 'Sign-in did not work. Try again.');

  let ref = null, unsub = null, pushTimer = null, retryTimer = null;
  function setStatus(s) { C.status = s; if (C.onStatus) C.onStatus(); }

  async function doPush() {
    if (!ref) return;
    clearTimeout(retryTimer);
    if (navigator.onLine === false) { setStatus('offline'); return; }
    try { await fs.setDoc(ref, { data: cloudPayload(), updatedAt: Date.now() }); setStatus('synced'); }
    catch (e) {
      setStatus(e.code === 'permission-denied' ? 'denied' : 'error');
      if (e.code !== 'permission-denied') retryTimer = setTimeout(doPush, 20000);
    }
  }
  function schedulePush(ms) {
    if (!ref) return;
    setStatus(navigator.onLine === false ? 'offline' : 'saving');
    clearTimeout(pushTimer); pushTimer = setTimeout(doPush, ms);
  }
  C.push = () => schedulePush(1500);
  window.addEventListener('online', () => { if (ref && C.status !== 'synced') schedulePush(0); });
  window.addEventListener('offline', () => { if (ref) setStatus('offline'); });

  async function popup() {
    try { return await auth.signInWithPopup(A, provider); }
    catch (e) {
      if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') return null;
      /* installed iPhone apps often cannot open a popup, so fall back to a full-page redirect */
      if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') { await auth.signInWithRedirect(A, provider); return null; }
      throw e;
    }
  }
  C.signIn = async () => { try { await popup(); } catch (e) { showLogin(explain(e)); } };
  /* used by "Forgot PIN": proves it is still the same Google account */
  C.reauth = async () => { const r = await popup(); return !!(r && C.user && r.user.uid === C.user.uid); };
  C.signOut = async () => {
    clearTimeout(pushTimer);
    if (ref && C.status !== 'synced') await Promise.race([doPush(), new Promise(r => setTimeout(r, 4000))]);
    await auth.signOut(A);
  };

  auth.getRedirectResult(A).catch(e => showLogin(explain(e)));

  auth.onAuthStateChanged(A, async user => {
    C.booted = true;
    if (unsub) { unsub(); unsub = null; }
    ref = null; clearTimeout(pushTimer); clearTimeout(retryTimer);

    if (!user) {
      C.user = null; C.status = '';
      try { localStorage.removeItem(LAST_UID); } catch (e) {}
      const msg = C.loginMsg || ''; C.loginMsg = '';
      showLogin(msg);
      return;
    }
    if (!allowed(user.email)) {
      C.loginMsg = `${user.email} is not invited to this app.`;
      await auth.signOut(A);
      return;
    }

    C.user = { uid: user.uid, name: user.displayName || '', email: user.email || '', photo: user.photoURL || '' };
    try { localStorage.setItem(LAST_UID, user.uid); } catch (e) {}
    startSession(user.uid);

    ref = fs.doc(db, 'users', user.uid);
    setStatus(navigator.onLine === false ? 'offline' : 'connecting');
    unsub = fs.onSnapshot(ref, snap => {
      if (snap.metadata.hasPendingWrites) return;   /* our own write echoing back */
      const res = cloudApply(snap.exists() ? snap.data().data : null);
      if (res.push) schedulePush(0); else setStatus('synced');
    }, err => setStatus(err.code === 'permission-denied' ? 'denied' : 'offline'));
  });
}
