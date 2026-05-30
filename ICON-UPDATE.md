# Updating the App Icon & Logo

A quick reference for changing the Nishar Telecom POS icon and brand logo, and
making sure the change actually shows up after deploy.

---

## Which file is what

### App icons (PWA / browser tab / installed app)
- `assets/icon-192.png` — 192×192, square
- `assets/icon-512.png` — 512×512, square
- Referenced in `manifest.json` (the `icons` array).

These are the icons used for the browser tab, the "Add to Home Screen" /
install prompt, and the installed app launcher.

### Brand logos (shown inside the app)
- `assets/logo-hexagon-dark.svg` — sidebar logo, dark theme
- `assets/logo-hexagon-light.svg` — sidebar logo, light theme
- Inline `<svg>` block inside `login.html` — the logo on the login screen

`js/app.js` automatically swaps between the dark and light SVG based on the
current theme. The login page has its own copy of the logo embedded directly in
the HTML.

---

## How to change the APP ICON

1. Create your new design as a square PNG.
2. Export it at **two sizes**: 192×192 and 512×512.
3. Overwrite `assets/icon-192.png` and `assets/icon-512.png`, **keeping the exact
   same filenames**. If you keep the names, you do not need to edit
   `manifest.json`.
   - If you rename the files or add more sizes, update the `icons` array in
     `manifest.json` to match.
4. Follow the **Deploy & cache-bust** steps below.

Tip: keep some empty padding around the artwork (a "safe zone") so the icon
isn't cut off when launchers apply rounded or circular masks.

---

## How to change the LOGO (SVG)

Redesign the logo, then update **all three** places so it's consistent
everywhere:

1. `assets/logo-hexagon-dark.svg`  (dark-theme sidebar)
2. `assets/logo-hexagon-light.svg` (light-theme sidebar)
3. The inline `<svg>...</svg>` block inside `login.html` (login screen)

You can edit SVGs in a vector tool (Figma, Inkscape, Illustrator) and re-export,
or edit the markup directly if the change is simple.

Then follow the **Deploy & cache-bust** steps below.

---

## Deploy & cache-bust (REQUIRED — don't skip)

The service worker caches assets, so a new icon/logo will NOT appear until the
cache is refreshed. This is the step people most often forget.

1. Open `sw.js` and **bump the cache version** by one, e.g.:

   ```js
   const CACHE = 'nishar-pos-v5';   // change to 'nishar-pos-v6'
   ```

   Increment it every time you change any cached asset.

2. Deploy:

   ```bash
   firebase deploy --only hosting
   ```

3. Reload the live site. Because the app uses network-first for pages and the
   icons/manifest are served with no-cache headers (see `firebase.json`), the
   changes should appear on a normal refresh.

---

## If the icon still looks old

- **Installed app (desktop / home screen):** the launcher icon is cached by the
  operating system, separately from the browser. **Uninstall and reinstall** the
  app once to pick up the new icon. This never updates automatically.
- **Browser tab favicon:** the stickiest cache of all. Do a hard refresh, or
  clear site data once:
  - DevTools (F12) → **Application** → **Storage** → **Clear site data**, then
    reload.
- **Old service worker stuck:** DevTools → **Application** → **Service Workers**
  → **Unregister**, then reload.

---

## Checklist

- [ ] New icon exported at 192×192 and 512×512
- [ ] `assets/icon-192.png` and `assets/icon-512.png` overwritten (same names)
- [ ] Logo updated in all 3 places (if changing the logo)
- [ ] `manifest.json` updated (only if filenames/sizes changed)
- [ ] Cache version bumped in `sw.js`
- [ ] `firebase deploy --only hosting`
- [ ] Reloaded / cleared cache / reinstalled app if needed
