# italiaciv

**Italy, drawn like a strategy game.** Every hex, city and number comes from Italian public data (ISTAT, Il Sole 24 Ore "Qualità della vita", Natural Earth, UNESCO and others, listed in the in-app Almanac under *Sources*).

This is an experiment in using **Claude Opus 5.5** (Anthropic): starting from the code that [Andrej Karpathy](https://karpathy.ai) released for [usaciv](https://karpathy.ai/usaciv), Claude adapted the project to Italy: new data pipeline, provinces as cities, Italian regions, and an Italian/English interface (switch IT | EN in the top bar, or add `?lang=en` to the address).

## Disclaimer

This is an experiment, provided **as is**, without warranty of any kind.
- The data come from third-party public sources and may contain errors, be outdated or be processed imperfectly. Some elements (for example land cover and site locations) are estimates or placed by hand, as noted in the app.
- Nothing here is official statistics or advice of any kind: check the original sources before relying on any figure.
- This is a my personal side project, it is not affiliated with or endorsed by Andrej Karpathy, Anthropic, ISTAT or any data provider.

## License

Code: MIT License (see [LICENSE](LICENSE)), copyright Andrej Karpathy, like the original. Data remain under their original licenses, listed in the app under *Sources*; in particular, the Il Sole 24 Ore "Qualità della vita" indicators are CC BY-NC 4.0, so the data may not be reused commercially.

## Run locally

It is a static site (ES modules and Canvas 2D, no build step): serve this folder over HTTP, e.g. `python3 -m http.server 8765`, and open http://127.0.0.1:8765.
