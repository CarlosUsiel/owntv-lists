// copied from https://github.com/ahmedelkassrawy/nuvio-providers@6ffcfa8f0e21 (providers/rivestream.js), no licence stated by the repository; the original file follows unchanged.
var __getOwnPropNames = Object.getOwnPropertyNames;
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

// src/_lib/dedup.js
var require_dedup = __commonJS({
  "src/_lib/dedup.js"(exports2, module2) {
    function dedupByUrl2(streams) {
      const seen = /* @__PURE__ */ new Set();
      const out = [];
      for (const s of streams) {
        if (!s || !s.url || seen.has(s.url)) continue;
        seen.add(s.url);
        out.push(s);
      }
      return out;
    }
    var RANK = { "4K": 5, "2160p": 5, "1080p": 4, "720p": 3, "480p": 2, "CAM": 1 };
    function sortByQuality2(streams) {
      return streams.slice().sort((a, b) => (RANK[b.quality] || 0) - (RANK[a.quality] || 0));
    }
    function parseQuality(s) {
      const t = String(s || "");
      if (/2160|\b4k\b|uhd/i.test(t)) return "2160p";
      if (/1080/.test(t)) return "1080p";
      if (/720/.test(t)) return "720p";
      if (/480/.test(t)) return "480p";
      if (/\bcam\b/i.test(t)) return "CAM";
      return "Auto";
    }
    module2.exports = { dedupByUrl: dedupByUrl2, sortByQuality: sortByQuality2, parseQuality };
  }
});

// src/_lib/http.js
var require_http = __commonJS({
  "src/_lib/http.js"(exports2, module2) {
    function timeout(ms) {
      return new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms));
    }
    function fetchT2(url, opts, ms) {
      return Promise.race([fetch(url, opts), timeout(ms || 8e3)]);
    }
    function fetchTextT(url, opts, ms) {
      const work = (() => __async(this, null, function* () {
        const res = yield fetch(url, opts);
        const text = yield res.text();
        return { ok: res.ok, status: res.status, text, url: res.url };
      }))();
      return Promise.race([work, timeout(ms || 8e3)]);
    }
    module2.exports = { fetchT: fetchT2, fetchTextT };
  }
});

// src/rivestream.js
var { dedupByUrl, sortByQuality } = require_dedup();
var { fetchT } = require_http();
var API = "https://scrapper.rivestream.app";
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
var HEADERS = { "User-Agent": UA, Referer: "https://www.rivestream.app/", Origin: "https://www.rivestream.app", Accept: "application/json, text/plain, */*" };
var FALLBACK = ["apex", "pulse", "solstice", "quasar", "primevids", "flowcast", "citadel", "guru", "asiacloud", "horizon", "hindicast"];
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    const out = [];
    const seen = /* @__PURE__ */ new Set();
    try {
      const isTv = mediaType === "tv";
      let providers = FALLBACK;
      try {
        const r = yield fetchT(`${API}/api/providers`, { headers: HEADERS }, 3e3);
        if (r.ok) {
          const d = yield r.json();
          if (d && Array.isArray(d.data)) providers = d.data.map(String);
          else if (Array.isArray(d)) providers = d.map(String);
        }
      } catch (e) {
      }
      const cb = Math.floor(Date.now() / 3e6);
      yield Promise.all(providers.map((provider) => __async(this, null, function* () {
        try {
          const cbParam = provider === "primevids" || provider === "citadel" ? `&cb=${cb}` : "";
          const ep = isTv ? `${API}/api/provider?provider=${provider}&id=${tmdbId}&season=${season || 1}&episode=${episode || 1}${cbParam}` : `${API}/api/provider?provider=${provider}&id=${tmdbId}${cbParam}`;
          const res = yield fetchT(ep, { headers: HEADERS }, 7e3);
          if (!res.ok) return;
          const data = yield res.json();
          const sources = data && data.data && data.data.sources;
          if (!Array.isArray(sources)) return;
          for (const src of sources) {
            const url = String(src && src.url || "").trim();
            if (!url || !url.startsWith("http") || seen.has(url)) continue;
            seen.add(url);
            const srcName = src.source || provider;
            const q = src.quality || "Auto";
            out.push({
              name: `Rive:${srcName}`,
              title: `[Rive - ${srcName}] ${q}`,
              url,
              quality: q,
              headers: { "User-Agent": UA, Referer: "https://www.rivestream.app/", Origin: "https://www.rivestream.app" }
            });
          }
        } catch (e) {
        }
      })));
    } catch (e) {
    }
    return sortByQuality(dedupByUrl(out));
  });
}
module.exports = { getStreams };
