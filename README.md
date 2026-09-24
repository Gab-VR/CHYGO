# A deckbuilder

Just another deckbuilder webapp. It is a single static page with no build step.

```
index.html                 page skeleton
css/app.css                all styles
js/                        the app, as ES modules (see "Code layout")
tests/                     unit tests: node --test
data/cards.json            card snapshot (generated, don't edit)
data/meta.json             snapshot version (generated)
scripts/update-cards.mjs   builds data/ from the YGOPRODeck API
scripts/download-images.mjs  one-time fill of a local picture folder
.github/workflows/         daily data update; tests on every push
```

## Code layout

Logic modules never import interface code. They report changes with `emit()` and
`main.js` decides what to redraw, so every file can be read (and tested) on its own.

```
js/util.js        h() element helper, toast, binom, event bus (on/emit), download
js/store.js       app state S, saving (localStorage + IndexedDB), card()/deck()/fmt(), changed()
js/cards.js       card model helpers, loading and syncing data/cards.json
js/legality.js    formats, limits, Genesys points, card pool, validate()
js/deck.js        add/move/reorder, custom order, categories
js/ydk.js         .ydk and ydke:// import/export
js/prob.js        exact opening-hand probabilities (multivariate hypergeometric)
js/images.js      picture folder / URL path, diagnostics
js/backup.js      back up and restore every deck and format
js/ui.js          header, tab switching, card tiles, picture status, card picker
js/tabs/*.js      one file per tab: build, hands, stats, smallworld, format
js/main.js        registers the tabs, wires events, starts the app
```

To add a tab: create `js/tabs/mytab.js` exporting a `renderMyTab()` that fills
`#tab-mytab`, add a `<button data-tab="mytab">` and `<section class="tab" id="tab-mytab">`
to `index.html`, and call `registerTab("mytab", renderMyTab)` in `main.js`.

Open the app with `?debug` (`http://localhost:8000/?debug`) to use every module's
functions from the browser console.

## Tests

```
node --test        # Node 18+; no packages to install
```

They cover the hand-probability engine against closed-form hypergeometric values,
format legality (lists, overrides, Genesys), deck editing rules, and .ydk / ydke.
GitHub runs them on every push.

## How data flows

The update workflow runs on GitHub's servers once a day. It asks YGOPRODeck for its
database version (one tiny request) and stops if nothing changed. When the version
changes, or at least once a week, it downloads the card list and both Genesys point
lists (three requests, a second apart), trims them, and commits `data/`.

Each browser checks `data/meta.json` on load and downloads `data/cards.json` only when
the version differs from its cached copy, which lives in IndexedDB. Browsers never
contact YGOPRODeck or any other third party.

## Using it locally

Serve the folder instead of opening `index.html` as a file: browsers don't run the
app's modules from `file://` (the page explains this if you try).

```
python3 -m http.server 8000     # from the repo folder (works in WSL), then open http://localhost:8000
```

Decks are stored per address, so moving from `file://` to `localhost` (or to your hosted
site) starts empty: use *Format, Backup* to carry everything across.

## Card images

Nothing is downloaded by default; tiles are coloured by card frame. Under
*Format, Card images*:

- **Image folder**: pick a folder of images named by passcode, such as EDOPro's `pics/`.
  Files are read locally and never uploaded.
  
## Credits

Card data from the [YGOPRODeck API](https://ygoprodeck.com/api-guide/). Yu-Gi-Oh! card
text and images are copyright 4K Media Inc., a subsidiary of Konami Digital
Entertainment. This project is not affiliated with YGOPRODeck, 4K Media or Konami.
