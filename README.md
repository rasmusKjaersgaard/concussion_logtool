# Smertedagbog

A small pain diary for head and neck pain, made for iPhone. It runs as an app from the home screen, works offline, and keeps all data on the phone only. No account, no server, nothing is sent anywhere.

## The files

Upload all of these, side by side (no folders):

| File | What it is |
|---|---|
| `index.html` | The app page |
| `styles.css` | Colours and layout (follows light/dark mode) |
| `app.js` | Everything the app does |
| `sw.js` | Makes the app work without internet |
| `manifest.webmanifest` | App name and icons |
| `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` | App icons |
| `README.md` | This guide (optional) |

---

## 1. Create a GitHub repository and upload the files

1. Go to **github.com** and sign in (or create a free account via **Sign up**).
2. Click the **+** in the top-right corner and choose **New repository**.
3. Under **Repository name**, type `smertedagbog` (or any name you like – it becomes part of the web address).
4. Choose **Public**. (Free GitHub Pages needs a public repository. Only the app's code is public – the diary entries never leave the phone.)
5. Click **Create repository**.
6. On the next page, click the link **uploading an existing file**.
7. Unzip the download first. Then drag **all the files** (not the folder they're in) into the box on the page.
   *On an iPhone or iPad:* tap **choose your files**, find the unzipped files in the Files app, and select them all.
8. Scroll down and click **Commit changes**.

## 2. Turn on GitHub Pages

1. In your repository, click **Settings** (top menu, gear icon).
2. In the left menu, click **Pages**.
3. Under **Build and deployment → Source**, choose **Deploy from a branch**.
4. Under **Branch**, choose **main** and **/ (root)**, then click **Save**.
5. Wait 1–2 minutes and refresh the page. The address appears at the top, like:
   `https://YOUR-USERNAME.github.io/smertedagbog/`

## 3. Put it on the iPhone home screen

1. Open **Safari** on the iPhone (it must be Safari).
2. Type in the address from step 2 and wait for the app to load.
3. Tap the **Share** button (the square with an arrow pointing up).
4. Scroll down and tap **Add to Home Screen** (Danish: **Føj til hjemmeskærm**).
5. Tap **Add** (**Tilføj**). The icon now sits on the home screen.
6. **Always open the app from the home-screen icon.** The home-screen app keeps its own data, separate from the Safari tab – entries made in Safari won't show up in the app.

The first time it's opened with internet, it saves itself on the phone. After that it also works in flight mode.

---

## Good to know

- **Backups:** In *Indstillinger*, tap **Eksportér backup** and choose **Gem i Arkiv / Save to Files** (e.g. iCloud Drive). Do this regularly – if the app is removed from the home screen, its data is removed too.
- **Restoring:** **Importér backup** merges a backup into what's already there; nothing is duplicated.
- **For the doctor:** **Eksportér som CSV** opens the share sheet, so the file can be sent by Mail or Messages or saved. It opens in Excel (Danish settings), Numbers or Google Sheets.
- **Updating the app later:** Upload the changed files to the repository again (they replace the old ones). The phone picks up the new version in the background – close and reopen the app twice to see it. Data is not affected.
