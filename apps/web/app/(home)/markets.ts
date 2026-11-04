/**
 * The stores the homepage shows, by the visitor's country: the countries we
 * know best (the top twenty, the Nordics and more of Latin America), a set for the rest of their
 * region, and a global one. Each store's icon is its official app icon
 * (public/merchants, from the App Store), or its logo where it has no app
 * (the site's own icon for Komplett and Verkkokauppa.com; Google Play's for
 * Rappi, Oda and Magalu, whose App Store icons are dressed up for the season).
 * The landing reads the country from Vercel's geolocation header;
 * `?country=XX` overrides it.
 */

/** What a store is for, which picks what you'd ask for there. */
export type Kind =
  | "marketplace"
  | "delivery"
  | "grocery"
  | "restaurant"
  | "fashion";

/** The parts the homepage casts a store in. */
export type Role =
  | "marketplace"
  | "delivery"
  | "grocery"
  | "restaurant"
  | "tables"
  | "tickets"
  | "fashion";

/** Every store, by id: its name as written, and what it's for. */
const STORES = {
  amazon: { name: "Amazon", kind: "marketplace" },
  doordash: { name: "DoorDash", kind: "delivery" },
  ubereats: { name: "Uber Eats", kind: "delivery" },
  starbucks: { name: "Starbucks", kind: "restaurant" },
  nike: { name: "Nike", kind: "fashion" },
  spotify: { name: "Spotify", kind: "marketplace" },
  netflix: { name: "Netflix", kind: "marketplace" },
  ikea: { name: "IKEA", kind: "marketplace" },
  target: { name: "Target", kind: "marketplace" },
  etsy: { name: "Etsy", kind: "marketplace" },
  walmart: { name: "Walmart", kind: "grocery" },
  opentable: { name: "OpenTable", kind: "restaurant" },
  instacart: { name: "Instacart", kind: "grocery" },
  youtube: { name: "YouTube", kind: "marketplace" },
  hellofresh: { name: "HelloFresh", kind: "grocery" },
  eventbrite: { name: "Eventbrite", kind: "marketplace" },
  dominos: { name: "Domino's", kind: "restaurant" },
  newbalance: { name: "New Balance", kind: "fashion" },
  allbirds: { name: "Allbirds", kind: "fashion" },
  playstation: { name: "PlayStation", kind: "marketplace" },
  ebay: { name: "eBay", kind: "marketplace" },
  aliexpress: { name: "AliExpress", kind: "marketplace" },
  mcdonalds: { name: "McDonald's", kind: "restaurant" },
  burgerking: { name: "Burger King", kind: "restaurant" },
  kfc: { name: "KFC", kind: "restaurant" },
  fever: { name: "Fever", kind: "marketplace" },
  zalando: { name: "Zalando", kind: "fashion" },
  carrefour: { name: "Carrefour", kind: "grocery" },
  shopee: { name: "Shopee", kind: "marketplace" },
  uniqlo: { name: "UNIQLO", kind: "fashion" },
  rakuten: { name: "楽天市場", kind: "marketplace" },
  swiggy: { name: "Swiggy", kind: "delivery" },
  vinted: { name: "Vinted", kind: "fashion" },
  lidl: { name: "Lidl", kind: "grocery" },
  justeat: { name: "Just Eat", kind: "delivery" },
  deliveroo: { name: "Deliveroo", kind: "delivery" },
  tesco: { name: "Tesco", kind: "grocery" },
  asos: { name: "ASOS", kind: "fashion" },
  handm: { name: "H&M", kind: "fashion" },
  zara: { name: "Zara", kind: "fashion" },
  glovo: { name: "Glovo", kind: "delivery" },
  mercadona: { name: "Mercadona", kind: "grocery" },
  vicio: { name: "Vicio", kind: "restaurant" },
  thefork: { name: "TheFork", kind: "restaurant" },
  fnac: { name: "Fnac", kind: "marketplace" },
  leboncoin: { name: "leboncoin", kind: "marketplace" },
  otto: { name: "OTTO", kind: "marketplace" },
  rewe: { name: "REWE", kind: "grocery" },
  lieferando: { name: "Lieferando", kind: "delivery" },
  albertheijn: { name: "Albert Heijn", kind: "grocery" },
  picnic: { name: "Picnic", kind: "grocery" },
  bol: { name: "bol", kind: "marketplace" },
  thuisbezorgd: { name: "Thuisbezorgd", kind: "delivery" },
  esselunga: { name: "Esselunga", kind: "grocery" },
  worten: { name: "Worten", kind: "marketplace" },
  continente: { name: "Continente", kind: "grocery" },
  allegro: { name: "Allegro", kind: "marketplace" },
  pyszne: { name: "Pyszne.pl", kind: "delivery" },
  zabka: { name: "Żabka", kind: "grocery" },
  foodora: { name: "foodora", kind: "delivery" },
  wolt: { name: "Wolt", kind: "delivery" },
  ica: { name: "ICA", kind: "grocery" },
  max: { name: "Max", kind: "restaurant" },
  elgiganten: { name: "Elgiganten", kind: "marketplace" },
  komplett: { name: "Komplett", kind: "marketplace" },
  oda: { name: "Oda", kind: "grocery" },
  peppes: { name: "Peppes Pizza", kind: "restaurant" },
  nemlig: { name: "nemlig.com", kind: "grocery" },
  joe: { name: "Joe & The Juice", kind: "restaurant" },
  verkkokauppa: { name: "Verkkokauppa.com", kind: "marketplace" },
  skaupat: { name: "S-kaupat", kind: "grocery" },
  hesburger: { name: "Hesburger", kind: "restaurant" },
  flipkart: { name: "Flipkart", kind: "marketplace" },
  myntra: { name: "Myntra", kind: "fashion" },
  zomato: { name: "Zomato", kind: "delivery" },
  blinkit: { name: "Blinkit", kind: "grocery" },
  bookmyshow: { name: "BookMyShow", kind: "marketplace" },
  mercadolibre: { name: "Mercado Libre", kind: "marketplace" },
  mercadolivre: { name: "Mercado Livre", kind: "marketplace" },
  rappi: { name: "Rappi", kind: "delivery" },
  ifood: { name: "iFood", kind: "delivery" },
  magalu: { name: "Magalu", kind: "marketplace" },
  pedidosya: { name: "PedidosYa", kind: "delivery" },
  exito: { name: "Éxito", kind: "grocery" },
  falabella: { name: "Falabella", kind: "fashion" },
  lider: { name: "Líder", kind: "grocery" },
  tottus: { name: "Tottus", kind: "grocery" },
  bembos: { name: "Bembos", kind: "restaurant" },
  supermaxi: { name: "Supermaxi", kind: "grocery" },
  deprati: { name: "De Prati", kind: "fashion" },
  tiendainglesa: { name: "Tienda Inglesa", kind: "grocery" },
  automercado: { name: "Auto Mercado", kind: "grocery" },
  super99: { name: "Super 99", kind: "grocery" },
  nacional: { name: "Nacional", kind: "grocery" },
  campero: { name: "Pollo Campero", kind: "restaurant" },
  siman: { name: "Siman", kind: "fashion" },
  timhortons: { name: "Tim Hortons", kind: "restaurant" },
  canadiantire: { name: "Canadian Tire", kind: "marketplace" },
  woolworths: { name: "Woolworths", kind: "grocery" },
  coles: { name: "Coles", kind: "grocery" },
  kmart: { name: "Kmart", kind: "marketplace" },
  theiconic: { name: "THE ICONIC", kind: "fashion" },
  coupang: { name: "쿠팡", kind: "marketplace" },
  baemin: { name: "배달의민족", kind: "delivery" },
  kurly: { name: "컬리", kind: "grocery" },
  musinsa: { name: "무신사", kind: "fashion" },
  naver: { name: "네이버", kind: "marketplace" },
  nol: { name: "NOL 티켓", kind: "marketplace" },
  mercari: { name: "メルカリ", kind: "marketplace" },
  demaecan: { name: "出前館", kind: "delivery" },
  tabelog: { name: "食べログ", kind: "restaurant" },
  pia: { name: "チケットぴあ", kind: "marketplace" },
  grab: { name: "Grab", kind: "delivery" },
} as const satisfies Record<string, { name: string; kind: Kind }>;

