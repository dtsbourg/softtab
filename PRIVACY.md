# Softtab Privacy Policy

*Effective 12 October 2026*

Softtab is a Chrome extension that replaces the new tab page. It has no server, no account, no analytics and no ads. The developer receives no data from it.

## What Softtab stores

- **Your setup**: cities, subway trips, link boards, hidden tabs, music presets, favorites, pins and theme. These are kept in Chrome's extension storage. If Chrome sync is on, Chrome syncs them between your own devices through your Google account.
- **Your Raindrop token**, if you add one. It stays in Chrome's local extension storage on this device and is never synced or exported.
- **Recent results** (weather, train times, bookmarks, latest posts), cached in the browser so the page opens quickly.

Uninstalling Softtab deletes all of it. Settings → Backup can export your setup to a file you keep.

## Who Softtab talks to

Your browser contacts these services directly, and only when you use the matching tab. Softtab asks Chrome for access to each one the first time it's needed, except Open-Meteo, which Weather uses from the start.

| Service | What it receives |
|---|---|
| Open-Meteo | Weather for your cities (their coordinates), and city names you type when adding a city. |
| MTA | Live subway feeds and service alerts. Whole lines are downloaded; your stations aren't sent. |
| Raindrop.io | Your token, your searches, and links you choose to save. |
| Radio France, NTS, KEXP | What's on air for stations in your presets. |
| YouTube, SoundCloud, Mixcloud, NTS | Public feeds of the channels in your presets, and titles of links you add to favorites. Requests to YouTube are made like a normal visit, so YouTube may see your usual YouTube cookies. |
| Radio Browser | Station names you type when programming a preset. |

Each service's own privacy policy applies to those requests. Link icons come from Chrome's local favicon cache, without a network request.

## What Softtab doesn't do

- No tracking, analytics, ads or remote code.
- No selling or sharing of data, and no use of it for anything but the features above.
- No reading of the pages you visit or your browsing history.

## Contact

Questions or concerns: open an issue at [github.com/dtsbourg/softtab/issues](https://github.com/dtsbourg/softtab/issues). If this policy changes, the new version will be posted here with a new date.
