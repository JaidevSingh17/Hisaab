# GaronchiHisaab

A personal money tracker: what came in, what went out, what you saved, and a plan for the rest.
Entries are saved on your device and, once you sign in with Google, synced to your own account.

## Features

- **Income, Expense & Budget Tracking**: 50/30/20 budget breakdown, categories, and custom savings goals.
- **Bank & UPI Balance Tracking**: Set your current bank balance and watch it update automatically with every incoming stipend and UPI/card/bank debit.
- **Cash in Hand Tracking**: Keep a separate running balance for cash in your pocket.
- **Virtual Passbook**: View your chronological passbook showing opening balance, every transaction, and running balance after each entry.
- **Smart SMS / UPI Auto-fill**: Paste any transaction alert SMS or UPI notification to pre-fill amount, type, mode, note, and category instantly.

## Run it on this computer

    python -m http.server 5181

Then open http://localhost:5181

## Put it on your phones

The app needs an `https://` address before a phone can install it. Any free static host works:

1. Upload this whole folder to GitHub Pages, Netlify or Cloudflare Pages.
2. Open the link in **Safari** on the iPhone (Chrome on Android).
3. Tap **Share**, then **Add to Home Screen**.

Each phone keeps its own separate data. Two people using the same link never see each other's entries.

## Keep your data safe

Deleting the app or clearing browser data erases your entries.
Use **Settings > Save backup file** every couple of weeks; **Restore from backup** brings it back.

## Files

- `index.html` page shell
- `css/styles.css` all styling, light and dark
- `js/store.js` data, dates, money, budgets, plan, score, insights
- `js/charts.js` the three charts
- `js/app.js` screens, forms and events
- `sw.js` offline support. Change `VERSION` in it whenever you edit any file, so phones fetch the update.
