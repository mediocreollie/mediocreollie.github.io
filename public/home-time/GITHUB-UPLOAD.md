# Put Get Me Home on GitHub

The export ZIP is designed for GitHub's browser uploader. It contains the complete source, tests, generated transport configuration, and an optional deployment workflow. It deliberately excludes `node_modules`, raw GTFS/OpenStreetMap downloads, temporary builds, and credentials.

## Easiest option: keep the working app and link to it

The finished app is already running at:

<https://get-me-home-adelaide.ollietwilson00.chatgpt.site>

Upload the source to GitHub for safekeeping, then add this link to your existing personal website. The current hosted app remains the working version.

## Upload the source using only your browser

1. Find `get-me-home-github-source.zip` in the `outputs` folder and extract it on your computer.
2. On GitHub, create a new repository such as `get-me-home-adelaide`. Leave **Add a README** unticked because this bundle already contains one.
3. Open the empty repository and choose **uploading an existing file**. In an existing repository, choose **Add file → Upload files**.
4. Open the extracted folder, select everything inside it, and drag those items onto the GitHub upload page. Drag the *contents*, not the ZIP file itself.
5. Use a commit message such as `Add Get Me Home app`, then choose **Commit changes**.

That is enough to store and share the complete project on GitHub.

## Add a link to an existing GitHub Pages website

Paste a normal link wherever you want the app to appear:

```html
<a href="https://get-me-home-adelaide.ollietwilson00.chatgpt.site">
  Open Get Me Home
</a>
```

If your site uses Markdown:

```markdown
[Open Get Me Home](https://get-me-home-adelaide.ollietwilson00.chatgpt.site)
```

## Why the app cannot be copied directly into GitHub Pages

GitHub Pages serves static files only. Adelaide Metro's realtime protobuf endpoint did not return browser CORS permission, so the app needs its tiny `/api/realtime` server route. Uploading only a static build to GitHub Pages would remove live predictions and service alerts.

## Optional: deploy the GitHub repository on Cloudflare's free tier

The included **Deploy Get Me Home** GitHub Action builds and deploys the complete app, including the realtime route.

1. Create or sign in to a Cloudflare account.
2. In Cloudflare, create an API token using the **Edit Cloudflare Workers** template. Copy the token and your Cloudflare account ID.
3. In the GitHub repository, open **Settings → Secrets and variables → Actions**.
4. Create these two repository secrets:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
5. Open the repository's **Actions** tab, select **Deploy Get Me Home**, choose **Run workflow**, then confirm **Run workflow**.
6. When the action completes, its deployment step displays the new Cloudflare URL.

No Adelaide Metro key, paid map API, database, or application secret is required.

## Update the timetable later

On a computer with Node.js 22 or newer:

```bash
npm install
npm run gtfs:refresh
npm test
```

Upload or commit the changed `data/transit-config.json` and `docs/network-discovery.md` files afterward.
