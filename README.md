# Softtab

A neumorphic Chrome new tab page with a few modes:

- **Weather**: clocks and live weather for a list of cities.
- **Subway**: next NYC subway departures for saved trips (from/to station, walk time).
- **Raindrop**: search your Raindrop bookmarks; paste a link to save it.
- **Music**: a preset radio that shows what's on air or a channel's latest posts.
- **Link boards**: tabs of quick links grouped by category (Work, plus any you add).

Tabs can be added, renamed, hidden or deleted from Settings → Tabs.

## Install

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and pick this folder.
3. After changing files, click the reload arrow on the Softtab card.

There is no build step: the extension is plain HTML, CSS and JavaScript.

### Personal defaults

Out of the box Softtab starts with sample content. To start from your own setup instead, create `defaults.local.js` next to `newtab.html` (it is git-ignored):

```js
window.SOFTTAB_LOCAL_DEFAULTS = {
  trips: [{ id: 'downtown', name: 'Downtown', from: 'R16', to: 'R20', walk: 5 }],  // GTFS stop ids from stations.js
  work: [{ g: 'Code', items: [{ n: 'GitHub', u: 'https://github.com' }] }],    // Work board categories
  presets: [/* Music presets */],
  favorites: [/* { t, u, s } */]
};
```

Anything you change in the app is saved in Chrome and takes priority over these defaults.

## Files

| File | What it is |
|---|---|
| `manifest.json` | Extension manifest (MV3, overrides the new tab page) |
| `newtab.html`, `styles.css`, `app.js` | The page |
| `theme-init.js` | Applies the saved theme before first paint |
| `gtfs.js` | Minimal GTFS-realtime decoder for the MTA feeds |
| `stations.js` | NYC subway stations, from the MTA's `Stations.csv` |
| `brand-icons.js` | Bundled service logos |
| `fonts/` | Geist, Geist Mono and Doto |

## Data sources

No API keys are needed except a Raindrop test token, which is stored in the browser.

- Weather and city search: [Open-Meteo](https://open-meteo.com)
- Subway departures and alerts: [MTA GTFS-realtime feeds](https://api.mta.info)
- Station directory for Music presets: [Radio Browser](https://www.radio-browser.info)
- Now playing: Radio France (FIP), NTS, KEXP public APIs
- Latest posts: YouTube channel pages, SoundCloud RSS, Mixcloud and NTS APIs
- Bookmarks: [Raindrop.io API](https://developer.raindrop.io)

## Credits

- Fonts: [Geist](https://vercel.com/font) and [Doto](https://fonts.google.com/specimen/Doto), SIL Open Font License.
- Single-colour logos: [Simple Icons](https://simpleicons.org), CC0.
- Full-colour logos: [gilbarbara/logos](https://github.com/gilbarbara/logos) via Iconify, CC0.
