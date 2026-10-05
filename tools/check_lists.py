#!/usr/bin/env python3
"""Validates the list files of this repository. Exit code 1 on any problem.

    python tools/check_lists.py [--pack ../owntv-provider-pack]

Checks
  * manga.json, audiobooks.json, books.json, music-sources.json: parse; `format`, `version`, `mediaType`
    and `sources` present (format "owntv-media-sources", version 1, mediaType matching the file); every
    source has id (letters, digits, - _, at most 64), name, adapter, baseUrls (1..10 http(s) addresses
    without a login or fragment); ids unique; status one of WORKS / FLAKY / DEAD / UNKNOWN (music-sources
    may use the lower case the Music lane writes); no API-key-like field and no credential header;
  * suggested-repositories.json: parse; format / version / updated; ids unique; kind one of nuvio, kino,
    cloudstream, addon; address present (http(s) URL, owner/repo, or @folder, and only for the pack entry);
    `adult` a boolean;
  * providers/manifest.json: parse, every named file exists, ids unique;
  * every file of the repository is searched for the 32-hex strings that are TMDB keys: those found in a
    TMDB context in the private pack (--pack, when it is there), the OWNTV_TMDB_KEY environment variable,
    and the maintainer's own key by its SHA-256. A 32-hex literal in a TMDB context anywhere in the
    repository is a problem too.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from urllib.parse import urlsplit

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _hexscan import HEX32, is_user_key, mask, tmdb_hits  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATUSES = {"WORKS", "FLAKY", "DEAD", "UNKNOWN"}
MEDIA_FILES = {
    "manga.json": "manga",
    "audiobooks.json": "audiobooks",
    "books.json": "books",
    "music-sources.json": "music",
}
# Adapters the app knows per media type (core: MangaAdapters, AudiobookAdapters, BookAdapterIds, MusicSourceDefaults).
ADAPTERS = {
    "manga": {"MangaDex-API", "WeebCentral-site", "MangaPill-site", "MangaKatana-site", "Kakalot-site", "Comick-API"},
    "audiobooks": {
        "librivox-api", "internet-archive", "wordpress-author-first", "wordpress-title-by-author", "wordpress-plain",
        "wordpress-listen-page", "wordpress-encrypted", "audioaz-site", "audiobookbay-torrent", "audionest-api",
    },
    "books": {"gutenberg", "gutendex", "opds", "openlibrary", "bookracy", "libgen", "annas-archive"},
    "music": {"Qobuz-proxy", "Tidal-HiFi"},
}
VALID_ID = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
SECRET_NAME = re.compile(r"api[_-]?key|apikey|secret|token|password|passwd|authorization|auth|cookie|bearer|credential", re.I)
REPO_SHORT = re.compile(r"^[A-Za-z0-9][A-Za-z0-9-]{0,38}/[A-Za-z0-9._-]{1,100}$")
KINDS = {"nuvio", "kino", "cloudstream", "addon"}

problems: list[str] = []


def bad(file: str, message: str) -> None:
    problems.append(f"{file}: {message}")


def load(name: str):
    path = os.path.join(ROOT, name)
    if not os.path.isfile(path):
        bad(name, "missing")
        return None
    try:
        with open(path, "rb") as f:
            return json.loads(f.read().decode("utf-8"))
    except (ValueError, UnicodeDecodeError) as e:
        bad(name, f"does not parse: {e}")
        return None


def http_url(value: object) -> bool:
    if not isinstance(value, str) or not value or any(c.isspace() for c in value):
        return False
    u = urlsplit(value.replace("{searchTerms}", "x"))
    return u.scheme in ("http", "https") and bool(u.hostname) and not u.username and not u.password and not u.fragment


def walk_keys(node, path=""):
    if isinstance(node, dict):
        for k, v in node.items():
            yield f"{path}/{k}", k, v
            yield from walk_keys(v, f"{path}/{k}")
    elif isinstance(node, list):
        for i, v in enumerate(node):
            yield from walk_keys(v, f"{path}[{i}]")


def check_media(name: str, media_type: str) -> None:
    d = load(name)
    if d is None:
        return
    if not isinstance(d, dict):
        bad(name, "top level is not an object")
        return
    for key, expect in (("format", "owntv-media-sources"), ("version", 1), ("mediaType", media_type)):
        if d.get(key) != expect:
            bad(name, f'"{key}" is {d.get(key)!r}, expected {expect!r}')
    sources = d.get("sources")
    if not isinstance(sources, list) or not sources:
        bad(name, '"sources" is missing or empty')
        return
    ids: set[str] = set()
    for i, s in enumerate(sources):
        where = f"sources[{i}]"
        if not isinstance(s, dict):
            bad(name, f"{where} is not an object")
            continue
        sid = s.get("id")
        if not isinstance(sid, str) or not VALID_ID.match(sid):
            bad(name, f"{where} has an invalid id {sid!r}")
        elif sid in ids:
            bad(name, f"duplicate id {sid!r}")
        else:
            ids.add(sid)
        where = f"source {sid!r}"
        for key in ("name", "adapter"):
            if not isinstance(s.get(key), str) or not s[key].strip():
                bad(name, f"{where}: {key} missing")
        if isinstance(s.get("name"), str) and len(s["name"]) > 60:
            bad(name, f"{where}: name longer than 60")
        if isinstance(s.get("adapter"), str) and s["adapter"] not in ADAPTERS[media_type]:
            bad(name, f"{where}: adapter {s['adapter']!r} is not one the app knows for {media_type}")
        urls = s.get("baseUrls")
        if not isinstance(urls, list) or not 1 <= len(urls) <= 10:
            bad(name, f"{where}: baseUrls must hold 1 to 10 addresses")
        else:
            for u in urls:
                if not http_url(u):
                    bad(name, f"{where}: not an http(s) address without login or fragment: {u!r}")
        status = s.get("status")
        if status is not None:
            ok = isinstance(status, str) and (status in STATUSES or (name == "music-sources.json" and status.upper() in STATUSES))
            if not ok:
                bad(name, f"{where}: status {status!r} is not one of {sorted(STATUSES)}")
        if "enabled" in s and not isinstance(s["enabled"], bool):
            bad(name, f"{where}: enabled must be true or false")
        if name != "music-sources.json" and not isinstance(s.get("builtIn"), bool):
            bad(name, f"{where}: builtIn missing")
        if isinstance(s.get("notes"), str) and len(s["notes"]) > 500:
            bad(name, f"{where}: notes longer than 500")
        headers = s.get("headers")
        if headers is not None:
            if not isinstance(headers, dict):
                bad(name, f"{where}: headers is not an object")
            else:
                for h in headers:
                    if SECRET_NAME.search(h):
                        bad(name, f"{where}: header {h!r} names a credential")
        for _path, k, _v in walk_keys(s):
            if SECRET_NAME.search(k) and k not in ("builtIn",):
                bad(name, f"{where}: field {k!r} looks like a secret")
    if len(sources) > 50:
        bad(name, "more than 50 sources (the app imports 50)")


def check_suggested() -> None:
    name = "suggested-repositories.json"
    d = load(name)
    if d is None:
        return
    if d.get("format") != "owntv-suggested-repositories":
        bad(name, f'"format" is {d.get("format")!r}')
    if d.get("version") != 1:
        bad(name, f'"version" is {d.get("version")!r}')
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", str(d.get("updated", ""))):
        bad(name, '"updated" is not YYYY-MM-DD')
    repos = d.get("repositories")
    if not isinstance(repos, list) or not repos:
        bad(name, '"repositories" missing or empty')
        return
    ids: set[str] = set()
    for i, r in enumerate(repos):
        rid = r.get("id") if isinstance(r, dict) else None
        if not isinstance(rid, str) or not VALID_ID.match(rid):
            bad(name, f"repositories[{i}] has an invalid id {rid!r}")
            continue
        if rid in ids:
            bad(name, f"duplicate id {rid!r}")
        ids.add(rid)
        for key in ("name", "description"):
            if not isinstance(r.get(key), str) or not r[key].strip():
                bad(name, f"{rid}: {key} missing")
        if r.get("kind") not in KINDS:
            bad(name, f"{rid}: kind {r.get('kind')!r} is not one of {sorted(KINDS)}")
        if not isinstance(r.get("adult"), bool):
            bad(name, f"{rid}: adult must be true or false")
        a = r.get("address")
        if not isinstance(a, str) or not a.strip():
            bad(name, f"{rid}: address missing")
        elif a.startswith("@"):
            if rid != "owntv-pack" or not re.match(r"^@[A-Za-z0-9._-]+$", a):
                bad(name, f"{rid}: only the owntv-pack entry may use an @folder address")
            elif not os.path.isdir(os.path.join(ROOT, a[1:])):
                bad(name, f"{rid}: folder {a[1:]!r} does not exist")
        elif r.get("kind") == "addon":
            if not http_url(a):
                bad(name, f"{rid}: an add-on address must be an http(s) manifest URL")
        elif not (http_url(a) or REPO_SHORT.match(a)):
            bad(name, f"{rid}: address {a!r} is neither owner/repo nor an http(s) URL")
        for u in re.findall(r"https?://\S+", json.dumps(r)):
            if "@" in urlsplit(u.rstrip('",')).netloc:
                bad(name, f"{rid}: address carries a login")


def check_pack_manifest() -> None:
    name = "providers/manifest.json"
    d = load(name)
    if d is None:
        return
    scrapers = d.get("scrapers")
    if not isinstance(scrapers, list) or not scrapers:
        bad(name, "scrapers missing")
        return
    seen: set[str] = set()
    for s in scrapers:
        sid = s.get("id")
        if sid in seen:
            bad(name, f"duplicate scraper id {sid!r}")
        seen.add(sid)
        fn = s.get("filename", "")
        if not os.path.isfile(os.path.join(ROOT, "providers", *fn.split("/"))):
            bad(name, f"{sid}: file {fn} is missing")
    declared = {os.path.basename(s.get("filename", "")) for s in scrapers}
    folder = os.path.join(ROOT, "providers", "providers")
    if os.path.isdir(folder):
        for f in os.listdir(folder):
            if f.endswith(".js") and f not in declared:
                bad(name, f"providers/{f} is not named by the manifest")


def known_tmdb_keys(pack: str) -> set[str]:
    keys: set[str] = set()
    env = os.environ.get("OWNTV_TMDB_KEY", "").strip().lower()
    if env:
        keys.add(env)
    mp = os.path.join(pack, "manifest.json")
    if os.path.isfile(mp):
        with open(mp, "rb") as f:
            manifest = json.loads(f.read().decode("utf-8"))
        for s in manifest.get("scrapers", []):
            p = os.path.join(pack, *s["filename"].split("/"))
            if os.path.isfile(p):
                with open(p, "rb") as f:
                    for h in tmdb_hits(f.read().decode("utf-8")):
                        keys.add(h.value.lower())
    else:
        print(f"note: private pack not found at {pack}; known TMDB keys are checked by context only")
    return keys


def walk_files():
    for base, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in (".git", "__pycache__", "node_modules")]
        for f in files:
            yield os.path.join(base, f)


def check_secrets(pack: str) -> None:
    keys = known_tmdb_keys(pack)
    for path in walk_files():
        rel = os.path.relpath(path, ROOT).replace(os.sep, "/")
        try:
            with open(path, "rb") as f:
                text = f.read().decode("utf-8")
        except UnicodeDecodeError:
            continue
        low = text.lower()
        for key in keys:
            if key in low:
                bad(rel, f"contains a known TMDB key {mask(key)}")
        for h in tmdb_hits(text):
            bad(rel, f"line {h.line}: 32-hex literal {mask(h.value)} in a TMDB context")
        for m in HEX32.finditer(text):
            if is_user_key(m.group()):
                bad(rel, f"the maintainer's own TMDB key at offset {m.start()}")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--pack", default=os.path.join(ROOT, "..", "owntv-provider-pack"))
    args = ap.parse_args()
    for name, media in MEDIA_FILES.items():
        check_media(name, media)
    check_suggested()
    check_pack_manifest()
    check_secrets(os.path.abspath(args.pack))
    for p in problems:
        print("PROBLEM", p)
    print(f"{len(problems)} problem(s)" if problems else "all lists ok")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
