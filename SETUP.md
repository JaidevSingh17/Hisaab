# Turn on Google sign-in and sync

Until you do this, GaronchiHisaab runs as before: no login, entries on the device only.
The whole setup is free and takes about 15 minutes. You do it once, signed in to your own Google account.

## 1. Create the Firebase project

1. Go to https://console.firebase.google.com and choose **Add project** (or **Create a project**).
2. Name it, for example `garonchi-hisaab`. Google Analytics is not needed; switch it off.

## 2. Switch on Google sign-in

1. In the left menu: **Build > Authentication > Get started**.
2. Open the **Sign-in method** tab, choose **Google**, switch **Enable** on, pick your support email, **Save**.

## 3. Create the database

1. In the left menu: **Build > Firestore Database > Create database**.
2. Pick a location close to you (for India, `asia-south1` is Mumbai). Start in **production mode**.

## 4. Register the web app and copy its settings

1. Click the gear icon > **Project settings**. Under **Your apps**, click the web icon `</>`.
2. Give it a nickname and register it. Firebase shows a `firebaseConfig` block.
3. Open `js/firebase-config.js` in this folder and paste the four values into `FIREBASE_CONFIG`
   (`apiKey`, `authDomain`, `projectId`, `appId`).
4. In the same file, put both Gmail addresses in `ALLOWED_EMAILS`, in lower case.

These values are not secret. They only say which project the app talks to. The rules in the next step are what keep the data private.

## 5. Lock the database to your two accounts

1. Open `firestore.rules` in this folder and replace the two example addresses with your real ones.
2. In the console: **Firestore Database > Rules**. Paste the whole file in and click **Publish**.

## 6. Try it on this computer

Start the preview and open http://localhost:5181. You should see the sign-in screen.
`localhost` is allowed by default, so sign-in works here straight away.

## 7. Put it online for your phones

Firebase Hosting gives you a free `https://` address, which the phones need.

    npm install -g firebase-tools
    firebase login
    firebase use --add
    firebase deploy

`firebase use --add` asks which project to use: pick the one from step 1.
`firebase deploy` uploads the app and the database rules, then prints your address
(`https://your-project.web.app`). That address is already allowed to sign in.

On each iPhone: open the address in **Safari**, tap **Share > Add to Home Screen**, open the app and sign in.

## How sync behaves

- Every change is saved on the device first, then copied online a moment later.
- Offline, the app keeps working. Changes are sent when the connection returns.
- If two devices add entries while offline, both sets are kept. For settings, budgets and goals, the most recent change wins.
- Each of you has your own data. Neither account can read the other's.
- Whenever you change any file later, raise `VERSION` in `sw.js` and run `firebase deploy` again.