export type StoreId = keyof typeof STORES;

/** Stores shown by their official logo: no app, or an app that isn't the store's own brand (Lidl Plus). */
const LOGOS: Partial<Record<StoreId, string>> = {
  vicio: "/merchants/vicio.png",
  allbirds: "/stores/allbirds.png",
  newbalance: "/stores/newbalance.svg",
  ifood: "/merchants/ifood.svg",
  elgiganten: "/merchants/elgiganten.png",
  lidl: "/merchants/lidl.svg",
};

export interface Merchant {
  id: StoreId;
  name: string;
  kind: Kind;
  logo: string;
}

export function merchant(id: StoreId): Merchant {
  return {
    id,
    ...STORES[id],
    logo: LOGOS[id] ?? `/merchants/${id}.png`,
  };
}

interface Plan {
  /** The currency prices show in; none to follow the page's language. */
  currency: string | null;
  roles: Record<Role, StoreId>;
  /**
   * The six stores floating around the hero's headline: phones show the
   * first, second, fifth and sixth, so Amazon (where it has a store) and the
   * local favorites go there, and Spotify takes the fourth, on wide screens only.
   */
  featured: readonly [StoreId, StoreId, StoreId, StoreId, StoreId, StoreId];
  /** Stores that drop into the hero's empty tiles now and then. */
  ghosts: readonly StoreId[];
}

