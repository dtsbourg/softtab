# Changelog

Versions follow [semantic versioning](https://semver.org). The version in `manifest.json` is the one Chrome shows.

## 0.2.0 · 2026-10-12

Ready for the Chrome Web Store.

- **Site access per tab**: only Weather's service is granted at install. Subway, Raindrop and Music ask for theirs the first time they're used, with an Allow access button until then.
- **YouTube** latest posts now come from YouTube's official RSS feed (long-form uploads, no Shorts) instead of the channel page.
- **Backup**: export your setup to a JSON file from Settings and import it back.
- **New icon**: a soft key, sized for the store, the extensions page and the toolbar.
- [Privacy policy](https://dtsbourg.github.io/softtab/privacy.html) and store listing assets in `docs/`.

## 0.1.0 · 2026-10-12

First public version.

- **Weather**: clocks, live weather and daylight for cities you add or remove, sorted west to east.
- **Subway**: live NYC subway departures for saved trips, with "leave in" times, service alerts and rerouted trains flagged.
- **Raindrop**: search your whole Raindrop library, filter by tag, pin items, paste a link to save it.
- **Music**: a preset radio with what's on air (FIP, NTS, KEXP) or the latest posts from YouTube, SoundCloud, Mixcloud and NTS shows, plus Favorites.
- **Link boards**: tabs of quick links by category; add as many as you like.
- Settings: add, rename, hide or delete tabs; light, dark or system theme.
