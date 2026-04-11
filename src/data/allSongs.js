import { normalizeSearchText, splitArtistCredits } from "../utils/artistSearch";
import { englishSongs } from "./englishSongs";
import { hindiSongs } from "./hindiSongs";
import { marathiSongs } from "./marathiSongs";

export { englishSongs, hindiSongs, marathiSongs };

export const allSongs = [...englishSongs, ...hindiSongs, ...marathiSongs];

const DEFAULT_ARTIST_IMAGE =
  "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=600&q=80";

const BROKEN_SPOTIFY_ARTIST_IMAGE_IDS = new Set([
  "ab6761610000e5eb217e2fd0f250f2f6e9f70906",
  "ab6761610000e5eb7645f0f8f4a9f3ca6f6f5f82",
  "ab6761610000e5eb7d44f8e6cf236503d17b4771",
  "ab6761610000e5ebca7612f0dd5db8d0a5e11ad1",
  "ab6761610000e5ebff6d6df9f8ebf1b2d6f2cc4a",
  "ab6761610000e5eb1f9cbf4f20fd74610fb9a909",
  "ab6761610000e5eb7f213f7f84f8fb080a8c8f80",
  "ab6761610000e5ebf19d2a3530d90fe3f263e4d6",
  "ab6761610000e5ebf4ee2ca8f8b7de4d35c0d17f",
  "ab6761610000e5eb9f6d537683495ea35ca2fa02",
  "ab6761610000e5ebf3cf89e3297d482ca3928b70",
  "ab6761610000e5eb983d7ddf4f2c79a59f4beadc",
  "ab6761610000e5eb3d8886758f209263dd4d3462",
  "ab6761610000e5ebd3f138a37671d57b1949e197",
  "ab6761610000e5eb042f0f6f501e0adf7eecca40",
]);

const extractSpotifyImageId = (value = "") => {
  const match = value.match(/ab676161[0-9a-z]+$/i);
  return match?.[0]?.toLowerCase() || "";
};

const sanitizeArtistImage = (image) => {
  const value = (image || "").toString().trim();
  if (!value) return DEFAULT_ARTIST_IMAGE;

  if (/^ab676161[0-9a-z]+$/i.test(value)) {
    return DEFAULT_ARTIST_IMAGE;
  }

  const spotifyId = extractSpotifyImageId(value);
  if (spotifyId && BROKEN_SPOTIFY_ARTIST_IMAGE_IDS.has(spotifyId)) {
    return DEFAULT_ARTIST_IMAGE;
  }

  return value;
};

