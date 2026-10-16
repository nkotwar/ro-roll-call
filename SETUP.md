# Hazri: setup

About 15 minutes, once. Everything here is free.

The app is public code on GitHub. **Staff data never goes to GitHub**: you load `udairo.js` once inside the app on your phone, and it stays there.

## 1. Put the app on GitHub Pages

1. On github.com, click **+ → New repository**. Name it `ro-roll-call`, set it to **Public**, and click **Create repository**.
2. Click **uploading an existing file**, then drag in every file from this folder: `index.html`, the `live` folder (its `index.html` is the page viewers open), `styles.css`, `version.js`, the nine scripts (`core.js`, `google.js`, `meeting.js`, `heartbeat.js`, `ui.js`, `sheets.js`, `views.js`, `live.js`, `actions.js`), `sw.js`, `manifest.webmanifest`, `icon.svg`, `icon-192.png`, `icon-512.png`, `README.md`, `SETUP.md` and `.gitignore`. Click **Commit changes**.
   - Do **not** upload `udairo.js`, or any backup or mappings file.
   - `.gitignore` is hidden on some computers. If you can't see it, skip it; it only protects you when using git from a computer.
3. In the repository, go to **Settings → Pages**. Under *Build and deployment*, set Source to **Deploy from a branch**, Branch to **main**, folder **/ (root)**, then **Save**.
4. After a minute or two the page shows your address:
   **`https://nkotwar.github.io/ro-roll-call/`**
   (If your GitHub username isn't `nkotwar`, use yours in its place everywhere below.)

## 2. Create the Google Cloud project ✓

## 3. Consent screen ✓

Testing mode is fine for one user. Google may ask you to sign in again about once a week. That's expected.

## 4. Client ID

1. **APIs & Services → Credentials → Create credentials → OAuth client ID** (or *Google Auth Platform → Clients → Create client*).
2. Application type **Web application**, name `Hazri web`.
3. **Authorised JavaScript origins → Add URI**, then enter exactly:
   **`https://nkotwar.github.io`**
   Just the address, with no `/ro-roll-call` path and no slash at the end. Google only accepts the bare origin here.
4. Leave **Authorised redirect URIs** empty.
5. **Create**, then copy the **Client ID** (ends in `.apps.googleusercontent.com`). You don't need the client secret.

A new origin can take a few minutes to start working. If sign-in says `origin_mismatch`, wait five minutes and try again.

## 5. On your phone

1. Open `https://nkotwar.github.io/ro-roll-call/` in Chrome.
2. Menu ⋮ → **Add to Home screen / Install app**. Open it from the home-screen icon from now on.
3. On the first screen, tap **Import udairo.js** and pick the file. Only names, emp IDs, designations, phone numbers and departments are kept; DOB, DOJ and emails are dropped.
4. **Settings** tab → paste the Client ID → **Connect** → choose your Gmail → allow both Meet permissions.
5. Settings → **Storage → Allow**, so Android never clears your data to free space.
6. **Meeting → Try a demo meeting** to practise, then **Create meeting** for a real one.

## Good to know

- **New udairo.js:** Settings → Import → pick the new file. Branches and staff are updated, and tags stay with each person because they follow the emp ID. Edits you made in the app's directory are replaced by the file.
- **Backups:** tags live only on this phone. Use Settings → *Full backup* now and then and send it to yourself on Drive or WhatsApp. A full backup contains staff data, so keep it private. *Mappings only* moves tags to a second phone.
- **Existing meetings:** *Track an existing meeting* works for Meet links created from the same Google account (Calendar or the Meet app).
- **Host controls:** if Google rejects them for a personal Gmail, the app still creates an Open meeting and tells you to set chat and screen sharing from Meet's own Host controls.
- **Updating the app:** upload the changed files and raise the number in `version.js` (the only place the version lives). Phones then show "Version N is available" in Settings → App; tap **Update now**.

Built by Nitin Kotwar (139535), via PDUDAIRO.


## Live link (Firebase)

The VC Desk's **Share live** posts an encrypted copy of the board to a free Firebase Realtime Database
(`hazri-live`, Singapore), so anyone with the link can watch and help call. The key is in the link after `#`
and never reaches Firebase. The database address is in `live.js` (`LIVE_HOME`). Its rules (Realtime Database → Rules):

```json
{
  "rules": {
    ".read": false,
    ".write": false,
    "live": {
      "$id": {
        ".read": "$id.length >= 22",
        ".write": "$id.length >= 22",
        "board": { ".validate": "newData.isString() && newData.val().length < 150000" },
        "calls": { "$c": { ".validate": "newData.isString() && newData.val().length < 3000" } },
        "$other": { ".validate": false }
      }
    }
  }
}
```
