# Chrome tab and bookmark opener

An Alfred workflow that searches open Chrome tabs and bookmarks together,
and jumps to (or opens) the selected one.

- Open tabs are read live via Chrome's JXA dictionary.
- Bookmarks are read from Chrome's `Bookmarks` JSON file and cached with a
  stale-while-revalidate strategy (see [Caching strategy](#caching-strategy)).
- If a URL is both an open tab and a bookmark, the open tab takes priority
  (selecting it focuses the existing tab instead of opening a duplicate).

## Usage

1. Invoke Alfred with the keyword `to` followed by your search term.
2. Results show both tabs (🔵) and bookmarks (🔖), matched against title and URL.
3. Select a result:
   - **Tab** → the corresponding Chrome window/tab is brought to the front.
   - **Bookmark** → opens in the frontmost Chrome window as a new tab.

## Requirements

- macOS with Google Chrome installed.
- Chrome must allow JavaScript from Apple Events (`Chrome > View > Developer
  > Allow JavaScript from Apple Events`), or macOS will show a one-time
  permission prompt when the workflow first controls Chrome via JXA.
- Node.js is **not** required at runtime — everything runs via `osascript
  -l JavaScript` against a single bundled JS file per action. Node is only
  needed for development (building from TypeScript).

## Configuration

Set via the workflow's configuration sheet (or `chrome_profile` workflow variable):

| Variable         | Default   | Description                                                                 |
|------------------|-----------|-------------------------------------------------------------------------------|
| `chrome_profile` | `Default` | Chrome profile directory name under `~/Library/Application Support/Google/Chrome/`. Use `Profile 1`, `Profile 2`, etc. for non-default profiles. |

## Caching strategy

Parsing the full `Bookmarks` file on every keystroke doesn't scale well once
bookmark counts grow, but bookmarks only change on explicit user action, so a
stale-while-revalidate (SWR) cache is used:

1. Every invocation reads the cached bookmark list from
   `~/Library/Caches/com.alfred.chrome-tab-and-bookmark-opener/bookmarks.json`
   and returns it immediately (no blocking parse).
2. Staleness is determined by **either**:
   - TTL of 15 minutes since the cache was last written, **or**
   - the `Bookmarks` file's mtime being newer than the cache's `fetchedAt`
     timestamp (checked cheaply via `stat -f %m` on every call).
3. If stale, a detached background process (`nohup ... &`) re-parses the
   bookmarks file and atomically replaces the cache (write to `.tmp` +
   `mv`), so the *next* invocation sees fresh data. The current invocation
   never waits on this.
4. On the very first run ever (no cache file exists), the list is fetched
   synchronously once to prime the cache.

This means bookmark changes are reflected within one keystroke after the
`Bookmarks` file's mtime changes (not up to 15 minutes later), while the
15-minute TTL exists purely as a fallback in case mtime-based detection is
ever bypassed (e.g. an atomic file replace tool that doesn't update mtime
as expected).

Open tabs are **not** cached — they're read live on every invocation, since
their state changes far more frequently and the read itself is cheap.

## Development

```bash
npm install
npm run build      # compiles src/*.ts -> workflow/{main,open,revalidate}.js via esbuild
npm run watch       # rebuild on change
npm run typecheck   # tsc --noEmit only
npm run package      # build + zip workflow/ into dist/*.alfredworkflow
```

### Architecture

TypeScript source is bundled by esbuild into three standalone IIFE scripts
(JXA has no module system and Alfred runs each script as an independent
process):

| Source                       | Output                | Alfred object       | Purpose                                  |
|-------------------------------|------------------------|----------------------|-------------------------------------------|
| `src/index.ts`                | `workflow/main.js`     | Script Filter         | Search tabs + cached bookmarks, output results |
| `src/index-open.ts`           | `workflow/open.js`     | Run Script action      | Focus the selected tab, or open the bookmark |
| `src/index-revalidate.ts`     | `workflow/revalidate.js` | *(not in Alfred graph, invoked directly)* | Re-parse bookmarks in the background |

`esbuild`'s `platform: 'neutral'` is used intentionally (not `'node'`): it
makes any accidental `import` of a Node built-in (`fs`, `path`,
`child_process`, ...) fail at **build time**, since none of those APIs exist
under `osascript -l JavaScript` at runtime.

### Live-editing inside Alfred

`workflow/` is what Alfred actually loads. To edit `info.plist` directly
from Alfred's workflow editor while keeping it under version control,
symlink your Alfred workflow slot to this repo's `workflow/` directory:

```bash
ln -s "$(pwd)/workflow" \
  ~/Library/Application\ Support/Alfred/Alfred.alfredpreferences/workflows/user.workflow.<uuid>
```

(Find `<uuid>` by importing the packaged `.alfredworkflow` once via double-click,
then locating the resulting folder.)

## Known limitations

- Only the profile named by `chrome_profile` is searched; multi-profile
  search across several profiles at once is not supported.
- Chrome must be running for tab search to return results; if it isn't
  running, only bookmarks are shown.
- Very large bookmark trees (tens of thousands of entries) will still incur
  a one-time synchronous parse cost on the first-ever run before the cache
  is primed.

## License

MIT — see [LICENSE](LICENSE).

Icon assets (`workflow/icon.png`, `workflow/icons/*.png`) are derived from
[Tabler Icons](https://tabler.io/icons) (MIT License) — see
[workflow/NOTICE.md](workflow/NOTICE.md) for the full copyright and license
notice, which is also bundled into the packaged `.alfredworkflow`.