const artistMetadata = [
  {
    name: "Arijit Singh",
    image:
      "https://static.toiimg.com/thumb/msid-95487792,width-1280,resizemode-4/95487792.jpg",
    role: "Playback Singer",
  },
  {
    name: "Shreya Ghoshal",
    image: "https://images.indianexpress.com/2018/03/shreya-ghoshal-759.jpg",
    role: "Playback Singer",
  },
  {
    name: "A. R. Rahman",
    image:
      "https://indianewengland.com/wp-content/uploads/2019/09/A.R.-Rahman-Pratham.jpg",
    role: "Composer",
  },
  {
    name: "Sonu Nigam",
    image:
      "https://cdn.platinumlist.net/upload/artist/sonu_nigam_392-mobile.jpg",
    role: "Playback Singer",
  },
  {
    name: "Ajay-Atul",
    image:
      "https://th.bing.com/th/id/OIP.9TM7fxT4Zk5VfM7FKKO2sgHaHa?w=170&h=180&c=7&r=0&o=7&dpr=1.7&pid=1.7&rm=3",
    role: "Composer Duo",
  },

  {
    name: "Ed Sheeran",
    image:
      "https://media.koobit.com/ed-sheeran-performs-on-nbcs-today-show-v2-56192-w767.jpg",
    role: "Singer-Songwriter",
  },
  {
    name: "Måneskin",
    image:
      "https://tse4.mm.bing.net/th/id/OIP.5HeKlM7-igYvmA6XRkbaGQHaE8?rs=1&pid=ImgDetMain&o=7&rm=3",
    role: "Band",
  },
  {
    name: "Taylor Swift",
    image: "https://i.scdn.co/image/ab6761610000e5ebe672b5f553298dcdccb0e676",
    role: "Singer-Songwriter",
  },
  {
    name: "Armaan Malik",
    image:
      "https://wallpapers.com/images/hd/performing-armaan-malik-uworlfvi7ug6jg0s.jpg",
    role: "Playback Singer",
  },
  {
    name: "Neha Kakkar",
    image:
      "https://i.pinimg.com/originals/a0/dc/67/a0dc67a1d3b39b7ed15871e21b781750.jpg",
    role: "Playback Singer",
  },
  {
    name: "Pritam",
    image:
      "https://failurebeforesuccess.com/wp-content/uploads/2022/06/10b0af92-c9e6-11eb-b0cf-a00e9b339624_1623773585837-1000x600.jpg",
    role: "Composer",
  },
  {
    name: "Jubin Nautiyal",
    image:
      "https://www.iwmbuzz.com/wp-content/uploads/2021/01/JUBIN-920x518.jpg",
    role: "Playback Singer",
  },
  {
    name: "Atif Aslam",
    image: "https://bollywoodfox.com/wp-content/uploads/2025/10/atif-aslam.jpg",
    role: "Singer",
  },
  {
    name: "Shankar Mahadevan",
    image: "https://i.scdn.co/image/ab6761610000e5eb4e6e46d8d78830e9f73e8479",
    role: "Singer-Composer",
  },
  {
    name: "Sunidhi Chauhan",
    image:
      "https://cdn.platinumlist.net/upload/artist/sunidhi_chauhan_842-mobile1630837066.png",
    role: "Playback Singer",
  },
  {
    name: "Sachet-Parampara",
    image:
      "https://www.socialnews.xyz/wp-content/uploads/2021/11/27/The-celebrated-singers-and-composers-Sachet-Parampara-Tandon-mark-their-1st-anniversary-today-.jpeg",
    role: "Composer Duo",
  },
  {
    name: "Vishal & Shekhar",
    image:
      "https://cdn.platinumlist.net/upload/artist/vishal_shekhar_788-mobile1544453221.jpg",
    role: "Composer Duo",
  },
  {
    name: "Badshah",
    image:
      "https://i0.wp.com/www.socialnews.xyz/wp-content/uploads/2018/09/08/0d65c1f35866a91500513dccf43be8b9.jpg?quality=80&zoom=1&ssl=1",
    role: "Rapper",
  },
  {
    name: "Diljit Dosanjh",
    image:
      "https://www.billboard.com/wp-content/uploads/2024/05/Diljit-Dosanjh-Performs-At-BC-Place-2024-billboard-pro-1260.jpg?w=942&h=623&crop=1",
    role: "Singer",
  },
  {
    name: "Adele",
    image: "https://upload.wikimedia.org/wikipedia/commons/7/7c/Adele_2016.jpg",
    role: "Singer-Songwriter",
  },
  {
    name: "Beyoncé",
    image:
      "https://upload.wikimedia.org/wikipedia/commons/9/90/Beyonce_at_The_Lion_King_European_Premiere_2019.jpg",
    role: "Singer",
  },
  {
    name: "Justin Bieber",
    image:
      "https://upload.wikimedia.org/wikipedia/commons/0/0d/Justin_Bieber_2015.jpg",
    role: "Pop Singer",
  },
  {
    name: "Rihanna",
    image:
      "https://upload.wikimedia.org/wikipedia/commons/3/32/Rihanna_Fenty_2018.png",
    role: "Singer",
  },
  {
    name: "Lady Gaga",
    image:
      "https://upload.wikimedia.org/wikipedia/commons/9/94/Lady_Gaga_2019_by_Glenn_Francis.jpg",
    role: "Singer",
  },
  {
    name: "Dua Lipa",
    image:
      "https://upload.wikimedia.org/wikipedia/commons/f/f8/Dua_Lipa_at_the_Grammy_Museum_2018.png",
    role: "Singer",
  },
  {
    name: "The Weeknd",
    image:
      "https://upload.wikimedia.org/wikipedia/commons/9/95/The_Weeknd_Cannes_2023.png",
    role: "R&B Artist",
  },
  {
    name: "Drake",
    image:
      "https://th.bing.com/th/id/R.f6f6ea585a9ad739317665f1962356e9?rik=CiVwqLZWMwqmdw&riu=http%3a%2f%2fwww.iheartradio.ca%2fcontent%2fdam%2faudio%2fuploadImg%2fmigrated%2fmusic_news%2f2021%2f12%2f2%2fdrake-1-16613411.jpg&ehk=K8YxaJXlaTGH79vc91qo8WMI5DeGZAnwLmHvfbWBC%2bA%3d&risl=&pid=ImgRaw&r=0",
    role: "Rapper",
  },
  {
    name: "Eminem",
    image:
      "https://upload.wikimedia.org/wikipedia/commons/b/b4/Eminem_2021.jpg",
    role: "Rapper",
  },
  {
    name: "Sia",
    image: "https://upload.wikimedia.org/wikipedia/commons/9/90/Sia_2016.jpg",
    role: "Singer-Songwriter",
  },
  {
    name: "Charlie Puth",
    image:
      "https://upload.wikimedia.org/wikipedia/commons/6/60/Charlie_Puth_2017.jpg",
    role: "Singer-Songwriter",
  },
  {
    name: "Shawn Mendes",
    image:
      "https://upload.wikimedia.org/wikipedia/commons/f/f0/Shawn_Mendes_in_2018.jpg",
    role: "Singer-Songwriter",
  },
  {
    name: "Camila Cabello",
    image:
      "https://upload.wikimedia.org/wikipedia/commons/4/4a/Camila_Cabello_2019_%28cropped%29.jpg",
    role: "Singer",
  },
  {
    name: "Billie Eilish",
    image:
      "https://upload.wikimedia.org/wikipedia/commons/d/d3/Billie_Eilish_2019_by_Glenn_Francis.jpg",
    role: "Singer-Songwriter",
  },
  {
    name: "Selena Gomez",
    image:
      "https://upload.wikimedia.org/wikipedia/commons/3/33/Selena_Gomez_2017.jpg",
    role: "Singer",
  },
  {
    name: "Coldplay",
    image:
      "https://upload.wikimedia.org/wikipedia/commons/0/09/ColdplayBBC071221_%28cropped%29.jpg",
    role: "Band",
  },
  {
    name: "Kishore Kumar",
    image:
      "https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=600&q=80",
    role: "Legend",
  },
  {
    name: "Lata Mangeshkar",
    image:
      "https://th.bing.com/th/id/OIP.3xFuS5gE6xsxqwQj5R7DNgHaHa?w=179&h=180&c=7&r=0&o=7&dpr=1.7&pid=1.7&rm=3",
    role: "Legend",
  },
];

export const getArtistsFromSongs = (songs = allSongs) => {
  const artistMap = new Map();

  songs.forEach((song) => {
    const artistNames = splitArtistCredits(song.artist || "");
    const fallbackNames = artistNames.length
      ? artistNames
      : [song.artist || ""];

    fallbackNames.forEach((artistName) => {
      if (!artistName) return;

      const normalizedName = normalizeSearchText(artistName);
      if (!normalizedName || artistMap.has(normalizedName)) return;

      artistMap.set(normalizedName, {
        name: artistName,
        image: sanitizeArtistImage(song.cover),
        role: "Artist",
      });
    });
  });

  return Array.from(artistMap.values()).sort((a, b) =>
    (a.name || "").localeCompare(b.name || ""),
  );
};

const staticArtists = artistMetadata.map((artist) => ({
  ...artist,
  image: sanitizeArtistImage(artist.image),
  role: artist.role || "Artist",
}));

export const artists = [
  ...staticArtists,
  ...getArtistsFromSongs(allSongs),
].filter(
  (artist, index, list) =>
    list.findIndex(
      (item) =>
        normalizeSearchText(item.name || "") ===
        normalizeSearchText(artist.name || ""),
    ) === index,
);
