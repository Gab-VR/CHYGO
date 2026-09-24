
# Yu-gi-oh Duelist Utilities

Just another Deckbuilder app.

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
