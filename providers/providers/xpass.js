// copied from https://github.com/A2R14N/nuvio-providers@ec8788e5d824 (providers/xpass.js), no licence stated by the repository; the original file follows unchanged.
/**
 * xpass - Built from src/xpass/
 * Generated: 2026-08-11T00:29:37.013Z
 */
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// src/xpass/index.js
var BASE_URL = "https://play.xpass.top";
var SUBTITLE_BASE_URL = "https://sub.1x2.space";
var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
var PLAYABLE_SERVER_PREFIXES = ["VIP", "LUL", "ARA", "MOL"];
function requestHeaders(referer) {
  return {
    "User-Agent": USER_AGENT,
    Accept: "*/*",
    Referer: referer || `${BASE_URL}/`
  };
}
function request(url, options = {}) {
  return fetch(url, options);
}
function fetchText(url, referer) {
  return __async(this, null, function* () {
    const response = yield request(url, {
      headers: requestHeaders(referer),
      redirect: "follow"
    });
    if (!response.ok)
      throw new Error(`HTTP ${response.status}: ${url}`);
    return response.text();
  });
}
function fetchJson(url, referer) {
  return __async(this, null, function* () {
    const response = yield request(url, {
      headers: requestHeaders(referer),
      redirect: "follow"
    });
    if (!response.ok)
      throw new Error(`HTTP ${response.status}: ${url}`);
    return response.json();
  });
}
function playerUrl(tmdbId, mediaType, season, episode) {
  if (mediaType === "tv") {
    return `${BASE_URL}/e/tv/${encodeURIComponent(tmdbId)}/${encodeURIComponent(season)}/${encodeURIComponent(episode)}`;
  }
  return `${BASE_URL}/e/movie/${encodeURIComponent(tmdbId)}`;
}
function extractPlayerConfig(html, pageUrl) {
  const dataMatch = html.match(/var\s+data\s*=\s*(\{[\s\S]*?\})\s*<\/script>/i);
  if (!dataMatch)
    return null;
  let data;
  try {
    data = JSON.parse(dataMatch[1]);
  } catch (_) {
    return null;
  }
  const playlistPath = data && data.playlist;
  if (!playlistPath || typeof playlistPath !== "string")
    return null;
  const subtitleMatch = html.match(/var\s+suburl\s*=\s*["']([^"']+)["']/i);
  const backupsMatch = html.match(
    /var\s+backups\s*=\s*(\[[\s\S]*?\])\s*;?\s*<\/script>/i
  );
  let backups = [];
  if (backupsMatch) {
    try {
      backups = JSON.parse(backupsMatch[1]);
    } catch (_) {
      backups = [];
    }
  }
  const playlistEntries = backups.filter(
    (backup) => backup && backup.url && PLAYABLE_SERVER_PREFIXES.some(
      (prefix) => String(backup.name || "").startsWith(prefix)
    )
  ).map((backup) => ({
    name: backup.name || "Server",
    url: new URL(backup.url, pageUrl).href
  }));
  if (!playlistEntries.length) {
    playlistEntries.push({
      name: "Default",
      url: new URL(playlistPath, pageUrl).href
    });
  }
  return {
    playlistEntries,
    subtitleUrl: subtitleMatch ? new URL(subtitleMatch[1], pageUrl).href : ""
  };
}
function maxQuality(playlistText) {
  let height = 0;
  for (const match of playlistText.matchAll(/RESOLUTION=\d+x(\d+)/gi)) {
    height = Math.max(height, Number(match[1]) || 0);
  }
  return height ? `${height}p` : "Auto";
}
function loadSubtitles(url, pageUrl) {
  return __async(this, null, function* () {
    if (!url)
      return [];
    try {
      const entries = yield fetchJson(url, pageUrl);
      if (!Array.isArray(entries))
        return [];
      return entries.filter((entry) => entry && entry.status === "cached" && entry.url).map((entry) => ({
        url: new URL(entry.url, SUBTITLE_BASE_URL).href,
        lang: String(entry.language || entry.label || "und").toLowerCase(),
        label: entry.label || entry.language || "Subtitle",
        language: String(entry.language || entry.label || "und").toLowerCase(),
        name: entry.label || entry.language || "Subtitle"
      }));
    } catch (_) {
      return [];
    }
  });
}
function parseRenditions(playlistText, masterUrl) {
  const lines = playlistText.split(/\r?\n/);
  const renditions = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line.startsWith("#EXT-X-STREAM-INF:"))
      continue;
    const resolution = line.match(/RESOLUTION=\d+x(\d+)/i);
    let renditionUrl = "";
    for (let next = index + 1; next < lines.length; next += 1) {
      const candidate = lines[next].trim();
      if (!candidate || candidate.startsWith("#"))
        continue;
      renditionUrl = new URL(candidate, masterUrl).href;
      break;
    }
    if (renditionUrl) {
      renditions.push({
        url: renditionUrl,
        quality: resolution ? `${resolution[1]}p` : "Auto"
      });
    }
  }
  return renditions;
}
function resolveSource(source, serverName, pageUrl, subtitles) {
  return __async(this, null, function* () {
    if (!source || !source.file || source.type !== "hls")
      return [];
    try {
      const playlist = yield fetchText(source.file, pageUrl);
      if (!playlist.trimStart().startsWith("#EXTM3U"))
        return [];
      const renditions = parseRenditions(playlist, source.file);
      const streams = renditions.length ? renditions : [{ url: source.file, quality: maxQuality(playlist) }];
      return streams.map((stream) => ({
        name: `XPass - ${serverName}`,
        title: `XPass \u2022 ${serverName} \u2022 ${source.label || "HLS"} \u2022 ${stream.quality}`,
        url: stream.url,
        quality: stream.quality,
        language: "en",
        type: "application/x-mpegurl",
        provider: "xpass",
        headers: requestHeaders(pageUrl),
        subtitles
      }));
    } catch (_) {
      return [];
    }
  });
}
function loadPlaylist(entry, pageUrl) {
  return __async(this, null, function* () {
    try {
      const data = yield fetchJson(entry.url, pageUrl);
      const sources = data && data.playlist && data.playlist[0] && data.playlist[0].sources;
      if (!Array.isArray(sources))
        return [];
      return sources.map((source) => ({ source, serverName: entry.name }));
    } catch (_) {
      return [];
    }
  });
}
function getStreams(tmdbId, mediaType, season = null, episode = null) {
  return __async(this, null, function* () {
    const normalizedType = mediaType === "series" ? "tv" : mediaType;
    if (!tmdbId || normalizedType !== "movie" && normalizedType !== "tv")
      return [];
    if (normalizedType === "tv" && (!season || !episode))
      return [];
    const pageUrl = playerUrl(tmdbId, normalizedType, season, episode);
    try {
      const html = yield fetchText(pageUrl, `${BASE_URL}/`);
      if (/turnstile|cf-chl-/i.test(html))
        return [];
      const config = extractPlayerConfig(html, pageUrl);
      if (!config)
        return [];
      const subtitlesPromise = loadSubtitles(config.subtitleUrl, pageUrl);
      const resolvedServers = yield Promise.all(
        config.playlistEntries.map((entry) => __async(this, null, function* () {
          const [sources, subtitles] = yield Promise.all([
            loadPlaylist(entry, pageUrl),
            subtitlesPromise
          ]);
          const groups = yield Promise.all(
            sources.map(
              ({ source, serverName }) => resolveSource(source, serverName, pageUrl, subtitles)
            )
          );
          return groups.flat();
        }))
      );
      const resolved = resolvedServers.flat();
      const seen = /* @__PURE__ */ new Set();
      return resolved.filter((stream) => {
        if (!stream || seen.has(stream.url))
          return false;
        seen.add(stream.url);
        return true;
      });
    } catch (error) {
      console.error(`[XPass] ${error.message}`);
      return [];
    }
  });
}
module.exports = { getStreams };
