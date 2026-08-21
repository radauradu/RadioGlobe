# Radio Globe

Explore live radio stations on a fast, interactive 3D Earth. Radio Globe is a
Next.js App Router MVP powered by CesiumJS, the public Radio Browser directory,
HTML5 Audio, and HLS.js.

## Run locally

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Features

- Streamed satellite map tiles that remain sharp during deep zoom
- Nearly 50,000 stations loaded progressively as one WebGL point collection
- Exact coordinates where available, with clearly labeled country-level
  placement for stations that only publish a country
- IndexedDB point-index caching and on-demand station detail loading
- Point/crosshair tuning with animated camera focus
- Search and filters for station, country, and genre
- Saved stations appear as bright yellow pins on the globe
- HTML5 and HLS playback, ICY title probes, volume, mute, and visualization
- Restricted same-origin relay for HTTP/CORS streams with destination checks

## Stream relay

The relay only accepts Radio Browser station IDs, resolves station URLs on the
server, blocks local/private destinations, limits redirects and probe sizes,
and applies request timeouts. HLS playlist resources are restricted to the
station host. Long-running audio responses remain subject to the bandwidth and
request-duration limits of the deployment platform.

## Data and assets

Station data comes from the community-maintained
[Radio Browser API](https://www.radio-browser.info/).

Satellite imagery is streamed from
[Esri World Imagery](https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9),
with source credits displayed in the globe. The 8K night texture is provided by
[Solar System Scope](https://www.solarsystemscope.com/textures/) under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
