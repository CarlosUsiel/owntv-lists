/**
 * AnimeSlayer, Arabic anime (animeslayer.to) - OwnTV provider pack - STUB, returns no streams
 *
 * AnimeSlayer's search API still answers, but the episode server list goes through a second host
 * (patrimoines-en-mouvement.org/lib/flare/v3.php, 503 on 2026-10-04) and its MEGA servers are played through a local
 * HTTP proxy that decrypts MEGA's AES-CTR streams, which a sandboxed plugin cannot be.
 *
 * Reference: PlayTorrio's AnimeArabicService / AnimeArabicExtractor / MegaProxy (https://github.com/ayman708-UX/
 * PlayTorrioV3, lib/services/anime_arabic/), GPL-3.0. Contract: Nuvio provider (getStreams(tmdbId, mediaType,
 * season, episode) -> streams[]).
 */
async function getStreams(tmdbId, mediaType, season, episode) {
  return [];
}

module.exports = { getStreams };
