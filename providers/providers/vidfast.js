// copied from https://github.com/Trixjustbetter/videasy-nuvio@5fc9d1e7f79f (providers/vidfast.js), GPL-3.0; the original file follows unchanged.
/**
 * vidfast - Built from src/vidfast/
 * Generated: 2026-08-23T14:33:42.728Z
 */
var __videasy = (() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
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

  // src/vidfast/extractor.js
  function bodyTextOf(res) {
    if (!res)
      return "";
    if (typeof res.text === "function")
      return res.text();
    if (typeof res._bodyText === "string")
      return res._bodyText;
    if (typeof res.body === "string")
      return res.body;
    return "";
  }
  function fetchText(url, options) {
    return __async(this, null, function* () {
      if (typeof fetch !== "function")
        throw new Error("fetch is not available in this runtime");
      const res = yield fetch(url, Object.assign({ method: "GET" }, options || {}));
      const text = yield bodyTextOf(res);
      const status = res && typeof res.status === "number" ? res.status : 0;
      if (status && status >= 400)
        throw new Error("HTTP " + status + " for " + url);
      return String(text || "");
    });
  }
  function postText(url, headers) {
    return __async(this, null, function* () {
      const res = yield fetch(url, { method: "POST", headers });
      const text = yield bodyTextOf(res);
      const status = res && typeof res.status === "number" ? res.status : 0;
      if (status && status >= 400)
        throw new Error("HTTP " + status + " for " + url);
      return String(text || "");
    });
  }
  function postJson(url, obj) {
    return __async(this, null, function* () {
      const res = yield fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(obj)
      });
      const text = yield bodyTextOf(res);
      const status = res && typeof res.status === "number" ? res.status : 0;
      if (status && status >= 400)
        throw new Error("HTTP " + status + " for " + url);
      return JSON.parse(String(text || "{}"));
    });
  }
  function getJson(url) {
    return __async(this, null, function* () {
      const text = yield fetchText(url, { headers: { "User-Agent": STREAM_HEADERS["User-Agent"] } });
      return JSON.parse(String(text || "{}"));
    });
  }
  function decryptBlob(encrypted) {
    return __async(this, null, function* () {
      const resp = yield postJson(ENCDEC_API + "/dec-vidfast", { text: encrypted });
      if (!resp || resp.status !== 200) {
        throw new Error("dec-vidfail " + (resp && resp.error || "status " + (resp && resp.status)));
      }
      const r = resp.result;
      if (typeof r === "string")
        return JSON.parse(r);
      return r;
    });
  }
  function extractToken(html) {
    let m = html.match(/\\"(?:en|token)\\":\\"([^"\\]+)\\"/);
    if (m && m[1].length >= 20)
      return m[1];
    m = html.match(/"(?:en|token)":"([^"\\]{20,})"/);
    if (m)
      return m[1];
    return "";
  }
  function embedUrl(mediaType, tmdbId, season, episode) {
    const isTv = String(mediaType).toLowerCase() === "tv" || String(mediaType).toLowerCase() === "series";
    if (isTv) {
      return SITE + "/tv/" + encodeURIComponent(tmdbId) + "/" + (Number(season) || 1) + "/" + (Number(episode) || 1) + "/";
    }
    return SITE + "/movie/" + encodeURIComponent(tmdbId) + "/";
  }
  function probePlaylistHeight(url) {
    return __async(this, null, function* () {
      try {
        const text = yield fetchText(url, { headers: STREAM_HEADERS });
        let best = 0;
        const re = /RESOLUTION=\d+x(\d+)/g;
        let m;
        while ((m = re.exec(text)) !== null) {
          const h = parseInt(m[1], 10);
          if (h > best)
            best = h;
        }
        return best;
      } catch (e) {
        return 0;
      }
    });
  }
  function heightToQuality(h) {
    if (!h)
      return "";
    if (h >= 2e3)
      return "4K";
    if (h >= 1e3)
      return "1080p";
    return h + "p";
  }
  function qualityRank(q) {
    if (q === "4K")
      return 4;
    if (q === "1080p")
      return 3;
    if (q === "720p")
      return 2;
    if (q)
      return 1;
    return 0;
  }
  function resolveServer(streamBase, server) {
    return __async(this, null, function* () {
      if (!server || !server.data)
        return [];
      const encrypted = yield postText(streamBase + "/" + server.data, requestHeaders());
      const payload = yield decryptBlob(encrypted);
      if (!payload || !payload.url)
        return [];
      const url = String(payload.url);
      let quality = heightToQuality(yield probePlaylistHeight(url));
      if (!quality) {
        if (/2160p|s2160/i.test(url))
          quality = "4K";
        else if (payload["4kAvailable"] === true || String(server.image || "").indexOf("4k") !== -1)
          quality = "4K";
        else if (/1080/.test(url))
          quality = "1080p";
        else
          quality = "Auto";
      }
      return [{
        title: "Vidfast \u2022 " + (server.name || "Server"),
        url,
        quality,
        type: /\.mpd(\?|$)/i.test(url) ? "dash" : "hls",
        headers: STREAM_HEADERS
      }];
    });
  }
  function requestHeaders() {
    return Object.assign({}, STREAM_HEADERS);
  }
  function extractStreams(tmdbId, mediaType, season, episode) {
    return __async(this, null, function* () {
      const pageUrl = embedUrl(mediaType, tmdbId, season, episode);
      const html = yield fetchText(pageUrl, { headers: { "User-Agent": STREAM_HEADERS["User-Agent"] } });
      const token = extractToken(html);
      if (!token)
        throw new Error("no en/token in page");
      const encResp = yield getJson(ENCDEC_API + "/enc-vidfast?text=" + encodeURIComponent(token));
      if (!encResp || encResp.status !== 200) {
        throw new Error("enc-vidfast failed: " + (encResp && encResp.error || JSON.stringify(encResp).slice(0, 120)));
      }
      const boot = encResp.result || {};
      if (!boot.servers || !boot.stream)
        throw new Error("enc-vidfast missing servers/stream");
      const reqHeaders = requestHeaders();
      if (boot.token)
        reqHeaders["X-CSRF-Token"] = boot.token;
      const servEnc = yield postText(boot.servers, reqHeaders);
      if (!servEnc)
        throw new Error("empty servers response");
      const serversRaw = yield decryptBlob(servEnc);
      let servers = typeof serversRaw === "string" ? JSON.parse(serversRaw) : serversRaw;
      if (!Array.isArray(servers))
        servers = [];
      const results = yield Promise.allSettled(
        servers.map(function(s) {
          return resolveServer(boot.stream, s);
        })
      );
      const out = [];
      for (let i = 0; i < servers.length; i++) {
        const r = results[i];
        if (r && r.status === "fulfilled") {
          for (const s of r.value)
            out.push(s);
        } else {
          const reason = r && r.reason && r.reason.message ? r.reason.message : String(r && r.reason);
          console.log("[Vidfast] " + (servers[i] && servers[i].name ? servers[i].name : "server" + i) + ": " + reason);
        }
      }
      if (out.length === 0)
        throw new Error("no vidfast streams resolved");
      out.sort(function(a, b) {
        return qualityRank(b.quality) - qualityRank(a.quality);
      });
      for (let i = 0; i < out.length; i++) {
        const nn = (i + 1 < 10 ? "0" : "") + (i + 1);
        out[i].title = nn + ". " + out[i].title + (out[i].quality ? " \u2022 " + out[i].quality : "");
      }
      return out;
    });
  }
  var SITE, ENCDEC_API, STREAM_HEADERS;
  var init_extractor = __esm({
    "src/vidfast/extractor.js"() {
      SITE = "https://vidfast.vc";
      ENCDEC_API = "https://enc-dec.app/api";
      STREAM_HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
        "Referer": "https://vidfast.vc/"
      };
    }
  });

  // src/vidfast/index.js
  var require_vidfast = __commonJS({
    "src/vidfast/index.js"(exports, module) {
      init_extractor();
      function getStreams(tmdbId, mediaType, season, episode) {
        return __async(this, null, function* () {
          try {
            console.log(`[Vidfast] Request: ${mediaType} ${tmdbId} S${season || "-"}E${episode || "-"}`);
            const streams = yield extractStreams(tmdbId, mediaType, season, episode);
            console.log(`[Vidfast] Found ${streams.length} stream(s)`);
            return streams;
          } catch (error) {
            const msg = error && error.message || String(error);
            const stackTop = error && error.stack ? String(error.stack).split("\n")[0] : "";
            console.error(`[Vidfast] Error: ${msg}${stackTop && stackTop !== msg ? " | " + stackTop : ""}`);
            return [];
          }
        });
      }
      module.exports = { getStreams };
    }
  });
  return require_vidfast();
})();

if (typeof globalThis !== 'undefined') { globalThis.getStreams = __videasy.getStreams; }
if (typeof global !== 'undefined') { global.getStreams = __videasy.getStreams; }
if (typeof self !== 'undefined') { self.getStreams = __videasy.getStreams; }
if (typeof module !== 'undefined' && module.exports) { module.exports = __videasy; }

