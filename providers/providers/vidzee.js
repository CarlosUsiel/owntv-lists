// copied from https://github.com/A2R14N/nuvio-providers@ec8788e5d824 (providers/vidzee.js), no licence stated by the repository; the original file follows unchanged.
/**
 * vidzee - Built from src/vidzee/
 * Generated: 2026-08-11T16:19:36.399Z
 */
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
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

// src/vidzee/index.js
var API_URL = "https://core.vidzee.wtf";
var PLAYER_URL = "https://player.vidzee.wtf";
var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36";
var SERVERS = [
  { id: "dcloud", name: "Dcloud" },
  { id: "tik", name: "TCloud" },
  { id: "ipcloud", name: "IPcloud" },
  { id: "v6:Hindi", name: "Hindi v3" }
];
var HEADERS = {
  Accept: "*/*",
  Origin: PLAYER_URL,
  Referer: `${PLAYER_URL}/`,
  "User-Agent": USER_AGENT
};
function endpoint(tmdbId, type, season, episode, server) {
  const path = type === "tv" ? `/streams/tv/${encodeURIComponent(tmdbId)}/${encodeURIComponent(season)}/${encodeURIComponent(episode)}` : `/streams/movie/${encodeURIComponent(tmdbId)}`;
  return `${API_URL}${path}?s=${encodeURIComponent(server)}`;
}
function absoluteUrl(value, base) {
  if (!value || typeof value !== "string")
    return null;
  if (/^https?:\/\//i.test(value))
    return value;
  const origin = base.match(/^(https?:\/\/[^/]+)/i);
  if (!origin)
    return null;
  if (value.startsWith("/"))
    return `${origin[1]}${value}`;
  return `${base.slice(0, base.lastIndexOf("/") + 1)}${value.replace(/^\.\//, "")}`;
}
function qualityFrom(info, url) {
  const path = String(url).match(/(?:^|[\/_-])(2160|1440|1080|720|480|360|240)p?(?:[\/_.-]|$)/i);
  if (path)
    return `${path[1]}p`;
  const resolution = String(info).match(/RESOLUTION=(\d+)x(\d+)/i);
  return resolution ? `${resolution[2]}p` : "Auto";
}
function masterVariants(text, masterUrl) {
  const lines = text.split(/\r?\n/);
  const output = [];
  for (let index = 0; index < lines.length; index += 1) {
    const info = lines[index].trim();
    if (!info.startsWith("#EXT-X-STREAM-INF:"))
      continue;
    let next = index + 1;
    while (next < lines.length && (!lines[next].trim() || lines[next].trim().startsWith("#")))
      next += 1;
    if (next >= lines.length)
      continue;
    const url = absoluteUrl(lines[next].trim(), masterUrl);
    if (url)
      output.push({ url, quality: qualityFrom(info, url) });
  }
  return output;
}
function firstMediaUri(text) {
  for (const line of text.split(/\r?\n/)) {
    const value = line.trim();
    if (value && !value.startsWith("#"))
      return value;
  }
  return null;
}
function validMediaBody(body) {
  if (!body || body.length < 8)
    return false;
  if (body.charCodeAt(0) === 71)
    return true;
  const box = body.slice(4, 8);
  if (box === "ftyp" || box === "styp" || box === "moof")
    return true;
  return false;
}
function validVod(url, knownText = null) {
  return __async(this, null, function* () {
    let text = knownText;
    if (text === null) {
      const playlist = yield fetch(url, { headers: HEADERS, redirect: "follow" });
      if (!playlist.ok)
        return false;
      text = yield playlist.text();
    }
    if (!text.trimStart().startsWith("#EXTM3U") || !text.includes("#EXT-X-ENDLIST"))
      return false;
    const segment = absoluteUrl(firstMediaUri(text), url);
    if (!segment)
      return false;
    const response = yield fetch(segment, {
      headers: __spreadProps(__spreadValues({}, HEADERS), { Range: "bytes=0-1023" }),
      redirect: "follow"
    });
    if (!response.ok)
      return false;
    return validMediaBody(yield response.text());
  });
}
function resolveServer(server, tmdbId, type, season, episode) {
  return __async(this, null, function* () {
    try {
      const response = yield fetch(endpoint(tmdbId, type, season, episode, server.id), {
        headers: HEADERS,
        redirect: "follow"
      });
      if (!response.ok)
        return [];
      const data = yield response.json();
      if (!data || !/^https?:\/\//i.test(data.url || "") || !/\.m3u8(?:$|[?#])/i.test(data.url))
        return [];
      const playlist = yield fetch(data.url, { headers: HEADERS, redirect: "follow" });
      if (!playlist.ok)
        return [];
      const text = yield playlist.text();
      if (!text.trimStart().startsWith("#EXTM3U"))
        return [];
      let variants = masterVariants(text, data.url);
      if (variants.length) {
        const checked = yield Promise.all(
          variants.map((variant) => __async(this, null, function* () {
            return (yield validVod(variant.url)) ? variant : null;
          }))
        );
        variants = checked.filter(Boolean);
      } else {
        variants = (yield validVod(data.url, text)) ? [{ url: data.url, quality: qualityFrom("", data.url) }] : [];
      }
      const languageValue = String(data.language || "").toLowerCase();
      const language = languageValue.includes("hindi") ? "hi" : "en";
      return variants.map((variant) => ({
        name: `VidZee - ${server.name}`,
        title: `VidZee \u2022 ${server.name} \u2022 ${variant.quality}`,
        url: variant.url,
        quality: variant.quality,
        language,
        type: "application/x-mpegurl",
        provider: "vidzee",
        headers: HEADERS,
        subtitles: []
      }));
    } catch (error) {
      console.warn(`[VidZee] ${server.name}: ${error.message}`);
      return [];
    }
  });
}
function getStreams(tmdbId, mediaType, season = null, episode = null) {
  return __async(this, null, function* () {
    const type = mediaType === "series" ? "tv" : mediaType;
    if (!tmdbId || type !== "movie" && type !== "tv")
      return [];
    if (type === "tv" && (!season || !episode))
      return [];
    const groups = yield Promise.all(
      SERVERS.map((server) => resolveServer(server, tmdbId, type, season, episode))
    );
    const seen = /* @__PURE__ */ new Set();
    return groups.reduce((all, group) => all.concat(group), []).filter((stream) => {
      if (seen.has(stream.url))
        return false;
      seen.add(stream.url);
      return true;
    });
  });
}
module.exports = { getStreams };
