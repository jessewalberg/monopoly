// ============================================================
// BOARD SPACES - All 40 spaces with accurate Monopoly data
// ============================================================

export type SpaceType =
  | "go"
  | "property"
  | "community_chest"
  | "tax"
  | "railroad"
  | "chance"
  | "jail"
  | "utility"
  | "free_parking"
  | "go_to_jail";

export type PropertyGroup =
  | "brown"
  | "light_blue"
  | "pink"
  | "orange"
  | "red"
  | "yellow"
  | "green"
  | "dark_blue";

export interface GoSpace {
  pos: number;
  name: string;
  type: "go";
}

export interface PropertySpace {
  pos: number;
  name: string;
  type: "property";
  group: PropertyGroup;
  cost: number;
  rent: readonly [number, number, number, number, number, number]; // [base, 1h, 2h, 3h, 4h, hotel]
  houseCost: number;
}

export interface RailroadSpace {
  pos: number;
  name: string;
  type: "railroad";
  cost: number;
}

export interface UtilitySpace {
  pos: number;
  name: string;
  type: "utility";
  cost: number;
}

export interface TaxSpace {
  pos: number;
  name: string;
  type: "tax";
  amount: number;
}

export interface CardSpace {
  pos: number;
  name: string;
  type: "chance" | "community_chest";
}

export interface SpecialSpace {
  pos: number;
  name: string;
  type: "jail" | "free_parking" | "go_to_jail";
}

export type BoardSpace =
  | GoSpace
  | PropertySpace
  | RailroadSpace
  | UtilitySpace
  | TaxSpace
  | CardSpace
  | SpecialSpace;

export const BOARD: readonly BoardSpace[] = [
  { pos: 0, name: "GO", type: "go" },
  { pos: 1, name: "Mediterranean Avenue", type: "property", group: "brown", cost: 60, rent: [2, 10, 30, 90, 160, 250], houseCost: 50 },
  { pos: 2, name: "Community Chest", type: "community_chest" },
  { pos: 3, name: "Baltic Avenue", type: "property", group: "brown", cost: 60, rent: [4, 20, 60, 180, 320, 450], houseCost: 50 },
  { pos: 4, name: "Income Tax", type: "tax", amount: 200 },
  { pos: 5, name: "Reading Railroad", type: "railroad", cost: 200 },
  { pos: 6, name: "Oriental Avenue", type: "property", group: "light_blue", cost: 100, rent: [6, 30, 90, 270, 400, 550], houseCost: 50 },
  { pos: 7, name: "Chance", type: "chance" },
  { pos: 8, name: "Vermont Avenue", type: "property", group: "light_blue", cost: 100, rent: [6, 30, 90, 270, 400, 550], houseCost: 50 },
  { pos: 9, name: "Connecticut Avenue", type: "property", group: "light_blue", cost: 120, rent: [8, 40, 100, 300, 450, 600], houseCost: 50 },
  { pos: 10, name: "Jail / Just Visiting", type: "jail" },
  { pos: 11, name: "St. Charles Place", type: "property", group: "pink", cost: 140, rent: [10, 50, 150, 450, 625, 750], houseCost: 100 },
  { pos: 12, name: "Electric Company", type: "utility", cost: 150 },
  { pos: 13, name: "States Avenue", type: "property", group: "pink", cost: 140, rent: [10, 50, 150, 450, 625, 750], houseCost: 100 },
  { pos: 14, name: "Virginia Avenue", type: "property", group: "pink", cost: 160, rent: [12, 60, 180, 500, 700, 900], houseCost: 100 },
  { pos: 15, name: "Pennsylvania Railroad", type: "railroad", cost: 200 },
  { pos: 16, name: "St. James Place", type: "property", group: "orange", cost: 180, rent: [14, 70, 200, 550, 750, 950], houseCost: 100 },
  { pos: 17, name: "Community Chest", type: "community_chest" },
  { pos: 18, name: "Tennessee Avenue", type: "property", group: "orange", cost: 180, rent: [14, 70, 200, 550, 750, 950], houseCost: 100 },
  { pos: 19, name: "New York Avenue", type: "property", group: "orange", cost: 200, rent: [16, 80, 220, 600, 800, 1000], houseCost: 100 },
  { pos: 20, name: "Free Parking", type: "free_parking" },
  { pos: 21, name: "Kentucky Avenue", type: "property", group: "red", cost: 220, rent: [18, 90, 250, 700, 875, 1050], houseCost: 150 },
  { pos: 22, name: "Chance", type: "chance" },
  { pos: 23, name: "Indiana Avenue", type: "property", group: "red", cost: 220, rent: [18, 90, 250, 700, 875, 1050], houseCost: 150 },
  { pos: 24, name: "Illinois Avenue", type: "property", group: "red", cost: 240, rent: [20, 100, 300, 750, 925, 1100], houseCost: 150 },
  { pos: 25, name: "B&O Railroad", type: "railroad", cost: 200 },
  { pos: 26, name: "Atlantic Avenue", type: "property", group: "yellow", cost: 260, rent: [22, 110, 330, 800, 975, 1150], houseCost: 150 },
  { pos: 27, name: "Ventnor Avenue", type: "property", group: "yellow", cost: 260, rent: [22, 110, 330, 800, 975, 1150], houseCost: 150 },
  { pos: 28, name: "Water Works", type: "utility", cost: 150 },
  { pos: 29, name: "Marvin Gardens", type: "property", group: "yellow", cost: 280, rent: [24, 120, 360, 850, 1025, 1200], houseCost: 150 },
  { pos: 30, name: "Go To Jail", type: "go_to_jail" },
  { pos: 31, name: "Pacific Avenue", type: "property", group: "green", cost: 300, rent: [26, 130, 390, 900, 1100, 1275], houseCost: 200 },
  { pos: 32, name: "North Carolina Avenue", type: "property", group: "green", cost: 300, rent: [26, 130, 390, 900, 1100, 1275], houseCost: 200 },
  { pos: 33, name: "Community Chest", type: "community_chest" },
  { pos: 34, name: "Pennsylvania Avenue", type: "property", group: "green", cost: 320, rent: [28, 150, 450, 1000, 1200, 1400], houseCost: 200 },
  { pos: 35, name: "Short Line", type: "railroad", cost: 200 },
  { pos: 36, name: "Chance", type: "chance" },
  { pos: 37, name: "Park Place", type: "property", group: "dark_blue", cost: 350, rent: [35, 175, 500, 1100, 1300, 1500], houseCost: 200 },
  { pos: 38, name: "Luxury Tax", type: "tax", amount: 100 },
  { pos: 39, name: "Boardwalk", type: "property", group: "dark_blue", cost: 400, rent: [50, 200, 600, 1400, 1700, 2000], houseCost: 200 },
] as const;

