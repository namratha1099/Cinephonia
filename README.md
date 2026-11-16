# 🎬 Cinephonia – Guess the Film by Its Music

An elegant movie-music quiz. Players hear a **15-second** clip and pick the film it comes from.
Songs come in **Tollywood**, **Bollywood** and **Hollywood** categories. Only the admin can add songs,
either as **YouTube links** or as uploaded audio files.

## Features

- **🎟 Party mode (online):** host a room, share the 5-letter code or invite link, and friends join from their own phones or laptops. Everyone hears the same song at the same time, with a 3-2-1 countdown, live "locked in" ticks and a results board after each scene. It runs through the free PeerJS service, with no account or setup.

- **Solo, Me vs Bot, or 2–6 players** taking turns on one device. The bot has three levels: Rookie, Pro and Maestro.
- **Film industry, difficulty and scenes** are all chosen from dropdowns on the start page.
- **Difficulty:** Easy (3 choices), Medium (4), Hard (5), or Progressive (Easy → Medium → Hard).
- **⚡ Lightning bonus:** a correct answer in the first 5 seconds earns extra points and a funny dancing-popcorn animation.
- **YouTube songs:** the audio plays while the video stays covered, then the video is revealed after the answer.
- **Admin studio** (`admin.html`): add YouTube links or upload audio, edit and delete songs, and publish to GitHub.

## Files

```
index.html        the game (what players see)
admin.html        admin studio (needs your GitHub token)
css/style.css     styles
js/common.js      shared audio, YouTube helpers, categories, demo tunes
js/game.js        game logic, including the bot
js/admin.js       admin logic (GitHub API)
songs.json        song list (written by the admin studio)
songs/            uploaded audio files, one folder per industry
config.json       site title, demo pack on/off, custom celebration videos
celebrations/     optional custom funny videos
```

---

## Step-by-step: put Cinephonia on GitHub

### Step 1: Create a GitHub account
Go to <https://github.com> and sign up, or sign in if you already have an account.

### Step 2: Create a new repository
1. Click **+** (top right) → **New repository**.
2. Repository name: `cinephonia`.
3. Choose **Public**. GitHub Pages is free for public repositories.
4. Leave "Add a README" **unticked**, since this project already has one.
5. Click **Create repository**.

### Step 3: Upload the files
1. Unzip `cinephonia.zip` on your computer.
2. On the new repository page, click **uploading an existing file**.
3. Open the unzipped `cinephonia` folder, select **everything inside it** (not the folder itself) and drag it into the browser. That includes `index.html`, `admin.html`, `css`, `js`, `songs`, `celebrations`, `config.json`, `songs.json` and `README.md`.
4. Click **Commit changes**.

> `index.html` must be at the top level of the repository, not inside a sub-folder.
>
> The empty `.nojekyll` file is hidden on most computers and is optional. If it doesn't upload, nothing breaks.

**Using Git instead (optional):**
```bash
cd cinephonia
git init
git add .
git commit -m "Cinephonia: first version"
git branch -M main
git remote add origin https://github.com/<your-username>/cinephonia.git
git push -u origin main
```

### Step 4: Turn on GitHub Pages
1. In the repository, open **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **Deploy from a branch**.
3. Branch: **main**, folder: **/ (root)**, then **Save**.
4. Wait 1–2 minutes and refresh. GitHub shows your site address:
   `https://<your-username>.github.io/cinephonia/`

### Step 5: Create your admin token
1. GitHub → your profile picture → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. Name: `cinephonia-admin`. Pick an expiration, for example 90 days.
3. **Repository access → Only select repositories →** `cinephonia`.
4. **Permissions → Repository permissions → Contents → Read and write**.
5. Click **Generate token** and copy it. It starts with `github_pat_`. Keep it private.

### Step 6: Add songs as the admin
1. Open `https://<your-username>.github.io/cinephonia/admin.html`.
2. Owner and repository are filled in automatically. Paste your token and click **Connect**.
   Tick **Remember on this device** if you're on your own computer.
3. **YouTube link** tab: paste a link, type the movie title, choose the industry and difficulty, and set the start second (or use a link with `&t=75s`). Click **▶ Preview** to check it plays, then **Add & publish**.
4. **Upload audio file** tab: drop MP3 files, check the titles, then **Upload & publish**.
5. Wait about a minute, open the game, and play.

Players only ever open the main address. They can play, but they can't change songs.

---

## Notes

- **Security:** `admin.html` is reachable by anyone, but nothing can be changed without your token. The token stays in your browser and is sent only to `api.github.com`. Revoke it on GitHub at any time.
- **YouTube:** some videos are blocked from playing on other sites by their owners. The admin preview shows this, and the game skips such videos automatically. YouTube's terms generally expect the player to be visible, so if you make the site widely public, uploaded audio clips you have rights to are the safest option.
- **Copyright:** movie songs are copyrighted. Use them responsibly, especially on a public site.
- **Hide the Demo Pack** once you have real songs: set `"showDemo": false` in `config.json`.
- **Run locally:** `python3 -m http.server 8000`, then open <http://localhost:8000>.

## Party mode notes

- The host's page must stay open for the whole game, because the host's browser runs the party.
- Up to 8 players. Everyone must open the same website address.
- Some strict office or school networks block direct connections. If friends can't join, try mobile data.
