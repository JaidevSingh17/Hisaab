# GaronchiHisaab

A personal money tracker: what came in, what went out, what you saved, and a plan for the rest.
Everything is stored on the device you use it on. There is no account and no server.

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
