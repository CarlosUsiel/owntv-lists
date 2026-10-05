# OwnTV public lists

The lists OwnTV can read from one configurable web address instead of from a new app release: the media
sources of Music, Manga, Audiobooks and Books, a list of suggested plugin repositories and add-on
catalogues, and a public, signed copy of the OwnTV provider pack.

**Status: published (2026-10-05) by the owner's decision.** The app's public list address points here; it uses the copy of these lists that is built into it When the address is
set but unreachable (offline, GitHub down), the app falls back to that built-in copy too, so a list is a
convenience, never a dependency.

## Files

| File | Format | Read by |
|------|--------|---------|
| `music-sources.json` | `owntv-media-sources` v1 (shared list format) plus the Music lane's own keys (`schema`, `name`, `description`, `updated`, `follows`) | Music, Settings, Sources, Update list (the lane reader) and the shared `MediaSourceJson.import` |
| `manga.json` | `owntv-media-sources` v1, `mediaType` `manga` | Manga, Sources (import and update) |
| `audiobooks.json` | `owntv-media-sources` v1, `mediaType` `audiobooks` | Audiobooks, Sources |
| `books.json` | `owntv-media-sources` v1, `mediaType` `books` | Books, Sources |
| `suggested-repositories.json` | `owntv-suggested-repositories` v1 | Plugins, Add repository, "Suggested" |
| `providers/` | a Nuvio provider repository: `manifest.json` and `providers/<id>.js`, plus `signature.json` once signed | Plugins, repository `@providers` (the entry `owntv-pack` of the suggested list) |
| `tools/` | Python 3 scripts, no packages | the maintainer |

The app reads these files from **Settings -> Sources -> Repository addresses -> Public list address**
(a folder address such as `https://raw.githubusercontent.com/<owner>/<repo>/main`; empty by default). A list
that cannot be read falls back to its last saved copy, then to the copy built into the app
(`tools/sync_public_lists.py` in the core repository copies these five files into the app). The source
lists add only sources the app does not have yet (never changing what is there, never re-adding one the
person removed); the suggested list fills "Suggested repositories" on the same page. Music's list is read
by Music -> Sources -> Update list.

### The shared source lists

`manga.json`, `audiobooks.json` and `books.json` are what `MediaSourceJson.export(mediaType, sources)`
writes for the built-in sources of each media type: `format`, `version`, `mediaType`, then `sources[]`
with `id`, `name`, `adapter`, `baseUrls` (mirrors in order of preference), `enabled`, `status`
(`WORKS`, `FLAKY`, `DEAD` or `UNKNOWN`: the enum name), `builtIn` and, where the app has one, `notes`.
Like the app's own export they carry no API key and no header that names a credential. Statuses are the
ones found on 2026-10-04 from the development PC; the app's Test button re-checks them on the device.

`music-sources.json` is the list the Music lane already reads, with `format`, `version` and `mediaType`
added at the top so the shared importer reads it as well. Its `status` values are lower case (`works`,
`flaky`, `dead`), as the Music lane writes them. The shared importer matches the enum name exactly, so
through that path they become `UNKNOWN` until the lane's reader or the Test button sets them.

### `suggested-repositories.json`

```json
{"format": "owntv-suggested-repositories", "version": 1, "updated": "YYYY-MM-DD",
 "repositories": [{"id": "<slug>", "name": "...", "kind": "nuvio|kino|cloudstream|addon",
                   "address": "...", "description": "...", "adult": false}]}
```

`address` is what a person would paste into the app: `owner/repo` for a Nuvio, Kino or CloudStream
repository, a manifest URL for an add-on catalogue. The special address `@providers` means "the
`providers/` folder of this same list repository"; the app resolves `@<folder>` against the configured
public list address. Entries with `"adult": true` are hidden on Kids profiles (none is adult at the
moment). Every address comes from the app's own code and data (the free-and-legal Kino plugins, the
discovery snapshot, the Stremio collection sources, the repositories the provider pack was built from);
none is invented. They were found to exist on GitHub on 2026-10-05; that is not a promise that a
third-party repository keeps working.

### `providers/`: the public copy of the provider pack

The private pack repository (`owntv-provider-pack`) is the master. The public copy is made from it by:

```
python tools/make_public_pack.py [SOURCE_PACK_DIR] [TARGET_DIR]     # defaults: ../owntv-provider-pack  providers/
```