// ============================================================
// PROPERTY GROUPS - Positions for each color group
// ============================================================

export const PROPERTY_GROUPS = {
  brown: [1, 3],
  light_blue: [6, 8, 9],
  pink: [11, 13, 14],
  orange: [16, 18, 19],
  red: [21, 23, 24],
  yellow: [26, 27, 29],
  green: [31, 32, 34],
  dark_blue: [37, 39],
  railroad: [5, 15, 25, 35],
  utility: [12, 28],
} as const;

// ============================================================
// GAME CONSTANTS
// ============================================================

export const STARTING_MONEY = 1500;
export const GO_SALARY = 200;
export const JAIL_POSITION = 10;
export const GO_TO_JAIL_POSITION = 30;
export const JAIL_FINE = 50;
export const MAX_JAIL_TURNS = 3;
export const MORTGAGE_RATE = 0.5; // Get 50% of property cost when mortgaging
export const UNMORTGAGE_INTEREST = 0.1; // Pay 10% extra to unmortgage
export const MAX_HOUSES = 4;
export const HOTEL_LEVEL = 5; // houses = 5 means hotel
export const TOTAL_HOUSES = 32; // Bank has 32 houses
export const TOTAL_HOTELS = 12; // Bank has 12 hotels

// Railroad rent based on number owned
export const RAILROAD_RENT = [25, 50, 100, 200] as const;

// Utility rent multipliers (based on dice roll)
export const UTILITY_MULTIPLIER_ONE = 4; // Own 1 utility: rent = dice × 4
export const UTILITY_MULTIPLIER_BOTH = 10; // Own both: rent = dice × 10

// ============================================================
// CHANCE CARDS - 16 cards
// ============================================================

export type ChanceCardAction =
  | "move_to"
  | "move_relative"
  | "move_to_nearest"
  | "receive"
  | "pay"
  | "pay_each_player"
  | "pay_per_building"
  | "go_to_jail"
  | "get_out_of_jail_card";

export interface ChanceCard {
  id: number;
  text: string;
  action: ChanceCardAction;
  destination?: number;
  spaces?: number;
  nearestType?: "utility" | "railroad";
  amount?: number;
  house?: number;
  hotel?: number;
}

