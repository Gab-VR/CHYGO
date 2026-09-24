# Deck Forge

A Yu-Gi-Oh! deckbuilder: search and build with legality checks for editable formats
(including Genesys points), exact opening-hand probabilities by category, deck stats,
and a Small World bridge graph. It is a single static page with no build step.

```
index.html                         the whole app
data/cards.json                    card snapshot (generated, don't edit)
data/meta.json                     snapshot version (generated)
scripts/update-cards.mjs           builds data/ from the YGOPRODeck API
.github/workflows/update-cards.yml runs the script daily and commits data/
```

## How data flows

The update workflow runs on GitHub's servers once a day. It asks YGOPRODeck for its
database version (one tiny request) and stops if nothing changed. When the version
changes, or at least once a week, it downloads the card list and both Genesys point
lists (three requests, a second apart), trims them, and commits `data/`.

Each browser checks `data/meta.json` on load and downloads `data/cards.json` only when
the version differs from its cached copy, which lives in IndexedDB. Browsers never
contact YGOPRODeck or any other third party.

## First-time setup

1. Create a repository and add these files. Keep the `.github` folder.
2. Open the **Actions** tab, choose **Update card data**, and click **Run workflow**.
   After about a minute, `data/` is committed.
3. Pick a host (next section).

To run the script on your own machine instead (Node 18 or newer):

```
node scripts/update-cards.mjs          # skips work if nothing changed
node scripts/update-cards.mjs --force  # rebuild anyway
```

## Hosting

The published site is public in every setup below. Keeping the repository private only
hides your source history.

**Public repo, GitHub Pages.** Go to *Settings, Pages*, then *Deploy from a branch*,
`main`, `/ (root)`. The daily commit redeploys the site automatically.

**Private repo, Cloudflare Pages or Netlify.** Connect the repository in their
dashboard. Leave the build command empty and set the output directory to `/`. Every
push, including the bot's daily commit, redeploys. Actions minutes come from your free
monthly quota; this job uses roughly 30 minutes a month.

**Private source, public site repo.** Uncomment the last step of the workflow and follow
its comment to add a deploy key. The public repo then only ever receives the built
site, and you enable GitHub Pages there.

## Using it locally

Browsers won't let a page opened from `file://` read `data/`. Either click
**Load cards.json** in the app, or serve the folder:

```
python3 -m http.server 8000     # then open http://localhost:8000
```

## Card images

Nothing is downloaded by default; tiles are coloured by card frame. Under
*Format, Card images*:

- **Image folder**: pick a folder of images named by passcode, such as EDOPro's `pics/`.
  Files are read locally and never uploaded. Chrome and Edge remember the folder
  between visits; Firefox and Safari ask each session.
- **Image URL path**: a template such as `pics/{id}.jpg` or `https://your-host/{id}.jpg`,
  if you host your own copy of the images.

The app does not hotlink YGOPRODeck's image server, per their API guidelines.

## Credits

Card data from the [YGOPRODeck API](https://ygoprodeck.com/api-guide/). Yu-Gi-Oh! card
text and images are copyright 4K Media Inc., a subsidiary of Konami Digital
Entertainment. This project is not affiliated with YGOPRODeck, 4K Media or Konami.
