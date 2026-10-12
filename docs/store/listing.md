# Chrome Web Store listing

Copy for the developer dashboard. Images are in this folder.

## Store listing tab

**Name:** Softtab

**Summary** (from `manifest.json`, max 132 characters):
A quiet new tab: weather, the subway, Raindrop, radio and work links.

**Category:** Productivity → Tools

**Language:** English

**Description:**

> Softtab replaces the new tab page with a calm, soft-UI dashboard. Each tab does one thing:
>
> • Weather: the time and weather in your cities, side by side.
> • Subway: live NYC subway departures for your trips, and when to leave to catch them.
> • Raindrop: search your Raindrop.io bookmarks by text or tag, and paste a link to save it.
> • Music: a preset radio. See what's on air on FIP, NTS and KEXP, or the latest posts from YouTube, SoundCloud, Mixcloud and NTS shows. Listen opens the source.
> • Link boards: your everyday links grouped by category, as many boards as you like.
>
> Light, dark or system theme. Keyboard shortcuts for everything. Tabs can be renamed, hidden or added from Settings, and your setup can be exported to a file.
>
> Softtab has no account, no server and no tracking. Your settings stay in Chrome. It asks for access to a service only when you first use the tab that needs it.
>
> Open source: https://github.com/dtsbourg/softtab

**Images:**
- Icon: `icons/128.png`
- Screenshots (1280×800): `1-music.png`, `2-weather.png`, `3-subway.png`, `4-raindrop.png`, `5-work.png`
- Small promo tile (440×280): `promo-440x280.png`

**Website:** https://github.com/dtsbourg/softtab

**Support:** https://github.com/dtsbourg/softtab/issues

## Privacy practices tab

**Single purpose:**
Softtab replaces Chrome's new tab page with a dashboard showing the user's chosen cities' weather, NYC subway departures, Raindrop bookmarks, radio presets and links.

**Permission justifications:**

| Permission | Justification |
|---|---|
| `storage` | Saves the user's setup (cities, trips, links, presets, theme) and their Raindrop token, and caches recent results so the page opens quickly. |
| `favicon` | Shows website icons next to the user's links, from Chrome's local favicon cache. |
| Host: `api.open-meteo.com`, `geocoding-api.open-meteo.com` | Weather forecasts for the user's cities, and city search when adding one. Granted at install because Weather is the default tab. |
| Optional host: `api-endpoint.mta.info` | Live NYC subway departures and service alerts for the Subway tab. Requested the first time Subway is opened. |
| Optional host: `api.raindrop.io` | Searching and saving the user's Raindrop.io bookmarks with their own token. Requested when the token is saved. |
| Optional hosts: `api.radiofrance.fr`, `www.nts.live`, `api.kexp.org` | What's on air for radio stations in the user's Music presets. |
| Optional hosts: `www.youtube.com`, `soundcloud.com`, `feeds.soundcloud.com`, `api.mixcloud.com`, `www.mixcloud.com` | Public feeds of the channels in the user's Music presets (YouTube's official RSS feed, SoundCloud RSS, Mixcloud API), and titles of links added to favorites (oEmbed). |
| Optional host: `de1.api.radio-browser.info` | Searching the public Radio Browser directory when programming a preset. |

**Remote code:** No, I am not using remote code. (All JavaScript is in the package.)

**Data usage**, tick:
- **Authentication information**: the Raindrop token the user enters, stored locally and sent only to Raindrop.

Leave every other category unticked. Then tick all three certifications:
- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

**Privacy policy URL:** https://raw.githubusercontent.com/dtsbourg/softtab/main/PRIVACY.md (the github.com/…/blob link was down at submission)

## Distribution tab

- Visibility: Public (or Unlisted to share by link first)
- Regions: All regions