const PLANS = {
  US: {
    currency: "USD",
    roles: {
      marketplace: "amazon",
      delivery: "ubereats",
      grocery: "instacart",
      restaurant: "dominos",
      tables: "opentable",
      tickets: "eventbrite",
      fashion: "nike",
    },
    featured: [
      "amazon",
      "doordash",
      "ubereats",
      "spotify",
      "starbucks",
      "nike",
    ],
    ghosts: [
      "netflix",
      "target",
      "etsy",
      "walmart",
      "opentable",
      "instacart",
      "youtube",
      "hellofresh",
      "playstation",
      "ikea",
    ],
  },
  CA: {
    currency: "CAD",
    roles: {
      marketplace: "amazon",
      delivery: "ubereats",
      grocery: "instacart",
      restaurant: "timhortons",
      tables: "opentable",
      tickets: "eventbrite",
      fashion: "zara",
    },
    featured: [
      "amazon",
      "doordash",
      "timhortons",
      "spotify",
      "canadiantire",
      "instacart",
    ],
    ghosts: [
      "ubereats",
      "walmart",
      "netflix",
      "ikea",
      "starbucks",
      "eventbrite",
      "etsy",
      "zara",
    ],
  },
  MX: {
    currency: "MXN",
    roles: {
      marketplace: "mercadolibre",
      delivery: "rappi",
      grocery: "walmart",
      restaurant: "dominos",
      tables: "opentable",
      tickets: "fever",
      fashion: "zara",
    },
    featured: [
      "amazon",
      "mercadolibre",
      "walmart",
      "spotify",
      "rappi",
      "ubereats",
    ],
    ghosts: [
      "zara",
      "starbucks",
      "netflix",
      "fever",
      "dominos",
      "kfc",
      "aliexpress",
      "mcdonalds",
    ],
  },
  BR: {
    currency: "BRL",
    roles: {
      marketplace: "mercadolivre",
      delivery: "ifood",
      grocery: "carrefour",
      restaurant: "mcdonalds",
      tables: "opentable",
      tickets: "fever",
      fashion: "zara",
    },
    featured: [
      "amazon",
      "mercadolivre",
      "magalu",
      "spotify",
      "ifood",
      "shopee",
    ],
    ghosts: [
      "carrefour",
      "netflix",
      "mcdonalds",
      "aliexpress",
      "fever",
      "burgerking",
      "zara",
      "nike",
    ],
  },
  AR: {
    currency: "USD",
    roles: {
      marketplace: "mercadolibre",
      delivery: "pedidosya",
      grocery: "carrefour",
      restaurant: "mcdonalds",
      tables: "opentable",
      tickets: "fever",
      fashion: "zara",
    },
    featured: [
      "mercadolibre",
      "pedidosya",
      "rappi",
      "spotify",
      "carrefour",
      "mcdonalds",
    ],
    ghosts: ["netflix", "burgerking", "starbucks", "zara", "aliexpress", "kfc"],
  },
  CO: {
    currency: "COP",
    roles: {
      marketplace: "mercadolibre",
      delivery: "rappi",
      grocery: "exito",
      restaurant: "mcdonalds",
      tables: "opentable",
      tickets: "fever",
      fashion: "falabella",
    },
    featured: [
      "rappi",
      "mercadolibre",
      "exito",
      "spotify",
      "falabella",
      "mcdonalds",
    ],
    ghosts: ["netflix", "starbucks", "kfc", "burgerking", "zara", "aliexpress"],
  },
  CL: {
    currency: "CLP",
    roles: {
      marketplace: "mercadolibre",
      delivery: "pedidosya",
      grocery: "lider",
      restaurant: "mcdonalds",
      tables: "opentable",
      tickets: "fever",
      fashion: "falabella",
    },
    featured: [
      "mercadolibre",
      "pedidosya",
      "lider",
      "spotify",
      "falabella",
      "ubereats",
    ],
    ghosts: [
      "netflix",
      "starbucks",
      "rappi",
      "zara",
      "aliexpress",
      "mcdonalds",
    ],
  },
  PE: {
    currency: "PEN",
    roles: {
      marketplace: "mercadolibre",
      delivery: "rappi",
      grocery: "tottus",
      restaurant: "bembos",
      tables: "opentable",
      tickets: "eventbrite",
      fashion: "falabella",
    },
    featured: [
      "rappi",
      "mercadolibre",
      "tottus",
      "spotify",
      "falabella",
      "bembos",
    ],
    ghosts: [
      "netflix",
      "kfc",
      "starbucks",
      "burgerking",
      "mcdonalds",
      "aliexpress",
      "zara",
    ],
  },
  EC: {
    currency: "USD",
    roles: {
      marketplace: "mercadolibre",
      delivery: "pedidosya",
      grocery: "supermaxi",
      restaurant: "kfc",
      tables: "opentable",
      tickets: "eventbrite",
      fashion: "deprati",
    },
    featured: [
      "pedidosya",
      "supermaxi",
      "rappi",
      "spotify",
      "mercadolibre",
      "kfc",
    ],
    ghosts: [
      "netflix",
      "deprati",
      "mcdonalds",
      "burgerking",
      "aliexpress",
      "youtube",
    ],
  },
  UY: {
    currency: "UYU",
    roles: {
      marketplace: "mercadolibre",
      delivery: "pedidosya",
      grocery: "tiendainglesa",
      restaurant: "mcdonalds",
      tables: "opentable",
      tickets: "eventbrite",
      fashion: "zara",
    },
    featured: [
      "pedidosya",
      "mercadolibre",
      "tiendainglesa",
      "spotify",
      "rappi",
      "mcdonalds",
    ],
    ghosts: ["netflix", "zara", "burgerking", "aliexpress", "youtube"],
  },
  CR: {
    currency: "CRC",
    roles: {
      marketplace: "amazon",
      delivery: "ubereats",
      grocery: "automercado",
      restaurant: "kfc",
      tables: "opentable",
      tickets: "eventbrite",
      fashion: "siman",
    },
    featured: ["ubereats", "automercado", "rappi", "spotify", "amazon", "kfc"],
    ghosts: [
      "walmart",
      "netflix",
      "starbucks",
      "mcdonalds",
      "siman",
      "aliexpress",
    ],
  },
  PA: {
    currency: "USD",
    roles: {
      marketplace: "amazon",
      delivery: "pedidosya",
      grocery: "super99",
      restaurant: "mcdonalds",
      tables: "opentable",
      tickets: "eventbrite",
      fashion: "zara",
    },
    featured: [
      "pedidosya",
      "super99",
      "ubereats",
      "spotify",
      "amazon",
      "mcdonalds",
    ],
    ghosts: ["netflix", "zara", "kfc", "starbucks", "aliexpress", "burgerking"],
  },
  DO: {
    currency: "DOP",
    roles: {
      marketplace: "amazon",
      delivery: "pedidosya",
      grocery: "nacional",
      restaurant: "kfc",
      tables: "opentable",
      tickets: "eventbrite",
      fashion: "zara",
    },
    featured: ["pedidosya", "nacional", "ubereats", "spotify", "amazon", "kfc"],
    ghosts: ["netflix", "zara", "burgerking", "mcdonalds", "aliexpress"],
  },
  GT: {
    currency: "GTQ",
    roles: {
      marketplace: "amazon",
      delivery: "pedidosya",
      grocery: "walmart",
      restaurant: "campero",
      tables: "opentable",
      tickets: "eventbrite",
      fashion: "siman",
    },
    featured: [
      "campero",
      "pedidosya",
      "walmart",
      "spotify",
      "ubereats",
      "mcdonalds",
    ],
    ghosts: [
      "netflix",
      "siman",
      "starbucks",
      "burgerking",
      "aliexpress",
      "amazon",
    ],
  },
  GB: {
    currency: "GBP",
    roles: {
      marketplace: "amazon",
      delivery: "deliveroo",
      grocery: "tesco",
      restaurant: "mcdonalds",
      tables: "opentable",
      tickets: "fever",
      fashion: "asos",
    },
    featured: ["amazon", "deliveroo", "tesco", "spotify", "justeat", "asos"],
    ghosts: [
      "ubereats",
      "ebay",
      "netflix",
      "ikea",
      "starbucks",
      "fever",
      "vinted",
      "mcdonalds",
      "playstation",
    ],
  },
  DE: {
    currency: "EUR",
    roles: {
      marketplace: "amazon",
      delivery: "lieferando",
      grocery: "rewe",
      restaurant: "dominos",
      tables: "thefork",
      tickets: "fever",
      fashion: "zalando",
    },
    featured: ["amazon", "lieferando", "rewe", "spotify", "zalando", "otto"],
    ghosts: [
      "wolt",
      "ikea",
      "lidl",
      "netflix",
      "ubereats",
      "mcdonalds",
      "aliexpress",
      "vinted",
    ],
  },
  FR: {
    currency: "EUR",
    roles: {
      marketplace: "amazon",
      delivery: "ubereats",
      grocery: "carrefour",
      restaurant: "mcdonalds",
      tables: "thefork",
      tickets: "fnac",
      fashion: "vinted",
    },
    featured: [
      "amazon",
      "ubereats",
      "carrefour",
      "spotify",
      "leboncoin",
      "vinted",
    ],
    ghosts: [
      "deliveroo",
      "lidl",
      "fnac",
      "ikea",
      "netflix",
      "zalando",
      "mcdonalds",
      "aliexpress",
    ],
  },
  ES: {
    currency: "EUR",
    roles: {
      marketplace: "amazon",
      delivery: "glovo",
      grocery: "mercadona",
      restaurant: "vicio",
      tables: "thefork",
      tickets: "fever",
      fashion: "zara",
    },
    featured: ["amazon", "mercadona", "vicio", "spotify", "glovo", "zara"],
    ghosts: [
      "carrefour",
      "justeat",
      "lidl",
      "ikea",
      "netflix",
      "ubereats",
      "vinted",
      "thefork",
      "mcdonalds",
    ],
  },
  IT: {
    currency: "EUR",
    roles: {
      marketplace: "amazon",
      delivery: "glovo",
      grocery: "esselunga",
      restaurant: "mcdonalds",
      tables: "thefork",
      tickets: "fever",
      fashion: "zalando",
    },
    featured: [
      "amazon",
      "glovo",
      "esselunga",
      "spotify",
      "deliveroo",
      "zalando",
    ],
    ghosts: [
      "justeat",
      "carrefour",
      "lidl",
      "ikea",
      "netflix",
      "vinted",
      "thefork",
      "mcdonalds",
    ],
  },
  NL: {
    currency: "EUR",
    roles: {
      marketplace: "bol",
      delivery: "thuisbezorgd",
      grocery: "albertheijn",
      restaurant: "dominos",
      tables: "thefork",
      tickets: "fever",
      fashion: "zalando",
    },
    featured: [
      "amazon",
      "bol",
      "picnic",
      "spotify",
      "thuisbezorgd",
      "albertheijn",
    ],
    ghosts: [
      "zalando",
      "ubereats",
      "dominos",
      "lidl",
      "ikea",
      "netflix",
      "vinted",
      "mcdonalds",
    ],
  },
  PT: {
    currency: "EUR",
    roles: {
      marketplace: "worten",
      delivery: "glovo",
      grocery: "continente",
      restaurant: "mcdonalds",
      tables: "thefork",
      tickets: "fever",
      fashion: "zara",
    },
    featured: ["worten", "glovo", "continente", "spotify", "ubereats", "zara"],
    ghosts: [
      "amazon",
      "lidl",
      "ikea",
      "netflix",
      "vinted",
      "mcdonalds",
      "thefork",
      "aliexpress",
    ],
  },
  SE: {
    currency: "SEK",
    roles: {
      marketplace: "elgiganten",
      delivery: "foodora",
      grocery: "ica",
      restaurant: "max",
      tables: "thefork",
      tickets: "eventbrite",
      fashion: "handm",
    },
    featured: ["amazon", "ica", "max", "spotify", "foodora", "handm"],
    ghosts: [
      "wolt",
      "ikea",
      "elgiganten",
      "lidl",
      "zalando",
      "netflix",
      "ubereats",
      "mcdonalds",
      "vinted",
    ],
  },
  NO: {
    currency: "NOK",
    roles: {
      marketplace: "komplett",
      delivery: "foodora",
      grocery: "oda",
      restaurant: "peppes",
      tables: "thefork",
      tickets: "eventbrite",
      fashion: "zalando",
    },
    featured: ["oda", "komplett", "wolt", "spotify", "foodora", "peppes"],
    ghosts: [
      "zalando",
      "ikea",
      "handm",
      "netflix",
      "mcdonalds",
      "eventbrite",
      "burgerking",
    ],
  },
  DK: {
    currency: "DKK",
    roles: {
      marketplace: "elgiganten",
      delivery: "wolt",
      grocery: "nemlig",
      restaurant: "joe",
      tables: "thefork",
      tickets: "eventbrite",
      fashion: "zalando",
    },
    featured: ["nemlig", "wolt", "justeat", "spotify", "elgiganten", "joe"],
    ghosts: [
      "zalando",
      "ikea",
      "lidl",
      "netflix",
      "mcdonalds",
      "vinted",
      "handm",
      "eventbrite",
    ],
  },
  FI: {
    currency: "EUR",
    roles: {
      marketplace: "verkkokauppa",
      delivery: "wolt",
      grocery: "skaupat",
      restaurant: "hesburger",
      tables: "thefork",
      tickets: "eventbrite",
      fashion: "zalando",
    },
    featured: [
      "wolt",
      "skaupat",
      "foodora",
      "spotify",
      "verkkokauppa",
      "hesburger",
    ],
    ghosts: [
      "zalando",
      "lidl",
      "ikea",
      "netflix",
      "mcdonalds",
      "vinted",
      "handm",
      "eventbrite",
    ],
  },
  PL: {
    currency: "PLN",
    roles: {
      marketplace: "allegro",
      delivery: "pyszne",
      grocery: "zabka",
      restaurant: "kfc",
      tables: "opentable",
      tickets: "eventbrite",
      fashion: "zalando",
    },
    featured: ["amazon", "allegro", "zabka", "spotify", "pyszne", "glovo"],
    ghosts: [
      "zalando",
      "lidl",
      "ikea",
      "netflix",
      "vinted",
      "ubereats",
      "mcdonalds",
      "kfc",
      "aliexpress",
      "wolt",
    ],
  },
  IN: {
    currency: "INR",
    roles: {
      marketplace: "flipkart",
      delivery: "zomato",
      grocery: "blinkit",
      restaurant: "dominos",
      tables: "swiggy",
      tickets: "bookmyshow",
      fashion: "myntra",
    },
    featured: ["amazon", "flipkart", "swiggy", "spotify", "zomato", "blinkit"],
    ghosts: [
      "myntra",
      "bookmyshow",
      "dominos",
      "netflix",
      "ikea",
      "starbucks",
      "kfc",
      "mcdonalds",
    ],
  },
  JP: {
    currency: "JPY",
    roles: {
      marketplace: "rakuten",
      delivery: "demaecan",
      grocery: "amazon",
      restaurant: "mcdonalds",
      tables: "tabelog",
      tickets: "pia",
      fashion: "uniqlo",
    },
    featured: [
      "amazon",
      "rakuten",
      "ubereats",
      "spotify",
      "demaecan",
      "mercari",
    ],
    ghosts: [
      "uniqlo",
      "netflix",
      "starbucks",
      "playstation",
      "mcdonalds",
      "kfc",
      "youtube",
      "tabelog",
    ],
  },
  KR: {
    currency: "KRW",
    roles: {
      marketplace: "coupang",
      delivery: "baemin",
      grocery: "kurly",
      restaurant: "starbucks",
      tables: "naver",
      tickets: "nol",
      fashion: "musinsa",
    },
    featured: ["coupang", "baemin", "kurly", "spotify", "musinsa", "naver"],
    ghosts: [
      "netflix",
      "starbucks",
      "youtube",
      "playstation",
      "mcdonalds",
      "kfc",
      "nol",
    ],
  },
  AU: {
    currency: "AUD",
    roles: {
      marketplace: "amazon",
      delivery: "ubereats",
      grocery: "woolworths",
      restaurant: "dominos",
      tables: "opentable",
      tickets: "eventbrite",
      fashion: "theiconic",
    },
    featured: ["amazon", "woolworths", "coles", "spotify", "ubereats", "kmart"],
    ghosts: [
      "theiconic",
      "doordash",
      "netflix",
      "ikea",
      "ebay",
      "eventbrite",
      "mcdonalds",
      "dominos",
    ],
  },
} as const satisfies Record<string, Plan>;