It copies `manifest.json` and every file the manifest names, byte for byte, with one change: third-party
TMDB API keys are emptied. A key is a 32-hex literal with TMDB or `api_key` words next to it, or equal to
such a key found anywhere in the pack (minified providers keep it in an unnamed variable). Only the hex
value goes; quotes and `api_key=` stay, so the code still parses. The host app removes any `api_key` from
a plugin's requests to `api.themoviedb.org` and adds its own, so an empty key is harmless at runtime. The
tool prints what it stripped as `file:line` with the first four characters of the key, runs `node --check`
on every changed file, and exits non-zero if a TMDB-context 32-hex literal remains.

Layout: `providers/manifest.json` names its files as `providers/<id>.js`, so the files are at
`providers/providers/<id>.js` in this repository, exactly as in the pack repository.

**Signing.** The pack is signed with Ed25519: `signature.json` holds the manifest and the SHA-256 of every
file the pack ships. The signer is `tools/sign_pack.py` of the private pack repository; the private key is
kept OUTSIDE every repository, at `C:\Users\AsusG14\.owntv-keys\pack-signing.key`. The app carries the
public key and refuses a pack whose files no longer match. Sign the public copy after every run of
`make_public_pack.py`:

```
python ../owntv-provider-pack/tools/sign_pack.py sign   --root providers
python ../owntv-provider-pack/tools/sign_pack.py verify --root providers
```

`signature.json` is in the repository (signed 2026-10-05); sign again after every change to `providers/`.

## Tools

| Tool | What it does |
|------|--------------|
| `tools/make_public_pack.py` | makes `providers/` from the private pack (see above) |
| `tools/check_lists.py` | validates every JSON file: parses, required keys, ids unique per file, adapters the app knows, http(s) addresses without a login, valid statuses, no API-key-like field or credential header; searches every file for the TMDB keys found in the private pack and for the maintainer's own key (by its SHA-256, or the `OWNTV_TMDB_KEY` environment variable) |
| `tools/scan_secrets.py` | generic scan: long hex strings next to key words, `Bearer` tokens, `token=`, passwords, `Authorization:`, private IPs, e-mail addresses; prints `file:line` with the value masked; `tools/scan_allowlist.txt` lists known third-party constants by hash |

Run all three before every commit. None of them contains a key.

## No secrets policy

* No TMDB key of the maintainer, and no API key, token, password or credential header of any kind, in any
  file of this repository. The shared list format cannot carry one by design.
* Third-party TMDB keys that provider authors left in their code are stripped from `providers/`.
* Other long constants that third-party providers ship (stream-cipher keys, a site cookie, one `Bearer`
  token in `xdownloader.js`) are listed in `tools/scan_allowlist.txt` by hash; the owner decides whether
  they stay (see below).
* Before a commit: `git grep --cached -c "<the maintainer's key>"` must find nothing (exit code 1).

## How to publish (not done)

Publishing needs the owner's approval for each public repository, and the repositories are private until
then.

1. Decide the licence question below and the `xdownloader.js` token, and whether the two adult providers
   stay in the public copy.
2. `python tools/make_public_pack.py`, sign `providers/`, then `python tools/check_lists.py` and
   `python tools/scan_secrets.py`.
3. With approval: create the repository, push `main`, and put its raw address (for example
   `https://raw.githubusercontent.com/<owner>/<repo>/main/`) into the app's public list setting.
4. Whenever a built-in source list or the pack changes, regenerate, re-sign, re-check, commit.

## Licence

This folder is released under **GPL-3.0** (`LICENSE`, the standard text). The provider pack contains
code ported from GPL-3.0 projects (lolapp, PlayTorrio) and files copied from public Nuvio repositories; the
original headers and the `// copied from <repo>@<commit>` line are kept in each file. Some of those
repositories state no licence (frankrsilva/nuvio-repository, A2R14N/nuvio-providers, ktsevents/nuvio,
ahmedelkassrawy/nuvio-providers, latinokodi/latinuvio-V2, municipalidad1998/nuvio-providers): their files
remain their authors' work, and GPL-3.0 here covers only what OwnTV wrote. The pack repository's own README
says the pack stays private because of this; publishing `providers/` is the owner's call.


## Owner decisions (2026-10-05)
- Publish every provider, including the two adult providers.
- `xdownloader.js` is left out of this public copy (it carries a third-party token); it stays in the owner's private pack.
- Third-party TMDB keys are stripped from this copy.
