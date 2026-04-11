export const normalizeSearchText = (value = "") =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const splitArtistCredits = (artistCredit = "") => {
  if (!artistCredit) return [];

  return artistCredit
    .replace(/\b(feat\.?|ft\.?|featuring|with|x)\b/gi, ",")
    .replace(/\s+(and|&)\s+/gi, ",")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
};

// Original exact matching (keep for reference)
export const songHasArtistExact = (songArtistCredit = "", artistName = "") => {
  const normalizedArtist = normalizeSearchText(artistName);
  if (!normalizedArtist) return false;

  const splitArtists = splitArtistCredits(songArtistCredit);
  if (splitArtists.length === 0) {
    return normalizeSearchText(songArtistCredit).includes(normalizedArtist);
  }

  return splitArtists.some(
    (name) => normalizeSearchText(name) === normalizedArtist,
  );
};

// Fuzzy matching for song counts - more lenient
export const songHasArtistFuzzy = (songArtistCredit = "", artistName = "") => {
  const normalizedArtist = normalizeSearchText(artistName);
  if (!normalizedArtist) return false;

  const normalizedSongArtist = normalizeSearchText(songArtistCredit);

  // Check if artist name is contained in song artist (fuzzy)
  return normalizedSongArtist.includes(normalizedArtist);
};
