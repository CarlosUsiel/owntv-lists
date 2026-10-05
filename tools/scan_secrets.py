#!/usr/bin/env python3
"""Generic secret scan of this repository. Prints findings as file:line with the value masked.

    python tools/scan_secrets.py [--all] [--root DIR]

Findings come in two kinds:
  HIGH  something that is probably a live credential: a hex string of 32+ characters with a key / token /
        secret / auth word next to it, `Bearer <long token>`, `token=<long value>`, `password: <value>`,
        or the maintainer's TMDB key (known by its SHA-256 only);
  INFO  something worth a look: the words `Authorization:`, `password`, `secret`, `token=`, private or
        loopback IP addresses, e-mail addresses (--all prints these; otherwise only counted).

Exit code 1 when there is a HIGH finding that is not in tools/scan_allowlist.txt. The allowlist holds
`<path>:<first 12 hex of SHA-256 of the value>  # why` per line: values that are known, deliberate and not
ours (constants other people's providers ship), recorded by hash so the list itself leaks nothing.
No key is written in this file.
"""
from __future__ import annotations

import argparse
import hashlib
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _hexscan import HEXLONG, is_user_key, mask  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
KEY_WORDS = re.compile(r"key|token|secret|auth|passw|bearer|api|cred|sign|salt|cookie", re.I)
# A long hex string next to these words is a digest or a checksum, not a credential.
DIGEST_WORDS = re.compile(r"sha-?\d*|hash|digest|checksum|md5", re.I)
BEARER = re.compile(r"Bearer\s+([A-Za-z0-9._~+/=-]{20,})")
TOKEN_EQ = re.compile(r"(?<![A-Za-z0-9_])(?:access_|auth_|api_|refresh_)?token=([A-Za-z0-9._~+/%-]{12,})", re.I)
PASSWORD = re.compile(r"""passw(?:or)?d["']?\s*[:=]\s*["']([^"'\s]{4,})["']""", re.I)
AUTH_HDR = re.compile(r"Authorization\s*:", re.I)
WORDS = re.compile(r"password|secret", re.I)
PRIVATE_IP = re.compile(
    r"(?<![\d.])(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|127\.\d{1,3}\.\d{1,3}\.\d{1,3})(?![\d.])"
)
EMAIL = re.compile(r"(?<![\w.+-])[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+")
BEFORE, AFTER = 70, 20


def digest(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:12]


def load_allowlist(root: str) -> set[str]:
    out: set[str] = set()
    p = os.path.join(root, "tools", "scan_allowlist.txt")
    if os.path.isfile(p):
        with open(p, encoding="utf-8") as f:
            for line in f:
                line = line.split("#", 1)[0].strip()
                if line:
                    out.add(line)
    return out


def scan_text(rel: str, text: str):
    """Yield (severity, line, kind, value) for one file."""
    for number, line in enumerate(text.split("\n"), 1):
        for m in HEXLONG.finditer(line):
            value = m.group()
            near = line[max(0, m.start() - BEFORE):m.start()] + " " + line[m.end():m.end() + AFTER]
            if is_user_key(value[:32]) and len(value) == 32:
                yield "HIGH", number, "maintainer's own TMDB key", value
            elif DIGEST_WORDS.search(near):
                continue
            elif KEY_WORDS.search(near):
                yield "HIGH", number, f"{len(value)}-hex string next to a key word", value
        for m in BEARER.finditer(line):
            tok = m.group(1)
            if not tok.startswith(("$", "{", "<")) and not re.fullmatch(r"[A-Za-z_]+", tok):
                yield "HIGH", number, "Bearer token", tok
        for m in TOKEN_EQ.finditer(line):
            yield "HIGH", number, "token= value", m.group(1)
        for m in PASSWORD.finditer(line):
            yield "HIGH", number, "password value", m.group(1)
        if AUTH_HDR.search(line):
            yield "INFO", number, "Authorization: header", "Authorization:"
        for m in WORDS.finditer(line):
            yield "INFO", number, f"word '{m.group().lower()}'", m.group()
        for m in PRIVATE_IP.finditer(line):
            yield "INFO", number, "private or loopback IP", m.group()
        for m in EMAIL.finditer(line):
            yield "INFO", number, "e-mail address", m.group()


def walk(root: str):
    for base, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in (".git", "__pycache__", "node_modules")]
        for f in sorted(files):
            if f.endswith((".pyc", ".png", ".jpg", ".zip")):
                continue
            yield os.path.join(base, f)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--root", default=os.path.dirname(HERE))
    ap.add_argument("--all", action="store_true", help="print INFO findings too")
    args = ap.parse_args()
    root = os.path.abspath(args.root)
    allow = load_allowlist(root)
    high = allowed = 0
    info: dict[str, int] = {}
    for path in walk(root):
        rel = os.path.relpath(path, root).replace(os.sep, "/")
        try:
            with open(path, "rb") as f:
                text = f.read().decode("utf-8")
        except UnicodeDecodeError:
            continue
        for severity, line, kind, value in scan_text(rel, text):
            if severity == "HIGH":
                if f"{rel}:{digest(value)}" in allow:
                    allowed += 1
                    continue
                high += 1
                print(f"HIGH {rel}:{line}  {kind}  {mask(value)}  [{digest(value)}]")
            else:
                info[kind] = info.get(kind, 0) + 1
                if args.all:
                    shown = value if kind.startswith(("word", "Authorization")) else mask(value)
                    print(f"INFO {rel}:{line}  {kind}  {shown}")
    print(f"{high} HIGH finding(s) ({allowed} allowlisted); INFO: " + (", ".join(f"{k} x{v}" for k, v in sorted(info.items())) or "none"))
    return 1 if high else 0


if __name__ == "__main__":
    sys.exit(main())
