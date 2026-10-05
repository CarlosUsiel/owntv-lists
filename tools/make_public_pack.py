#!/usr/bin/env python3
"""Make the public copy of the OwnTV provider pack: `providers/` of this repository.

    python tools/make_public_pack.py [SOURCE_PACK_DIR] [TARGET_DIR]

SOURCE_PACK_DIR  the private pack repository (default: ../owntv-provider-pack next to this repository)
TARGET_DIR       where the copy goes (default: providers/ of this repository)

What it does
  * copies manifest.json and every file the manifest names (`providers/<id>.js`), byte for byte,
    except that third-party TMDB API keys are emptied: the host app removes any `api_key` from a
    plugin's requests to api.themoviedb.org and adds its own, so an empty key is harmless at runtime;
  * a key is a 32-hex literal with TMDB / api_key words next to it, or one equal to such a key found
    anywhere else in the pack (minified files keep the key in a variable with no name);
  * only the hex value is removed, quotes and `api_key=` stay, so the syntax stays valid;
  * prints what it stripped as file:line with the first 4 characters of the key only;
  * runs `node --check` on every changed file when node is installed;
  * exits non-zero when a TMDB-context 32-hex literal remains, a file the manifest names is missing,
    or a changed file no longer parses.

Providers in PRIVATE_ONLY (owner's decision) are left out of the copy: their manifest entry and file.

signature.json is NOT written here: the pack is signed afterwards with tools/sign_pack.py of the
private pack repository. Re-sign after every run of this tool.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _hexscan import mask, tmdb_hits  # noqa: E402

# Owner's decision (2026-10-05): stays in the private pack only (it carries a third-party token).
PRIVATE_ONLY = {"xdownloader"}

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)


def strip(text: str, known: set[str]) -> tuple[str, list[tuple[int, str]]]:
    """[text] without TMDB keys, and the (line, value) of each removed key."""
    lines = text.split("\n")
    # Cut from the right so the columns of the earlier hits on the same line stay valid.
    hits = sorted(tmdb_hits(text, known), key=lambda h: (h.line, h.start), reverse=True)
    removed = []
    for h in hits:
        line = lines[h.line - 1]
        lines[h.line - 1] = line[:h.start] + line[h.end:]
        removed.append((h.line, h.value))
    removed.reverse()
    return "\n".join(lines), removed


def node_check(path: str, node: str) -> tuple[bool, str]:
    r = subprocess.run([node, "--check", path], capture_output=True, text=True)
    return r.returncode == 0, (r.stderr or r.stdout).strip().splitlines()[0] if r.returncode else ""


def main(argv: list[str]) -> int:
    source = os.path.abspath(argv[1]) if len(argv) > 1 else os.path.abspath(os.path.join(REPO, "..", "owntv-provider-pack"))
    target = os.path.abspath(argv[2]) if len(argv) > 2 else os.path.join(REPO, "providers")
    manifest_path = os.path.join(source, "manifest.json")
    if not os.path.isfile(manifest_path):
        print(f"error: {manifest_path} not found", file=sys.stderr)
        return 2
    with open(manifest_path, "rb") as f:
        manifest_bytes = f.read()
    manifest = json.loads(manifest_bytes.decode("utf-8"))
    if any(s["id"] in PRIVATE_ONLY for s in manifest["scrapers"]):
        for s in manifest["scrapers"]:
            if s["id"] in PRIVATE_ONLY:
                print(f"left out (private only): {s['id']}")
        manifest["scrapers"] = [s for s in manifest["scrapers"] if s["id"] not in PRIVATE_ONLY]
        manifest_bytes = (json.dumps(manifest, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
    names = [s["filename"] for s in manifest["scrapers"]]
    problems = 0
    sources: dict[str, str] = {}
    for rel in names:
        p = os.path.join(source, *rel.split("/"))
        if not os.path.isfile(p):
            print(f"error: manifest names {rel} but it is missing", file=sys.stderr)
            problems += 1
            continue
        with open(p, "rb") as f:
            sources[rel] = f.read().decode("utf-8")
    if "".join(sources.values()) == "" and problems:
        return 2

    # Pass 1: values that are TMDB keys by context anywhere. Pass 2: strip those and every in-context literal.
    known = {h.value.lower() for text in sources.values() for h in tmdb_hits(text)}

    out_dir = target
    os.makedirs(os.path.join(out_dir, "providers"), exist_ok=True)
    # The target replaces the previous public copy: drop provider files the manifest no longer names.
    wanted = {os.path.basename(n) for n in names}
    for old in os.listdir(os.path.join(out_dir, "providers")):
        if old.endswith(".js") and old not in wanted:
            os.remove(os.path.join(out_dir, "providers", old))

    # The target folder holds manifest.json and providers/<id>.js, like the pack itself.
    changed: list[str] = []
    distinct: set[str] = set()
    files_with_keys: dict[str, int] = {}
    for rel, text in sources.items():
        new, removed = strip(text, known)
        dest = os.path.join(out_dir, *rel.split("/"))
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        with open(dest, "wb") as f:
            f.write(new.encode("utf-8"))
        if removed:
            changed.append(rel)
            files_with_keys[rel] = len(removed)
            for line, value in removed:
                distinct.add(value.lower())
                print(f"stripped {rel}:{line}  {mask(value)}")
    with open(os.path.join(out_dir, "manifest.json"), "wb") as f:
        f.write(manifest_bytes)

    # Final check on what was written.
    left = 0
    for rel in names:
        dest = os.path.join(out_dir, *rel.split("/"))
        if not os.path.isfile(dest):
            continue
        with open(dest, "rb") as f:
            for h in tmdb_hits(f.read().decode("utf-8"), known):
                print(f"REMAINS {rel}:{h.line}  {mask(h.value)}", file=sys.stderr)
                left += 1
    if left:
        problems += left

    # Syntax proof for the files that changed.
    node = shutil.which("node")
    if changed and node:
        bad = 0
        for rel in changed:
            ok, msg = node_check(os.path.join(out_dir, *rel.split("/")), node)
            if not ok:
                # Only a regression counts: a provider that did not parse before is not our doing.
                with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as t:
                    t.write(sources[rel])
                ok_before, _ = node_check(t.name, node)
                os.unlink(t.name)
                if ok_before:
                    print(f"SYNTAX {rel}: {msg}", file=sys.stderr)
                    bad += 1
        print(f"node --check: {len(changed) - bad}/{len(changed)} changed files parse")
        problems += bad
    elif changed:
        print("node not found: syntax of the changed files was not checked")

    if os.path.exists(os.path.join(out_dir, "signature.json")):
        print("note: signature.json exists and is now stale; sign again with sign_pack.py")
    print(
        f"{len(names)} providers copied, {len(changed)} changed, "
        f"{sum(files_with_keys.values())} key occurrences emptied, {len(distinct)} distinct keys"
    )
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
