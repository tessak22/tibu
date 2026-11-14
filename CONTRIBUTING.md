# Contributing to Tibu

Thanks for helping! Tibu is built so that parents, teachers and other friendly
people can add content **without touching engine code**. Block packs, themes,
build cards and spoken lines are plain JSON files that are checked against JSON
schemas at build time.

- [Ground rules for content](#ground-rules-for-content)
- [Setup](#setup)
- [Add a block pack](#add-a-block-pack)
- [Add a theme](#add-a-theme)
- [Add a build card](#add-a-build-card)
- [Add spoken lines for new blocks](#add-spoken-lines-for-new-blocks)
- [Add a voice language](#add-a-voice-language)
- [How validation works](#how-validation-works)
- [Tests](#tests)
- [Pull request checklist](#pull-request-checklist)

## Ground rules for content

Tibu is for children around four years old. Everything in the repo follows these
rules:

1. **Generated or CC0 only.** Art should be generated in code, or be your own work
   released under MIT, or be CC0. Sounds work the same way. Do not add anything
   with an attribution, share-alike or non-commercial license, and nothing you are
   unsure about.
2. **Record every non-generated file in [ASSETS.md](ASSETS.md)**, with its source
   and license. That includes images, audio files and voice clips.
3. **Nothing Minecraft-like.** No Minecraft (or other game) names, textures, sounds,
   characters or look-alike art. Tibu's look is soft, rounded and its own.
4. **Nothing scary.** No monsters, weapons, fire, scary faces, loud or harsh sounds,
   or anything that could upset a small child. Animals are friendly.
5. **No reading required.** Names are spoken, not shown. Keep them short and simple
   ("cow", "red", "window").
6. **No fail states, no network.** Content cannot add timers, scores, links or
   anything that loads from the internet.

## Setup

You need Node.js 24 or newer.

```bash
npm ci
npm run dev        # play with your changes at the printed URL
npm run validate   # check your JSON
```

Each JSON file starts with a `$schema` line, so editors like VS Code give you
autocomplete and inline errors while you type.

## Add a block pack

A pack is a folder in `packs/`. Dropping in a new folder is enough: it is picked up
automatically and shows in the pack picker.

```
packs/
  party/
    pack.json
    icons/      (optional: images, only if you use "image" art)
    audio/      (optional: sound files, only if you use "file" sounds)
```

### 1. Create `packs/<id>/pack.json`

The `id` must match the folder name and use lowercase letters, digits and dashes.
Here is a complete, valid example:

```json
{
  "$schema": "../../schemas/pack.schema.json",
  "id": "party",
  "name": "Party",
  "order": 9,
  "icon": { "block": "balloon" },
  "tileColor": "#ffe3ef",
  "blocks": [
    {
      "id": "balloon",
      "name": "balloon",
      "art": { "color": "#ff6f91", "mark": "oval", "markColor": "#ffe0ea", "markSize": 0.6 },
      "sound": { "synth": "pop" },
      "behaviors": ["speak", "sound", "bounce"]
    },
    {
      "id": "present",
      "name": "present",
      "art": { "pattern": "stripes", "color": "#7e8cf5", "accent": "#fff3a8" },
      "faces": {
        "top": { "color": "#7e8cf5", "mark": "cross", "markColor": "#fff3a8" }
      },
      "behaviors": ["speak"]
    },
    {
      "id": "party-light",
      "name": "party light",
      "art": { "pattern": "lamp", "color": "#ffe27a", "accent": "#fff6c8" },
      "sound": { "synth": "ding" },
      "behaviors": ["speak", "sound", "glow"],
      "glowColor": "#ffd75e"
    },
    {
      "id": "bell",
      "name": "bell",
      "art": { "pattern": "note", "color": "#4fc3f7", "params": { "label": "C" } },
      "sound": { "synth": "note", "note": 72 },
      "behaviors": ["sound", "bounce"]
    }
  ]
}
```

| Field | Required | Notes |
| --- | --- | --- |
| `id` | yes | Matches the folder name |
| `name` | yes | Spoken when the pack is chosen |
| `blocks` | yes | 1 to 64 blocks |
| `order` | no | Position in the pack picker, lower first. Shipped packs use 1 to 8 |
| `icon` | no | `{ "block": "<block id>" }`, or any face art (see below) |
| `tileColor` | no | Background color of the pack picker tile |
| `description` | no | For humans reading the file. Not shown to children |

Each block has:

| Field | Required | Notes |
| --- | --- | --- |
| `id` | yes | Unique within the pack. Other files refer to it as `<pack>:<block>`, e.g. `party:balloon` |
| `name` | yes | The spoken name. Keep it short and lowercase unless it is a letter |
| `art` | yes | Art used on every face |
| `faces` | no | Overrides for `top`, `side` (all four sides) and `bottom` |
| `sound` | no | Played on tap. Needs the `sound` behavior |
| `behaviors` | no | Any of `speak`, `sound`, `bounce`, `glow` |
| `glowColor` | no | Light color. Needs the `glow` behavior |

### 2. Choose the art

Each face uses one of three kinds of art. All colors are `#rgb` or `#rrggbb`.

**A solid color, with an optional mark.** Marks help children who cannot tell
colors apart, so color blocks should have one.

```json
{ "color": "#ef5350", "mark": "heart", "markColor": "#ffffff", "markSize": 0.5 }
```

Marks: `circle`, `square`, `rectangle`, `triangle`, `star`, `heart`, `diamond`,
`oval`, `moon`, `hexagon`, `pentagon`, `cross`, `cloud`, `drop`, `flower`, `ring`.
`markSize` ranges from 0.2 to 0.9.

**A generated pattern**, with an optional base `color`, `accent` color and
`params`:

```json
{ "pattern": "bricks", "color": "#e0775a", "accent": "#f6e6d6" }
```

| Group | Patterns |
| --- | --- |
| Basic | `dots`, `stripes`, `checker`, `noise`, `spots`, `fluffy` |
| Nature | `grass`, `dirt`, `sand`, `water-waves`, `wood-grain`, `wood-rings`, `leaves`, `flowers`, `stone`, `snow`, `ice`, `craters`, `hay` |
| Building | `bricks`, `planks`, `window`, `door`, `roof`, `glass`, `lamp`, `star-shape` |
| Needs `params` | `glyph` (`{"text": "A"}`, 1 to 3 characters), `dots-count` (`{"count": 3}`, 0 to 10), `note` (`{"label": "C"}`, 1 or 2 characters), `animal-face` (`{"animal": "cow"}`) |

Animals for `animal-face`: `cow`, `pig`, `sheep`, `horse`, `chicken`, `duck`, `cat`,
`dog`, `bird`, `frog`, `mouse`, `bunny`.

Look at the shipped packs in `packs/` for many more combinations.

**An image** in the pack's `icons/` folder (PNG, JPG, WebP or SVG). Faces are drawn
at 128 x 128 pixels, so a square 128 x 128 image looks best.

```json
{ "image": "icons/kite.png" }
```

Prefer generated art. If you do add an image, it must be your own work or CC0, and
it needs a row in [ASSETS.md](ASSETS.md).

### 3. Add sounds (optional)

A tap sound is either a built-in synthesized preset:

```json
{ "synth": "moo" }
{ "synth": "note", "note": 64 }
```

Presets: `moo`, `baa`, `oink`, `neigh`, `cluck`, `quack`, `meow`, `woof`, `tweet`,
`ribbit`, `squeak`, `note`, `chime`, `pop`, `splash`, `rustle`, `knock`, `ding`.
`note` needs a MIDI note number from 21 to 108 (60 is middle C).

Or a short, soft audio file in the pack's `audio/` folder (mp3, ogg, wav, m4a or
webm), listed in ASSETS.md:

```json
{ "file": "audio/whistle.ogg" }
```

The presets are synthesized with the Web Audio API and need no files, so prefer
them.

### 4. Pick behaviors

| Behavior | What it does |
| --- | --- |
| `speak` | Says the block's name when it is placed |
| `sound` | Plays the block's `sound` when it is tapped |
| `bounce` | Does a small hop when tapped |
| `glow` | Gives off a soft light (`glowColor`, or the art color) |

### 5. Check it

```bash
npm run validate
npm run dev
```

Then add its spoken lines (see [below](#add-spoken-lines-for-new-blocks)).

## Add a theme

A theme sets the sky, island shape, ground layers and a small starting scene for
new worlds. It is a folder in `themes/` with a `theme.json`. The `id` must match the
folder name.

The world is 24 x 16 x 24 cells (x and z go from 0 to 23, y from 0 to 15). The
ground fills layers `y = 0` up to `ground.length - 1`, with the first entry on top,
so with two ground layers the scene starts at `y = 2`. Scene cells must stay within
10 cells of the island center (about x 11.5, z 11.5).

`themes/garden/theme.json`:

```json
{
  "$schema": "../../schemas/theme.schema.json",
  "id": "garden",
  "name": "Garden",
  "order": 6,
  "sky": { "top": "#7cc8ff", "bottom": "#fff1d6" },
  "island": { "shape": "blob", "depth": 3 },
  "ground": ["nature:grass", "nature:dirt"],
  "cloudColor": "#ffffff",
  "scene": [
    { "from": [8, 2, 8], "to": [8, 4, 8], "block": "nature:wood" },
    { "from": [7, 5, 7], "to": [9, 5, 9], "block": "nature:leaves" },
    { "x": 14, "y": 2, "z": 12, "block": "nature:flowers" },
    { "x": 15, "y": 2, "z": 12, "block": "nature:flowers" },
    { "x": 12, "y": 2, "z": 15, "block": "animals:bunny" }
  ]
}
```

| Field | Required | Notes |
| --- | --- | --- |
| `id`, `name` | yes | `name` is spoken in the theme picker |
| `sky` | yes | `top` and `bottom` gradient colors, plus `"stars": true` for a starry sky |
| `island` | yes | `shape`: `round`, `square` or `blob`. `depth`: 1 to 8 |
| `ground` | yes | 1 to 4 block keys, top layer first |
| `scene` | yes | Up to 300 entries (may be empty) |
| `cloudColor` | no | Cloud tint |
| `order` | no | Position in the theme picker. Shipped themes use 1 to 5 |
| `icon` | no | A picture file in the theme folder. A picture is generated when omitted |

A scene entry is either one cell, `{ "x", "y", "z", "block" }`, or an inclusive box,
`{ "from": [x, y, z], "to": [x, y, z], "block" }`. One box may cover at most 400
cells. Keep starting scenes small and leave room to build.

Blocks are referenced as `<pack id>:<block id>`, so a theme can use blocks from any
pack, including a new one.

## Add a build card

A build card is a picture of something simple to build. When a child builds a
matching shape anywhere in the world, Tibu celebrates. Ignoring a card has no
consequence.

Cards are single files: `cards/<id>.json`, where `id` matches the file name.
Coordinates are relative to the card's own corner (0 to 7 on each axis, with y going
up). Matching ignores where the build is in the world and allows 90 degree turns.

`cards/party-stack.json`:

```json
{
  "$schema": "../schemas/card.schema.json",
  "id": "party-stack",
  "name": "party stack",
  "order": 12,
  "blocks": [
    { "from": [0, 0, 0], "to": [1, 0, 0], "block": "party:present" },
    { "x": 0, "y": 1, "z": 0, "block": "party:balloon" },
    { "x": 1, "y": 1, "z": 0, "block": "party:balloon" }
  ]
}
```

- `blocks` has 1 to 40 entries, using the same cell and box format as themes.
- `name` is spoken when the card is shown.
- Keep cards small enough for a four-year-old: 2 to 10 blocks is a good range.

## Add spoken lines for new blocks

Every spoken line lives in [`voice/LINES.json`](voice/LINES.json):

```json
{
  "languages": { "en": { "name": "English", "speechLang": "en-US",
                         "kokoro": { "langCode": "a", "voice": "af_heart", "speed": 0.9 } } },
  "lines": {
    "block.party.balloon": { "en": "balloon" }
  }
}
```

Line ids follow fixed patterns: `block.<pack>.<block>`, `pack.<pack>`,
`theme.<theme>`, `card.<card>` and `word.<word>`, plus app phrases such as
`hello`, `celebrate.1` and `count.3`. Clips live at `voice/<lang>/<lineId>.m4a`.

After adding a pack, theme or card:

```bash
npm run voice -- --sync-only   # adds missing lines from the content names. No Python needed.
npm run voice                  # renders the new clips with Kokoro (optional, see below)
```

`--sync-only` never removes or rewrites existing lines. It adds an English line for
each new pack, block, theme and card, using its `name`. Edit the text afterwards
if you want different wording.

Rendering clips needs [uv](https://docs.astral.sh/uv/) and `ffmpeg` (or `afconvert`
on macOS). The first run sets up a Python environment in `scripts/voice/.venv` and
downloads the Kokoro-82M model. Only new or changed lines are rendered. Commit the
new `.m4a` files and the updated `voice/<lang>/manifest.json`.

**If you cannot run the voice script, that is fine.** Commit the `LINES.json`
changes without clips. When a clip is missing, Tibu falls back to the device's
built-in speech synthesis, and a maintainer can render the clips later.

Other flags: `npm run voice -- --force` regenerates every clip, and
`npm run voice -- --lang en` limits rendering to one language.

## Add a voice language

1. **Add the language** under `languages` in `voice/LINES.json`. The key (here
   `es`) becomes the folder name `voice/es/`. `speechLang` is the BCP-47 tag used
   for the browser speech fallback. `name` is shown in the parent area's language
   picker, so write it in its own language.

   ```json
   "es": {
     "name": "Español",
     "speechLang": "es-ES",
     "kokoro": { "langCode": "e", "voice": "ef_dora", "speed": 0.9 }
   }
   ```

2. **Pick a Kokoro language code and voice.** Kokoro-82M uses one-letter language
   codes:

   | `langCode` | Language | Example voices |
   | --- | --- | --- |
   | `a` | American English | `af_heart`, `af_bella` |
   | `b` | British English | `bf_emma`, `bm_george` |
   | `e` | Spanish | `ef_dora`, `em_alex` |
   | `f` | French | `ff_siwis` |
   | `h` | Hindi | `hf_alpha`, `hm_omega` |
   | `i` | Italian | `if_sara`, `im_nicola` |
   | `j` | Japanese | `jf_alpha` |
   | `p` | Brazilian Portuguese | `pf_dora`, `pm_alex` |
   | `z` | Mandarin Chinese | `zf_xiaobei` |

   See the [Kokoro-82M voice list](https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md)
   for all voices. Pick a warm, calm voice.
   Spanish, French, Hindi, Italian and Portuguese use espeak-ng, which is already
   installed. Japanese and Chinese need extra packages (`misaki[ja]` or
   `misaki[zh]`): add them to `scripts/voice/requirements.in`, then regenerate the
   pinned file with
   `uv pip compile scripts/voice/requirements.in -o scripts/voice/requirements.txt`.

3. **Translate the lines.** Add your language's text next to `en` in each entry:

   ```json
   "hello": { "en": "Hi there! Let's build!", "es": "¡Hola! ¡A construir!" },
   "block.colors.red": { "en": "red", "es": "rojo" }
   ```

   You do not have to translate everything at once. Any line without text in the
   chosen language is spoken in English instead.

4. **Render the clips:**

   ```bash
   npm run voice -- --lang es
   ```

5. **Check it** in `npm run dev`: open the parent area, pick the language, and
   place some blocks.

6. **Record it in ASSETS.md**: add the voice name and language to the Voice section.

**Speech fallback.** If a clip is missing, Tibu speaks the line's text with the
browser's own speech synthesis in `speechLang`. If the line has no text in that
language, it plays the English clip (or speaks the English text). A language that
only has translations in `LINES.json`, with no clips yet, still works. It just
sounds like the device's voice, and the quality varies by device.

Note: spelling words (the `word.*` lines) are built-in English words. Their
translations are what Tibu says when a child spells that English word.

## How validation works

`npm run validate` (also part of `npm run build` and of CI) checks:

- **Schemas.** Each `pack.json`, `theme.json` and card file is checked against
  [`schemas/pack.schema.json`](schemas/pack.schema.json),
  [`schemas/theme.schema.json`](schemas/theme.schema.json) and
  [`schemas/card.schema.json`](schemas/card.schema.json). Unknown fields are errors,
  which catches typos.
- **Ids.** A pack or theme id must match its folder name and a card id its file
  name. Ids and block ids within a pack must be unique.
- **References.** Every `<pack>:<block>` key in themes and cards must exist, and a
  pack's `icon.block` must be one of its blocks.
- **Files.** Every `image` and sound `file` must exist and stay inside its own pack
  or theme folder.
- **Behaviors.** The `sound` behavior needs a `sound`, and `glowColor` needs the
  `glow` behavior.
- **Scenes.** Theme scene cells must be above the ground, below the world's top
  (y 15) and within 10 cells of the island center. One box may cover at most 400
  cells.

Errors are listed per file:

```
Content validation failed with 1 problem(s):

  cards/party-stack.json
    - card uses unknown block "party:ballon"
```

## Tests

```bash
npm run validate    # content only, fast
npm run typecheck   # TypeScript
npm test            # unit tests, including schema tests for every shipped pack, theme and card
npm run test:e2e    # browser tests with touch emulation (WebKit iPad and Chromium tablet)
```

Install the browsers once before the first e2e run:

```bash
npx playwright install --with-deps chromium webkit
```

Content-only changes usually only need `npm run validate` and `npm test`. CI runs
everything on every pull request.

If you do change engine code, follow the existing style (small modules, pure
functions where possible) and add unit tests for new behavior.

## Pull request checklist

- [ ] `npm run validate`, `npm run typecheck` and `npm test` pass
- [ ] I tried the change in `npm run dev` on a touch device or with touch emulation
- [ ] Art and sounds are generated in code, or my own work, or CC0
- [ ] Every non-generated file has a row in ASSETS.md
- [ ] Nothing Minecraft-like and nothing scary
- [ ] New packs, themes and cards have lines in `voice/LINES.json` (`npm run voice -- --sync-only`)
- [ ] Voice clips, if any, were rendered with `npm run voice` and committed with their manifest
- [ ] Nothing needs reading, adds a fail state, or makes a network request

By contributing, you agree that your contribution is licensed under the
[MIT License](LICENSE), and that any assets you add are your own work or CC0.
Please follow the [Code of Conduct](CODE_OF_CONDUCT.md).