export const CHANCE_CARDS: readonly ChanceCard[] = [
  { id: 1, text: "Advance to GO. Collect $200.", action: "move_to", destination: 0 },
  { id: 2, text: "Advance to Illinois Avenue. If you pass GO, collect $200.", action: "move_to", destination: 24 },
  { id: 3, text: "Advance to St. Charles Place. If you pass GO, collect $200.", action: "move_to", destination: 11 },
  { id: 4, text: "Advance to the nearest Utility. If unowned, you may buy it. If owned, throw dice and pay owner 10× the amount thrown.", action: "move_to_nearest", nearestType: "utility" },
  { id: 5, text: "Advance to the nearest Railroad. If unowned, you may buy it. If owned, pay owner twice the rental.", action: "move_to_nearest", nearestType: "railroad" },
  { id: 6, text: "Bank pays you dividend of $50.", action: "receive", amount: 50 },
  { id: 7, text: "Get Out of Jail Free. This card may be kept until needed or sold.", action: "get_out_of_jail_card" },
  { id: 8, text: "Go Back 3 Spaces.", action: "move_relative", spaces: -3 },
  { id: 9, text: "Go to Jail. Go directly to Jail. Do not pass GO. Do not collect $200.", action: "go_to_jail" },
  { id: 10, text: "Make general repairs on all your property: Pay $25 for each house and $100 for each hotel.", action: "pay_per_building", house: 25, hotel: 100 },
  { id: 11, text: "Pay poor tax of $15.", action: "pay", amount: 15 },
  { id: 12, text: "Take a trip to Reading Railroad. If you pass GO, collect $200.", action: "move_to", destination: 5 },
  { id: 13, text: "Advance to Boardwalk.", action: "move_to", destination: 39 },
  { id: 14, text: "You have been elected Chairman of the Board. Pay each player $50.", action: "pay_each_player", amount: 50 },
  { id: 15, text: "Your building loan matures. Collect $150.", action: "receive", amount: 150 },
  { id: 16, text: "You have won a crossword competition. Collect $100.", action: "receive", amount: 100 },
] as const;

// ============================================================
// COMMUNITY CHEST CARDS - 16 cards
// ============================================================

export type CommunityChestCardAction =
  | "move_to"
  | "receive"
  | "pay"
  | "collect_from_each_player"
  | "pay_per_building"
  | "go_to_jail"
  | "get_out_of_jail_card";

export interface CommunityChestCard {
  id: number;
  text: string;
  action: CommunityChestCardAction;
  destination?: number;
  amount?: number;
  house?: number;
  hotel?: number;
}

export const COMMUNITY_CHEST_CARDS: readonly CommunityChestCard[] = [
  { id: 1, text: "Advance to GO. Collect $200.", action: "move_to", destination: 0 },
  { id: 2, text: "Bank error in your favor. Collect $200.", action: "receive", amount: 200 },
  { id: 3, text: "Doctor's fee. Pay $50.", action: "pay", amount: 50 },
  { id: 4, text: "From sale of stock you get $50.", action: "receive", amount: 50 },
  { id: 5, text: "Get Out of Jail Free. This card may be kept until needed or sold.", action: "get_out_of_jail_card" },
  { id: 6, text: "Go to Jail. Go directly to Jail. Do not pass GO. Do not collect $200.", action: "go_to_jail" },
  { id: 7, text: "Holiday fund matures. Receive $100.", action: "receive", amount: 100 },
  { id: 8, text: "Income tax refund. Collect $20.", action: "receive", amount: 20 },
  { id: 9, text: "It is your birthday. Collect $10 from every player.", action: "collect_from_each_player", amount: 10 },
  { id: 10, text: "Life insurance matures. Collect $100.", action: "receive", amount: 100 },
  { id: 11, text: "Pay hospital fees of $100.", action: "pay", amount: 100 },
  { id: 12, text: "Pay school fees of $50.", action: "pay", amount: 50 },
  { id: 13, text: "Receive $25 consultancy fee.", action: "receive", amount: 25 },
  { id: 14, text: "You are assessed for street repairs: Pay $40 per house and $115 per hotel.", action: "pay_per_building", house: 40, hotel: 115 },
  { id: 15, text: "You have won second prize in a beauty contest. Collect $10.", action: "receive", amount: 10 },
  { id: 16, text: "You inherit $100.", action: "receive", amount: 100 },
] as const;

// ============================================================
// GROUP DISPLAY COLORS (for UI)
// ============================================================

export const GROUP_COLORS: Record<string, string> = {
  brown: "#8B4513",
  light_blue: "#87CEEB",
  pink: "#FF69B4",
  orange: "#FFA500",
  red: "#FF0000",
  yellow: "#FFD700",
  green: "#228B22",
  dark_blue: "#00008B",
  railroad: "#000000",
  utility: "#808080",
} as const;