export type Country = keyof typeof PLANS;
export const COUNTRIES = Object.keys(PLANS) as Country[];

/** The rest of a region: the stores that work across it. */
const REGIONS = {
  europe: {
    countries:
      "AD AL AT BA BE BG BY CH CY CZ EE GR HR HU IE IS LI LT LU LV MC MD ME MK MT RO RS SI SK SM UA XK",
    plan: {
      currency: "EUR",
      roles: {
        marketplace: "amazon",
        delivery: "ubereats",
        grocery: "lidl",
        restaurant: "mcdonalds",
        tables: "thefork",
        tickets: "fever",
        fashion: "zalando",
      },
      featured: ["amazon", "ubereats", "lidl", "spotify", "zalando", "ikea"],
      ghosts: [
        "netflix",
        "vinted",
        "aliexpress",
        "mcdonalds",
        "wolt",
        "glovo",
        "fever",
        "thefork",
      ],
    },
  },
  latam: {
    countries: "BO CU HN NI PR PY SV VE",
    plan: {
      currency: "USD",
      roles: {
        marketplace: "mercadolibre",
        delivery: "pedidosya",
        grocery: "carrefour",
        restaurant: "mcdonalds",
        tables: "opentable",
        tickets: "fever",
        fashion: "zara",
      },
      featured: [
        "mercadolibre",
        "pedidosya",
        "rappi",
        "spotify",
        "mcdonalds",
        "zara",
      ],
      ghosts: [
        "netflix",
        "starbucks",
        "aliexpress",
        "kfc",
        "burgerking",
        "ubereats",
      ],
    },
  },
  asia: {
    countries: "SG MY TH ID PH VN TW HK",
    plan: {
      currency: "USD",
      roles: {
        marketplace: "shopee",
        delivery: "grab",
        grocery: "grab",
        restaurant: "mcdonalds",
        tables: "opentable",
        tickets: "eventbrite",
        fashion: "uniqlo",
      },
      featured: [
        "shopee",
        "grab",
        "mcdonalds",
        "spotify",
        "uniqlo",
        "starbucks",
      ],
      ghosts: ["netflix", "kfc", "aliexpress", "youtube", "playstation"],
    },
  },
} as const satisfies Record<string, { countries: string; plan: Plan }>;

