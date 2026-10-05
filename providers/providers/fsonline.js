// copied from https://github.com/A2R14N/nuvio-providers@ec8788e5d824 (providers/fsonline.js), no licence stated by the repository; the original file follows unchanged.
/**
 * fsonline - Built from src/fsonline/
 * Generated: 2026-08-07T22:22:17.106Z
 */
var __create = Object.create;
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __getProtoOf = Object.getPrototypeOf;
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
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
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

// src/fsonline/extractor.js
var import_cheerio_without_node_native = __toESM(require("cheerio-without-node-native"));

// src/fsonline/http.js
var BASE_URL = "https://www3.fsonline.app";
var HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Referer: `${BASE_URL}/`,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9"
};
function fetchText(_0) {
  return __async(this, arguments, function* (url, options = {}) {
    console.log(`[FSOnline] Fetching HTML: ${url}`);
    const response = yield fetch(url, {
      headers: __spreadValues(__spreadValues({}, HEADERS), options.headers)
    });
    if (!response.ok)
      throw new Error(`HTTP ${response.status} on ${url}`);
    return yield response.text();
  });
}
function fetchJson(url) {
  return __async(this, null, function* () {
    const response = yield fetch(url);
    if (!response.ok)
      throw new Error(`TMDB HTTP ${response.status}`);
    return yield response.json();
  });
}

