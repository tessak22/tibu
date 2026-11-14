# Tibu

**Tibu, a block world for tiny builders.**

Tibu is a touch-first 3D block-building game for young children (it is designed
around a 4-year-old). Kids tap to place chunky, friendly blocks on a floating
island, switch to the hammer to smash them with a happy pop, and build their own
little worlds. Along the way they hear colors, shapes, letters, numbers and animal
names, without anyone turning it into a lesson.

It runs in the browser, installs to a tablet's home screen as a PWA, and works
offline. It is free and open source (MIT).

## What makes it different

- **No reading needed.** Every control is a picture. Blocks say their names out loud.
- **No fail states.** Nothing dies, nothing runs out, no timers during play, no
  scores that go down. Celebrations only, never a failure sound.
- **Nothing gets lost.** Every action autosaves. There is a big undo button, and
  nothing a child can reach deletes a world. Deleting lives behind the parent gate.
- **Works offline.** After the first visit the whole app is cached on the device,
  including the voice clips.
- **No tracking.** No accounts, no analytics, no ads, no network calls after load,
  and no external links outside the parent area.
- **Learning on the side.** Naming blocks, counting stacks out loud, spelling short
  words with letter blocks, and optional picture "build cards" to copy.
- **Easy to extend.** Block packs, themes, build cards and spoken lines are plain
  JSON files. You can add content without touching engine code. See
  [CONTRIBUTING.md](CONTRIBUTING.md).

It ships with 8 block packs (Colors, Shapes, Letters, Numbers, Animals, Nature,
Music, Building), 5 starting themes (Meadow, Beach, Farm, Snow, Space), and a set
of build cards.

## How to play (for parents)

Hand over the tablet. That is mostly it, but here is what is on screen:

| Control | What it does |
| --- | --- |
| Tap a surface | Places the selected block there |
| Block and hammer buttons | Switch between building and smashing |
| One-finger drag | Turns the camera around the island |
| Two-finger pinch | Zooms in and out |
| Block tray (bottom) | Pick a block. Swipe for more, tap the pack button for other packs |
| Undo | Steps back through the last 50 actions |
| Home | Flies the camera back to the starting view |
| Camera | Saves a picture of the world to the device |
| Big plus (gallery) | Starts a new world from a theme picture |

**The parent area.** Press and hold the small button in the top corner for
**3 seconds**, then answer a simple sum. Inside you can:

- turn sound, music and voice on or off and set their volume
- choose the voice language
- pick which packs and learning features are enabled
- add custom spelling words (your child's name, for example)
- set an optional play timer, which ends gently: the world dims and the blocks
  "go to sleep"
- manage child profiles (picture-based, no names or logins)
- delete, rename, duplicate, export and import worlds (export a world to a file to
  move it to another device)
- turn on the left-handed layout or reduced motion
- see licenses and a link to the source code

**Tip:** add Tibu to the home screen (Share, then *Add to Home Screen* on iPad, or
*Install app* in Chrome). It then opens full screen, works offline, and the browser
is less likely to clear saved worlds.

## Run it locally

You need [Node.js](https://nodejs.org/) 24 or newer.

```bash
npm ci              # install dependencies
npm run dev         # start the dev server (open the printed URL)
npm test            # unit and schema tests (Vitest)
npm run test:e2e    # browser tests with touch emulation (Playwright)
npm run validate    # check every pack, theme and card against its JSON schema
npm run voice       # regenerate spoken clips from voice/LINES.json
```

Other useful scripts:

```bash
npm run typecheck   # TypeScript, no output files
npm run build       # validate + typecheck + production build into dist/
npm run preview     # serve the production build locally
```

Before the first `npm run test:e2e`, install the browsers once:

```bash
npx playwright install --with-deps chromium webkit
```

`npm run voice` needs [uv](https://docs.astral.sh/uv/) plus `ffmpeg` (or
`afconvert` on macOS). The first run downloads PyTorch and the Kokoro model. You
only need it when you change spoken lines; the clips are committed to the repo.
`npm run voice -- --sync-only` updates `voice/LINES.json` without any Python.

## Deploy it

Tibu is a fully static site. There is no backend, no database and no server code.

### GitHub Pages (included workflow)

`.github/workflows/deploy-pages.yml` builds and deploys to GitHub Pages on every
push to `main` (and on demand from the Actions tab). It is **opt-in**, so a fork
never deploys anything by surprise. To turn it on in your own fork:

1. **Settings → Pages → Build and deployment → Source:** choose **GitHub Actions**.
2. **Settings → Secrets and variables → Actions → Variables → New repository
   variable:** name `DEPLOY_PAGES`, value `true`.
3. Push to `main`, or run **Deploy to GitHub Pages** from the Actions tab.

The site appears at `https://<your-user>.github.io/<your-repo>/`. The workflow sets
`BASE_PATH` to `/<repo-name>/` automatically, so it works whatever you named the
repository. It also points the parent area's "source code" link at your fork.

To stop deploying, delete the variable or set it to anything other than `true`.

### Any static host

```bash
npm ci
npm run build
```

Upload the contents of `dist/` anywhere that serves static files. The default base
path is relative (`./`), so the build works at a domain root or in any subfolder
without changes. Serve it over HTTPS so the service worker (offline mode) can
register.

### Cloudflare Pages, Netlify, Vercel and similar

Connect the repository in your host's dashboard and use:

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Output directory | `dist` |
| Node version | 24 |

No environment variables are required. Two optional ones:

- `BASE_PATH`: set it only if the host needs an absolute base path (for example
  `/tibu/`). Leave it unset otherwise.
- `VITE_REPO_URL`: the `https://` link shown as "source code" in the parent area.
  Point it at your fork if you change things.

There are no redirects or rewrites to configure. Tibu is a single page.

## Privacy

- No accounts, logins or passwords.
- No analytics, tracking, cookies or ads.
- No network requests after the app has loaded. Speech uses committed clips, or the
  device's own speech synthesis if a clip is missing.
- Worlds, profiles and settings are stored only on the device, in the browser's
  IndexedDB. They leave the device only if a parent exports a world to a file.

## Content and assets

All block art and sound effects are generated in code (canvas drawing and the Web
Audio API). The spoken lines are AI-generated with the open source Kokoro-82M
text-to-speech model; there are no human recordings.

Content is plain JSON, so parents can add more without touching code: block packs
in `packs/` (including shaped "parts" such as wheels and roofs for big-kid mode),
themes in `themes/`, build cards in `cards/` (big-kid cards use `"mode": "big"`)
and step-by-step builds in `builds/` (a house, truck, rocket, castle tower and more).
See [CONTRIBUTING.md](CONTRIBUTING.md). Sources and licenses for
everything are listed in [ASSETS.md](ASSETS.md).

## Contributing

New block packs, themes, build cards, languages and translations are very welcome,
and none of them require engine changes. Start with
[CONTRIBUTING.md](CONTRIBUTING.md). Please also read the
[Code of Conduct](CODE_OF_CONDUCT.md). To report a security problem, see
[SECURITY.md](SECURITY.md).

## License

- Code: [MIT](LICENSE).
- Generated art, sounds and voice clips: see [ASSETS.md](ASSETS.md).

## Trademark note

Tibu is not affiliated with, endorsed by, or connected to Minecraft, Mojang, or
Microsoft. It uses no Minecraft assets, names, textures or sounds.
