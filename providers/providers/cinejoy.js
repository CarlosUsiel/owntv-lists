/**
 * CineJoy (cinejoy.to) - OwnTV provider pack - STUB, returns no streams
 *
 * CineJoy's player asks api.shegu.st for its streams through a sealed channel: an ECDH P-256 key agreement with a
 * fixed server key, HKDF-SHA256 key derivation and AES-256-GCM, with a binary request and response body. OwnTV's
 * plugin host has neither ECDH nor AES-GCM, and its fetch is text only, so this cannot run there. It is also down:
 * api.shegu.st answered 502 on 2026-10-04 (an exact Node port of PlayTorrio's CinejoyScraper was tried).
 *
 * Reference: PlayTorrio's CinejoyScraper (https://github.com/ayman708-UX/PlayTorrioV3, lib/services/scraper/sites/
 * cinejoy.dart), GPL-3.0. Contract: Nuvio provider (getStreams(tmdbId, mediaType, season, episode) -> streams[]).
 */
async function getStreams(tmdbId, mediaType, season, episode) {
  return [];
}

module.exports = { getStreams };
