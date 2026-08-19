# Deploy Get Me Home from GitHub

The complete app is stored in `public/home-time` in this repository. It includes the source, tests, generated transport configuration, and deployment workflow. It deliberately excludes `node_modules`, raw GTFS/OpenStreetMap downloads, temporary builds, and credentials.

## Why GitHub Pages is not used

GitHub Pages serves static files only. Adelaide Metro's realtime protobuf endpoint did not return browser CORS permission, so the app needs its tiny `/api/realtime` server route. Uploading only a static build to GitHub Pages would remove live predictions and service alerts.

## Deploy on Cloudflare's free tier

The included **Deploy Get Me Home** GitHub Action builds and deploys the complete app, including the realtime route.

1. Create or sign in to a Cloudflare account.
2. In Cloudflare, create an API token using the **Edit Cloudflare Workers** template. Copy the token and your Cloudflare account ID.
3. In the GitHub repository, open **Settings → Secrets and variables → Actions**.
4. Create these two repository secrets:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
5. Push to `main`, or open the repository's **Actions** tab and run **Deploy Get Me Home** manually.
6. When the action completes, its deployment step displays the Cloudflare URL.

No Adelaide Metro key, paid map API, database, or application secret is required.

## Update the timetable later

On a computer with Node.js 22 or newer:

```bash
npm install
npm run gtfs:refresh
npm test
```

Upload or commit the changed `data/transit-config.json` and `docs/network-discovery.md` files afterward.
