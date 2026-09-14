/* ============================================================
   Wottle mock data — Icelandic letters, sample boards, players
   ============================================================ */

// Icelandic letter scoring (approximate — for visual fidelity)
const LETTER_VALUES = {
  A: 1, Á: 4, B: 6, D: 4, Ð: 2, E: 1, É: 6, F: 3, G: 2, H: 3,
  I: 1, Í: 4, J: 5, K: 2, L: 2, M: 2, N: 1, O: 3, Ó: 6, P: 8,
  R: 1, S: 1, T: 1, U: 1, Ú: 8, V: 3, X: 10, Y: 7, Ý: 9, Þ: 4,
  Æ: 5, Ö: 7,
};

const WINDOW_WIDTH = typeof window !== "undefined" ? window.innerWidth : 1400;

// Deterministic 10x10 sample board with seeded words hidden in it
const SAMPLE_BOARD = [
  ["H","E","S","T","U","R","A","N","I","M"],
  ["Á","R","K","E","T","O","L","L","V","A"],
  ["F","I","S","K","U","R","E","O","Í","K"],
  ["S","T","E","I","N","N","J","A","G","L"],
  ["B","A","R","N","Á","R","A","K","T","Ö"],
  ["M","A","Ð","U","R","I","F","L","E","R"],
  ["H","Ú","S","L","E","N","V","A","T","N"],
  ["Ó","L","A","F","R","E","K","U","R","S"],
  ["Þ","A","K","G","L","A","T","U","R","Ö"],
  ["É","G","S","V","A","N","U","R","Á","P"],
];

// Frozen tiles from prior rounds (coords as "x,y")
// p1 = ochre/you, p2 = slate/opponent
const FROZEN = {
  "0,0": "p1", "1,0": "p1", "2,0": "p1", "3,0": "p1", "4,0": "p1", "5,0": "p1", // HESTUR
  "2,3": "p2", "2,4": "p2", "2,5": "p2", "2,6": "p2", "2,7": "p2",                 // SEÐSA-ish vertical
  "0,2": "p1", "0,3": "p1", "0,4": "p1",                                           // FSB
  "6,5": "both",                                                                   // shared letter
  "7,2": "p2", "7,3": "p2", "7,4": "p2", "7,5": "p2",                              // vertical p2
  "4,7": "p1", "5,7": "p1", "6,7": "p1",                                           // ERE
};

// Recent words (right-panel "Round history")
const ROUND_HISTORY = [
  { r: 7, player: "p1", words: ["MAÐUR", "AKUR"], pts: 28 },
  { r: 6, player: "p2", words: ["FISKUR"], pts: 19 },
  { r: 6, player: "p1", words: ["HÚS"], pts: 7 },
  { r: 5, player: "p2", words: ["STEINN", "ALL"], pts: 34 },
  { r: 4, player: "p1", words: ["HESTUR"], pts: 22 },
  { r: 3, player: "p2", words: ["ÁR"], pts: 5 },
  { r: 2, player: "p1", words: ["BARN", "LAND"], pts: 16 },
  { r: 1, player: "p2", words: ["VATN"], pts: 8 },
];

// Lobby players (warm Icelandic-ish + some international mix)
const LOBBY_PLAYERS = [
  { name: "Sigríður Pálsdóttir",   handle: "sigga",     elo: 1842, status: "available", wins: 128, losses: 94,  queueing: false },
  { name: "Jón Kristjánsson",      handle: "jonsi",     elo: 1710, status: "queueing",  wins: 84,  losses: 77,  queueing: true  },
  { name: "Margrét Eiríksdóttir",  handle: "maggi",     elo: 1655, status: "available", wins: 67,  losses: 58,  queueing: false },
  { name: "Hallgrímur Pétursson",  handle: "halli",     elo: 2014, status: "available", wins: 302, losses: 188, queueing: false },
  { name: "Bryndís Aradóttir",     handle: "bryn",      elo: 1588, status: "in-game",   wins: 41,  losses: 49,  queueing: false },
  { name: "Ólafur Ragnar",         handle: "oli",       elo: 1420, status: "available", wins: 19,  losses: 22,  queueing: false },
  { name: "Katrín Jónsdóttir",     handle: "katla",     elo: 1770, status: "queueing",  wins: 112, losses: 88,  queueing: true  },
  { name: "Þórarinn Eldjárn",      handle: "thori",     elo: 1930, status: "available", wins: 201, losses: 156, queueing: false },
  { name: "Elín Björk",            handle: "elin",      elo: 1612, status: "available", wins: 58,  losses: 44,  queueing: false },
  { name: "Gunnar Hafsteinsson",   handle: "gunni",     elo: 1488, status: "in-game",   wins: 31,  losses: 35,  queueing: false },
  { name: "Steinunn Sig.",         handle: "stella",    elo: 1684, status: "available", wins: 77,  losses: 62,  queueing: false },
  { name: "Davíð Oddsson",         handle: "david",     elo: 1555, status: "available", wins: 44,  losses: 48,  queueing: false },
];

const CURRENT_USER = {
  name: "Ásta Kristín",
  handle: "asta",
  elo: 1728,
  wins: 146,
  losses: 112,
  draws: 14,
  bestWord: "SKÓGURINN",
  bestWordPts: 62,
};

// Mini rating history for profile sparkline
const RATING_HISTORY = [
  1500, 1512, 1498, 1522, 1530, 1518, 1540, 1564, 1550, 1578,
  1602, 1588, 1615, 1640, 1628, 1655, 1672, 1688, 1710, 1695,
  1720, 1735, 1712, 1728,
];

const RECENT_GAMES = [
  { result: "win",  opp: "halli",  score: "312 – 278", words: 18, d: "2h ago" },
  { result: "loss", opp: "thori",  score: "244 – 301", words: 14, d: "5h ago" },
  { result: "win",  opp: "maggi",  score: "268 – 220", words: 17, d: "yesterday" },
  { result: "win",  opp: "elin",   score: "295 – 180", words: 19, d: "yesterday" },
  { result: "draw", opp: "stella", score: "210 – 210", words: 12, d: "2d ago" },
  { result: "loss", opp: "katla",  score: "198 – 244", words: 11, d: "3d ago" },
];

// helper
function letterValue(ch) {
  const up = (ch || "").toUpperCase();
  return LETTER_VALUES[up] ?? 1;
}

Object.assign(window, {
  LETTER_VALUES, SAMPLE_BOARD, FROZEN, ROUND_HISTORY,
  LOBBY_PLAYERS, CURRENT_USER, RATING_HISTORY, RECENT_GAMES,
  letterValue,
});