// src/fsonline/extractor.js
var TMDB_API_KEY = "";
function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-");
}
function getMediaInfo(tmdbId, mediaType) {
  return __async(this, null, function* () {
    var _a;
    const type = mediaType === "tv" ? "tv" : "movie";
    const url = `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const data = yield fetchJson(url);
    return {
      title: mediaType === "tv" ? data.name : data.title,
      year: ((_a = mediaType === "tv" ? data.first_air_date : data.release_date) == null ? void 0 : _a.split(
        "-"
      )[0]) || ""
    };
  });
}
function extractVidmolyStream(fileCode) {
  return __async(this, null, function* () {
    const candidates = [
      `https://vidmoly.to/e/${fileCode}`,
      `https://vidmoly.me/w/${fileCode}`,
      `https://vidmoly.to/w/${fileCode}`,
      `https://vidmoly.me/embed-${fileCode}.html`,
      `https://vidmoly.to/embed-${fileCode}.html`,
      `https://vidmoly.me/${fileCode}.html`,
      `https://vidmoly.to/${fileCode}.html`
    ];
    for (const url of candidates) {
      try {
        const html = yield fetchText(url, {
          headers: __spreadProps(__spreadValues({}, HEADERS), { Referer: "https://player.fsonline.app/" })
        });
        if (html && !html.includes("404 Not Found")) {
          const match = html.match(/file\s*:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i) || html.match(/(https?:\/\/[^"'\s]+\.m3u8[^"'\s]*)/i);
          if (match) {
            const directM3u8 = match[1];
            try {
              const probe = yield fetch(directM3u8, {
                headers: {
                  "User-Agent": HEADERS["User-Agent"],
                  Referer: "https://vidmoly.me/",
                  Accept: "*/*"
                }
              });
              const probeBody = yield probe.text();
              if (probe.ok && probeBody.startsWith("#EXTM3U")) {
                return directM3u8;
              }
            } catch (e) {
            }
          }
        }
      } catch (e) {
      }
    }
    return null;
  });
}
function buildTargetUrl(title, year, mediaType, season, episode) {
  return __async(this, null, function* () {
    const slug = slugify(title);
    if (mediaType === "movie") {
      return `${BASE_URL}/film/${slug}-${year}/`;
    }
    const tvCandidates = [
      `${BASE_URL}/tv/${slug}-season-${season}-episode-${episode}/`,
      `${BASE_URL}/episoade/${slug}-sezonul-${season}-episodul-${episode}/`,
      `${BASE_URL}/tv/${slug}-sezonul-${season}-episodul-${episode}/`,
      `${BASE_URL}/episoade/${slug}-season-${season}-episode-${episode}/`
    ];
    for (const candidate of tvCandidates) {
      try {
        const html = yield fetchText(candidate);
        if (html && !html.includes("404 Not Found") && !html.includes("Page Not Found")) {
          return candidate;
        }
      } catch (e) {
      }
    }
    return tvCandidates[0];
  });
}
function unpackPlayerPage(playerUrl, serverName) {
  return __async(this, null, function* () {
    const results = [];
    try {
      const html = yield fetchText(playerUrl, {
        headers: __spreadProps(__spreadValues({}, HEADERS), { Referer: `${BASE_URL}/` })
      });
      const fileCodeMatch = html.match(/file_code\s*=\s*['"]([a-zA-Z0-9]+)['"]/);
      if (fileCodeMatch) {
        const directM3u8 = yield extractVidmolyStream(fileCodeMatch[1]);
        if (directM3u8 && directM3u8.includes(".m3u8")) {
          results.push({
            title: `${serverName} (Direct HLS)`,
            url: directM3u8,
            quality: "1080p",
            headers: {
              "User-Agent": HEADERS["User-Agent"],
              Referer: "https://vidmoly.me/"
            }
          });
        }
      }
    } catch (e) {
    }
    return results;
  });
}
function getStreamsFromFSOnline(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    const streams = [];
    const addedUrls = /* @__PURE__ */ new Set();
    try {
      const info = yield getMediaInfo(tmdbId, mediaType);
      const targetUrl = yield buildTargetUrl(
        info.title,
        info.year,
        mediaType,
        season,
        episode
      );
      const pageHtml = yield fetchText(targetUrl);
      const $ = import_cheerio_without_node_native.default.load(pageHtml);
      let movieId = $("#show_player_lazy").attr("movie-id") || $("[movie-id]").attr("movie-id");
      if (!movieId) {
        const bodyMatch = ($("body").attr("class") || "").match(/postid-(\d+)/);
        if (bodyMatch)
          movieId = bodyMatch[1];
      }
      if (movieId) {
        const lazyParams = new URLSearchParams();
        lazyParams.append("action", "lazy_player");
        lazyParams.append("movieID", movieId);
        const lazyRes = yield fetch(`${BASE_URL}/wp-admin/admin-ajax.php`, {
          method: "POST",
          headers: __spreadProps(__spreadValues({}, HEADERS), {
            Referer: targetUrl,
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest"
          }),
          body: lazyParams.toString()
        });
        if (lazyRes.ok) {
          const lazyHtml = yield lazyRes.text();
          const $lazy = import_cheerio_without_node_native.default.load(lazyHtml);
          const serverTabs = $lazy("li[data-vs]");
          for (let i = 0; i < serverTabs.length; i++) {
            const el = serverTabs.eq(i);
            const playerUrl = el.attr("data-vs");
            const serverName = el.find("span").text().trim() || `Server ${i + 1}`;
            if (playerUrl) {
              const unpacked = yield unpackPlayerPage(playerUrl, serverName);
              for (const stream of unpacked || []) {
                if (stream.url && stream.url.includes(".m3u8") && !addedUrls.has(stream.url)) {
                  addedUrls.add(stream.url);
                  let cleanHost = serverName.replace(/\s*\(Direct HLS\)/i, "");
                  if (!cleanHost.toLowerCase().includes("server")) {
                    cleanHost = `Server ${cleanHost}`;
                  }
                  const hostLabel = cleanHost.replace(/^Server\s+/i, "");
                  streams.push({
                    name: `FSOnline - ${hostLabel}`,
                    title: stream.title,
                    url: stream.url,
                    quality: stream.quality || "1080p",
                    language: "ro",
                    headers: stream.headers
                  });
                }
              }
            }
          }
        }
      }
    } catch (error) {
    }
    return streams;
  });
}

// src/fsonline/index.js
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      return yield getStreamsFromFSOnline(tmdbId, mediaType, season, episode);
    } catch (error) {
      console.error(`[FSOnline] Error: ${error.message}`);
      return [];
    }
  });
}
module.exports = { getStreams };