/** Everywhere else: stores people know the world over, priced in the page's language. */
const GLOBAL: Plan = {
  currency: null,
  roles: {
    marketplace: "amazon",
    delivery: "ubereats",
    grocery: "carrefour",
    restaurant: "mcdonalds",
    tables: "opentable",
    tickets: "eventbrite",
    fashion: "zara",
  },
  featured: ["amazon", "ubereats", "starbucks", "spotify", "nike", "zara"],
  ghosts: [
    "netflix",
    "ikea",
    "aliexpress",
    "youtube",
    "playstation",
    "mcdonalds",
    "kfc",
    "etsy",
  ],
};

export function isCountry(code: string | null | undefined): code is Country {
  return !!code && Object.hasOwn(PLANS, code);
}

/** What the homepage shows a visitor from `country` (an ISO code), resolved and ready to send to the page. */
export interface Market {
  country: string | null;
  currency: string | null;
  roles: Record<Role, Merchant>;
  featured: Merchant[];
  ghosts: Merchant[];
}

/**
 * Stores you'd be signed in to with a card saved, for the "Uses your
 * account" card: the market's marketplace, delivery, grocery and fashion
 * stores (then its restaurant), four of them.
 */
export function accountsFor(market: Market): Merchant[] {
  const roles: Role[] = [
    "marketplace",
    "delivery",
    "grocery",
    "fashion",
    "restaurant",
  ];
  const stores = roles.map((role) => market.roles[role]);
  return stores
    .filter(
      (store, index) => stores.findIndex(({ id }) => id === store.id) === index,
    )
    .slice(0, 4);
}

/**
 * The visitor's market: their country's plan, else their region's, else the
 * global one. Without a country (running locally) it's the US.
 */
export function marketFor(code: string | null | undefined): Market {
  const country = code?.toUpperCase() ?? null;
  const plan: Plan = !country
    ? PLANS.US
    : isCountry(country)
      ? PLANS[country]
      : (Object.values(REGIONS).find(({ countries }) =>
          countries.split(" ").includes(country),
        )?.plan ?? GLOBAL);
  return {
    country,
    currency: plan.currency,
    roles: Object.fromEntries(
      Object.entries(plan.roles).map(([role, id]) => [role, merchant(id)]),
    ) as Record<Role, Merchant>,
    featured: plan.featured.map(merchant),
    ghosts: plan.ghosts.map(merchant),
  };
}
