"""Shared helpers for the tools: finding 32-hex literals in a TMDB / API-key context.

No key is written in this file. The maintainer's own TMDB key is recognised by its SHA-256
only (so a leak of it in any file is caught without the tool containing it); a second way
to name it is the OWNTV_TMDB_KEY environment variable.
"""
from __future__ import annotations

import hashlib
import os
import re
from typing import Iterator, NamedTuple

# SHA-256 of the maintainer's own TMDB key (lower case). Never the key itself.
USER_KEY_SHA256 = "f74c51ab0113975cd5de32719f22d6da84e9c89b425d3c9a1831bc2ba9a3803e"

# A 32-hex literal that is not part of a longer alphanumeric run (so a 64-hex digest never matches).
HEX32 = re.compile(r"(?<![0-9A-Za-z])[0-9a-fA-F]{32}(?![0-9A-Za-z])")
# A hex run of 32 or more characters (keys, secrets, digests), same boundary rule.
HEXLONG = re.compile(r"(?<![0-9A-Za-z])[0-9a-fA-F]{32,128}(?![0-9A-Za-z])")

# What makes a 32-hex literal a TMDB API key: the words near it.
TMDB_CTX = re.compile(r"tmdb|themoviedb|api[_-]?key|apikey", re.IGNORECASE)
# Look this far before and after the literal (minified files put whole programs on one line).
BEFORE = 90
AFTER = 40


class Hit(NamedTuple):
    line: int       # 1-based
    start: int      # column of the value inside the line
    end: int
    value: str
    context: str    # the text just before the value (for the private key list only)


def mask(value: str) -> str:
    """First 4 characters and the length: enough to recognise a finding, not to use it."""
    return f"{value[:4]}...({len(value)})"


def sha256_hex(value: str) -> str:
    return hashlib.sha256(value.strip().lower().encode("utf-8")).hexdigest()


def is_user_key(value: str) -> bool:
    if sha256_hex(value) == USER_KEY_SHA256:
        return True
    env = os.environ.get("OWNTV_TMDB_KEY", "").strip().lower()
    return bool(env) and value.strip().lower() == env


def tmdb_hits(text: str, known: set[str] | None = None) -> Iterator[Hit]:
    """Every 32-hex literal in a TMDB context, or equal to a value already known as a TMDB key."""
    known = known or set()
    for number, line in enumerate(text.split("\n"), 1):
        for m in HEX32.finditer(line):
            value = m.group()
            near = line[max(0, m.start() - BEFORE):m.start()] + " " + line[m.end():m.end() + AFTER]
            if TMDB_CTX.search(near) or value.lower() in known or is_user_key(value):
                yield Hit(number, m.start(), m.end(), value, line[max(0, m.start() - 50):m.start()])


def read_text(path: str) -> str:
    with open(path, "rb") as f:
        return f.read().decode("utf-8")
