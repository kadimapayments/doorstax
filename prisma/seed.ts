import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

// ─── HELPERS ──────────────────────────────────────────────

const now = new Date();

function monthsAgo(n: number): Date {
  const d = new Date(now);
  d.setMonth(d.getMonth() - n);
  return d;
}

function monthsFromNow(n: number): Date {
  const d = new Date(now);
  d.setMonth(d.getMonth() + n);
  return d;
}

function dueDate(monthsBack: number): Date {
  const d = new Date(now);
  d.setMonth(d.getMonth() - monthsBack);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── TENANT PAYMENT BEHAVIOR PROFILES ─────────────────────
type TenantBehavior = "EXCELLENT" | "GOOD" | "FAIR" | "POOR" | "DELINQUENT";

function assignBehavior(idx: number): TenantBehavior {
  const bucket = idx % 20; // 20 buckets for clean distribution
  if (bucket < 10) return "EXCELLENT"; // 50%  (0-9)
  if (bucket < 14) return "GOOD";      // 20%  (10-13)
  if (bucket < 17) return "FAIR";      // 15%  (14-16)
  if (bucket < 19) return "POOR";      // 10%  (17-18)
  return "DELINQUENT";                  // 5%   (19)
}

const FAIL_CHANCE: Record<TenantBehavior, number> = {
  EXCELLENT: 0, GOOD: 0.02, FAIR: 0.05, POOR: 0.12, DELINQUENT: 0.30,
};

const AUTOPAY_RATE: Record<TenantBehavior, number> = {
  EXCELLENT: 0.8, GOOD: 0.5, FAIR: 0.2, POOR: 0, DELINQUENT: 0,
};

function paymentDayOffset(behavior: TenantBehavior): number {
  switch (behavior) {
    case "EXCELLENT":  return randInt(-2, 1);   // 2 days early to 1 day after
    case "GOOD":       return randInt(0, 3);    // on time to 3 days late
    case "FAIR":       return randInt(3, 8);    // 3-8 days late
    case "POOR":       return randInt(8, 15);   // 8-15 days late
    case "DELINQUENT": return randInt(15, 25);  // 15-25 days late
  }
}

const firstNames = [
  "James","Emily","Michael","Sophia","David","Olivia","Daniel","Rachel",
  "Alex","Maria","Chris","Jessica","Ryan","Sarah","Kevin","Amanda",
  "Tyler","Nicole","Brandon","Megan","Justin","Lauren","Andrew","Ashley",
  "Matthew","Brittany","Joshua","Samantha","Anthony","Stephanie",
  "Robert","Jennifer","William","Linda","Thomas","Elizabeth","Charles","Barbara",
  "Joseph","Margaret","Mark","Sandra","Donald","Dorothy","Steven","Lisa",
  "Paul","Nancy","Kenneth","Karen","George","Betty","Edward","Helen",
  "Brian","Deborah","Ronald","Laura","Timothy","Cynthia","Jason","Kathleen",
  "Jeffrey","Amy","Dennis","Angela","Gary","Shirley","Stephen","Anna",
  "Patrick","Brenda","Frank","Pamela","Scott","Emma","Eric","Christine",
  "Raymond","Catherine","Gregory","Debra","Jerry","Janet","Walter","Marie",
  "Peter","Alice","Harold","Grace","Douglas","Julie","Henry","Teresa",
  "Carl","Ann","Arthur","Jean","Roger","Victoria","Lawrence","Kathryn",
  "Albert","Heather","Jack","Diane","Adam","Tiffany","Dylan","Natalie",
  "Nathan","Michelle","Aaron","Amber","Zachary","Christina","Connor","Kayla",
  "Ethan","Andrea","Luke","Whitney","Marcus","Valerie","Jordan","Monique",
  "Austin","Jasmine","Isaac","Alicia","Logan","Destiny","Owen","Crystal",
  "Caleb","Melody","Elijah","Autumn","Noah","Jade","Liam","Ruby",
  "Mason","Violet","Carter","Hazel","Hunter","Ivy","Lucas","Daisy",
  "Sebastian","Luna","Mateo","Aria","Leo","Stella","Oliver","Penelope",
  "Felix","Clara","Hugo","Nora","Miles","Zoe","Gavin","Lily",
];

const lastNames = [
  "Rivera","Chen","Thompson","Patel","Kim","Brown","Garcia","Martinez",
  "Johnson","Santos","Lee","Taylor","Walker","Hughes","Robinson","Davis",
  "Wilson","Anderson","Thomas","Jackson","Harris","Clark","Lewis","Young",
  "Allen","King","Wright","Scott","Green","Adams","Baker","Nelson",
  "Hill","Ramirez","Campbell","Mitchell","Roberts","Carter","Phillips","Evans",
  "Turner","Torres","Parker","Collins","Edwards","Stewart","Flores","Morris",
  "Nguyen","Murphy","Cook","Rogers","Morgan","Peterson","Cooper","Reed",
  "Bailey","Bell","Gomez","Kelly","Howard","Ward","Cox","Diaz",
  "Richardson","Wood","Watson","Brooks","Bennett","Gray","James","Reyes",
  "Cruz","Price","Myers","Long","Foster","Sanders","Ross","Morales",
  "Powell","Sullivan","Russell","Ortiz","Jenkins","Gutierrez","Perry","Butler",
  "Barnes","Fisher","Henderson","Coleman","Simmons","Patterson","Jordan","Reynolds",
  "Hamilton","Graham","Stone","Spencer","Hartman","Burke","Dunn","Hicks",
  "Marsh","Fox","Drake","Webster","Bryant","Pearson","Watts","Chambers",
];

const cardBrands = ["visa", "mastercard", "amex", "discover"];
const randomLast4 = () => String(1000 + Math.floor(Math.random() * 9000));

const usedEmails = new Set<string>();
function genEmail(first: string, last: string): string {
  const domains = ["email.com", "gmail.com", "outlook.com", "yahoo.com", "mail.com"];
  let email = `${first.toLowerCase()}.${last.toLowerCase()}@${pick(domains)}`;
  let counter = 1;
  while (usedEmails.has(email)) {
    email = `${first.toLowerCase()}.${last.toLowerCase()}${counter}@${pick(domains)}`;
    counter++;
  }
  usedEmails.add(email);
  return email;
}

const bedroomOpts = [0, 1, 1, 2, 2, 2, 3, 3];
const bathMap: Record<number, number[]> = { 0: [1], 1: [1], 2: [1, 1, 2], 3: [2, 2, 2.5] };
const sqftMap: Record<number, [number, number]> = { 0: [350, 500], 1: [550, 750], 2: [800, 1100], 3: [1100, 1500] };

// Counters
let tenantIdx = 0;
let unitIdx = 0;
let paymentIdx = 0;
let expenseIdx = 0;
let propIdx = 0;

// ─── PM CONFIGURATIONS ───────────────────────────────────

interface PropertyDef {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  units: number;
  avgRent: number;
  cardPct: number;
  ownerKey: string; // reference to which owner this belongs to
}

interface OwnerDef {
  key: string;
  name: string;
  email: string;
  phone: string;
  feeScheduleKey?: string;
  managementFeePercent: number;
  achRate: number;
  payoutFeeRate: number;
  unitFeeRate: number;
  deductExpenses: boolean;
  billMe: boolean;
  billMeIncludeManagement: boolean;
  payoutFrequency: string;
}

interface FeeScheduleDef {
  key: string;
  name: string;
  managementFeePercent: number;
  achRate: number;
  payoutFeeRate: number;
  unitFeeRate: number;
  deductExpenses: boolean;
  billMe: boolean;
  billMeIncludeManagement: boolean;
  payoutFrequency: string;
}

interface PMConfig {
  email: string;
  name: string;
  companyName: string;
  properties: PropertyDef[];
  owners: OwnerDef[];
  feeSchedules: FeeScheduleDef[];
  merchantApp: {
    businessLegalName: string;
    dba: string;
    ein: string;
    phone: string;
    principalFirst: string;
    principalLast: string;
    principalDob: string;
  };
}

const PM_CONFIGS: PMConfig[] = [
  // ═══ STARTER — Mike's Rentals (60 units) ═══
  {
    email: "mike@mikesrentals.com",
    name: "Mike Torres",
    companyName: "Mike's Rentals",
    feeSchedules: [], // locked < 100 units
    owners: [
      {
        key: "mike-self",
        name: "Mike Torres",
        email: "mike@mikesrentals.com",
        phone: "(303) 555-0100",
        managementFeePercent: 0,
        achRate: 2.5,
        payoutFeeRate: 0.0015,
        unitFeeRate: 0,
        deductExpenses: true,
        billMe: true,
        billMeIncludeManagement: false,
        payoutFrequency: "MONTHLY",
      },
    ],
    properties: [
      { name: "Pine Ridge Apartments", address: "1200 Pine St", city: "Denver", state: "CO", zip: "80203", units: 20, avgRent: 1800, cardPct: 35, ownerKey: "mike-self" },
      { name: "Cedar Hill Homes", address: "450 Cedar Ave", city: "Denver", state: "CO", zip: "80220", units: 20, avgRent: 1750, cardPct: 30, ownerKey: "mike-self" },
      { name: "Lakewood Terrace", address: "890 Lakewood Blvd", city: "Lakewood", state: "CO", zip: "80226", units: 20, avgRent: 1850, cardPct: 25, ownerKey: "mike-self" },
    ],
    merchantApp: {
      businessLegalName: "Mike's Rentals LLC",
      dba: "Mike's Rentals",
      ein: "84-1234567",
      phone: "(303) 555-0100",
      principalFirst: "Mike",
      principalLast: "Torres",
      principalDob: "1985-03-12",
    },
  },

  // ═══ GROWTH — Metro Property Group (250 units) ═══
  {
    email: "alex@metropg.com",
    name: "Alex Chen",
    companyName: "Metro Property Group",
    feeSchedules: [
      { key: "metro-standard", name: "Standard", managementFeePercent: 8, achRate: 4, payoutFeeRate: 0.0025, unitFeeRate: 2.75, deductExpenses: true, billMe: false, billMeIncludeManagement: true, payoutFrequency: "MONTHLY" },
      { key: "metro-premium", name: "Premium", managementFeePercent: 10, achRate: 5, payoutFeeRate: 0.0035, unitFeeRate: 3, deductExpenses: true, billMe: false, billMeIncludeManagement: true, payoutFrequency: "MONTHLY" },
    ],
    owners: [
      { key: "metro-owner-a", name: "Westlake Holdings LLC", email: "info@westlakeholdings.com", phone: "(512) 555-0201", feeScheduleKey: "metro-standard", managementFeePercent: 8, achRate: 4, payoutFeeRate: 0.0025, unitFeeRate: 2.75, deductExpenses: true, billMe: false, billMeIncludeManagement: true, payoutFrequency: "MONTHLY" },
      { key: "metro-owner-b", name: "Capital Ventures Group", email: "ops@capitalventures.com", phone: "(512) 555-0202", feeScheduleKey: "metro-premium", managementFeePercent: 10, achRate: 5, payoutFeeRate: 0.0035, unitFeeRate: 3, deductExpenses: true, billMe: false, billMeIncludeManagement: true, payoutFrequency: "SEMI_MONTHLY" },
      { key: "metro-owner-c", name: "Alex Chen (Personal)", email: "alex.personal@metropg.com", phone: "(512) 555-0203", managementFeePercent: 0, achRate: 2.5, payoutFeeRate: 0.0015, unitFeeRate: 0, deductExpenses: true, billMe: true, billMeIncludeManagement: false, payoutFrequency: "MONTHLY" },
    ],
    properties: [
      { name: "The Metropolitan", address: "200 Congress Ave", city: "Austin", state: "TX", zip: "78701", units: 40, avgRent: 2100, cardPct: 30, ownerKey: "metro-owner-a" },
      { name: "East Side Commons", address: "1800 E 6th St", city: "Austin", state: "TX", zip: "78702", units: 35, avgRent: 1900, cardPct: 35, ownerKey: "metro-owner-a" },
      { name: "Mueller Heights", address: "4200 Mueller Blvd", city: "Austin", state: "TX", zip: "78723", units: 30, avgRent: 2000, cardPct: 25, ownerKey: "metro-owner-a" },
      { name: "South Congress Flats", address: "3100 S Congress Ave", city: "Austin", state: "TX", zip: "78704", units: 35, avgRent: 2200, cardPct: 40, ownerKey: "metro-owner-b" },
      { name: "Domain Place", address: "11500 Domain Dr", city: "Austin", state: "TX", zip: "78758", units: 35, avgRent: 2100, cardPct: 35, ownerKey: "metro-owner-b" },
      { name: "Rainey Street Residences", address: "90 Rainey St", city: "Austin", state: "TX", zip: "78701", units: 30, avgRent: 2300, cardPct: 45, ownerKey: "metro-owner-b" },
      { name: "Zilker View Apartments", address: "2200 Barton Springs Rd", city: "Austin", state: "TX", zip: "78704", units: 25, avgRent: 1900, cardPct: 30, ownerKey: "metro-owner-c" },
      { name: "Riverside Terrace", address: "1400 Riverside Dr", city: "Austin", state: "TX", zip: "78741", units: 20, avgRent: 1800, cardPct: 25, ownerKey: "metro-owner-c" },
    ],
    merchantApp: {
      businessLegalName: "Metro Property Group LLC",
      dba: "Metro Property Group",
      ein: "74-2345678",
      phone: "(512) 555-0200",
      principalFirst: "Alex",
      principalLast: "Chen",
      principalDob: "1980-07-20",
    },
  },

  // ═══ SCALE — Apex Management Co (650 units) ═══
  {
    email: "jennifer@apexmgmt.com",
    name: "Jennifer Park",
    companyName: "Apex Management Co",
    feeSchedules: [
      { key: "apex-standard", name: "Standard", managementFeePercent: 8, achRate: 3.5, payoutFeeRate: 0.0025, unitFeeRate: 2.5, deductExpenses: true, billMe: false, billMeIncludeManagement: true, payoutFrequency: "MONTHLY" },
      { key: "apex-highvol", name: "High Volume", managementFeePercent: 6, achRate: 3, payoutFeeRate: 0.002, unitFeeRate: 2, deductExpenses: true, billMe: false, billMeIncludeManagement: true, payoutFrequency: "MONTHLY" },
      { key: "apex-billme", name: "Self-Managed", managementFeePercent: 0, achRate: 2.5, payoutFeeRate: 0.0015, unitFeeRate: 0, deductExpenses: true, billMe: true, billMeIncludeManagement: false, payoutFrequency: "MONTHLY" },
    ],
    owners: [
      { key: "apex-owner-a", name: "Desert Sun Properties", email: "admin@desertsunprops.com", phone: "(602) 555-0301", feeScheduleKey: "apex-standard", managementFeePercent: 8, achRate: 3.5, payoutFeeRate: 0.0025, unitFeeRate: 2.5, deductExpenses: true, billMe: false, billMeIncludeManagement: true, payoutFrequency: "MONTHLY" },
      { key: "apex-owner-b", name: "Cactus Road Investments", email: "ops@cactusroad.com", phone: "(602) 555-0302", feeScheduleKey: "apex-standard", managementFeePercent: 8, achRate: 3.5, payoutFeeRate: 0.0025, unitFeeRate: 2.5, deductExpenses: true, billMe: false, billMeIncludeManagement: true, payoutFrequency: "MONTHLY" },
      { key: "apex-owner-c", name: "Mountain View Capital", email: "invest@mvcapital.com", phone: "(602) 555-0303", feeScheduleKey: "apex-standard", managementFeePercent: 8, achRate: 3.5, payoutFeeRate: 0.0025, unitFeeRate: 2.5, deductExpenses: true, billMe: false, billMeIncludeManagement: true, payoutFrequency: "SEMI_MONTHLY" },
      { key: "apex-owner-d", name: "Valley Ridge LLC", email: "info@valleyridge.com", phone: "(602) 555-0304", feeScheduleKey: "apex-highvol", managementFeePercent: 6, achRate: 3, payoutFeeRate: 0.002, unitFeeRate: 2, deductExpenses: true, billMe: false, billMeIncludeManagement: true, payoutFrequency: "SEMI_MONTHLY" },
      { key: "apex-owner-e", name: "Jennifer Park (Personal)", email: "jennifer.personal@apexmgmt.com", phone: "(602) 555-0305", feeScheduleKey: "apex-billme", managementFeePercent: 0, achRate: 2.5, payoutFeeRate: 0.0015, unitFeeRate: 0, deductExpenses: true, billMe: true, billMeIncludeManagement: false, payoutFrequency: "MONTHLY" },
    ],
    properties: [
      // Desert Sun Properties (200 units, 5 properties)
      { name: "Scottsdale Gateway", address: "7500 E Camelback Rd", city: "Scottsdale", state: "AZ", zip: "85251", units: 45, avgRent: 2000, cardPct: 30, ownerKey: "apex-owner-a" },
      { name: "Tempe Town Center", address: "600 S Mill Ave", city: "Tempe", state: "AZ", zip: "85281", units: 40, avgRent: 1850, cardPct: 35, ownerKey: "apex-owner-a" },
      { name: "Mesa Grande", address: "1200 S Country Club Dr", city: "Mesa", state: "AZ", zip: "85210", units: 40, avgRent: 1800, cardPct: 25, ownerKey: "apex-owner-a" },
      { name: "Chandler Crossing", address: "3000 W Chandler Blvd", city: "Chandler", state: "AZ", zip: "85226", units: 40, avgRent: 1900, cardPct: 30, ownerKey: "apex-owner-a" },
      { name: "Gilbert Green", address: "2100 E Williams Field Rd", city: "Gilbert", state: "AZ", zip: "85295", units: 35, avgRent: 1950, cardPct: 25, ownerKey: "apex-owner-a" },
      // Cactus Road Investments (150 units, 3 properties)
      { name: "Central Phoenix Towers", address: "101 N Central Ave", city: "Phoenix", state: "AZ", zip: "85004", units: 55, avgRent: 2100, cardPct: 40, ownerKey: "apex-owner-b" },
      { name: "Camelback Vista", address: "3200 E Camelback Rd", city: "Phoenix", state: "AZ", zip: "85018", units: 50, avgRent: 1900, cardPct: 35, ownerKey: "apex-owner-b" },
      { name: "Arcadia Place", address: "4400 E Indian School Rd", city: "Phoenix", state: "AZ", zip: "85018", units: 45, avgRent: 1850, cardPct: 30, ownerKey: "apex-owner-b" },
      // Mountain View Capital (100 units, 3 properties)
      { name: "Mountain View Estates", address: "8800 E Shea Blvd", city: "Scottsdale", state: "AZ", zip: "85260", units: 35, avgRent: 2200, cardPct: 45, ownerKey: "apex-owner-c" },
      { name: "Papago Ridge", address: "5600 E McDowell Rd", city: "Phoenix", state: "AZ", zip: "85008", units: 35, avgRent: 1800, cardPct: 30, ownerKey: "apex-owner-c" },
      { name: "Superstition Springs", address: "6300 E Southern Ave", city: "Mesa", state: "AZ", zip: "85206", units: 30, avgRent: 1750, cardPct: 25, ownerKey: "apex-owner-c" },
      // Valley Ridge LLC (100 units, 2 properties)
      { name: "Valley West Residences", address: "9100 W Thomas Rd", city: "Phoenix", state: "AZ", zip: "85037", units: 55, avgRent: 1700, cardPct: 20, ownerKey: "apex-owner-d" },
      { name: "Glendale Gardens", address: "5800 W Glendale Ave", city: "Glendale", state: "AZ", zip: "85301", units: 45, avgRent: 1650, cardPct: 25, ownerKey: "apex-owner-d" },
      // Jennifer Park Personal (50 units, 2 properties)
      { name: "Park Pointe Villas", address: "2800 N 44th St", city: "Phoenix", state: "AZ", zip: "85008", units: 30, avgRent: 1900, cardPct: 30, ownerKey: "apex-owner-e" },
      { name: "Desert Bloom Condos", address: "1600 N 7th Ave", city: "Phoenix", state: "AZ", zip: "85007", units: 20, avgRent: 1850, cardPct: 25, ownerKey: "apex-owner-e" },
    ],
    merchantApp: {
      businessLegalName: "Apex Management Company Inc",
      dba: "Apex Management Co",
      ein: "86-3456789",
      phone: "(602) 555-0300",
      principalFirst: "Jennifer",
      principalLast: "Park",
      principalDob: "1977-11-08",
    },
  },

  // ═══ ENTERPRISE — National Residential Partners (1500 units) ═══
  {
    email: "david@nationalrp.com",
    name: "David Morrison",
    companyName: "National Residential Partners",
    feeSchedules: [
      { key: "nrp-institutional", name: "Institutional", managementFeePercent: 6, achRate: 3.5, payoutFeeRate: 0.003, unitFeeRate: 2.5, deductExpenses: true, billMe: false, billMeIncludeManagement: true, payoutFrequency: "MONTHLY" },
      { key: "nrp-premium", name: "Premium Institutional", managementFeePercent: 8, achRate: 4, payoutFeeRate: 0.004, unitFeeRate: 3, deductExpenses: true, billMe: false, billMeIncludeManagement: true, payoutFrequency: "SEMI_MONTHLY" },
    ],
    owners: [
      { key: "nrp-owner-a", name: "Greystone Capital Partners", email: "pm@greystonecap.com", phone: "(404) 555-0401", feeScheduleKey: "nrp-institutional", managementFeePercent: 6, achRate: 3.5, payoutFeeRate: 0.003, unitFeeRate: 2.5, deductExpenses: true, billMe: false, billMeIncludeManagement: true, payoutFrequency: "MONTHLY" },
      { key: "nrp-owner-b", name: "Pinnacle Realty Trust", email: "ops@pinnaclerealty.com", phone: "(404) 555-0402", feeScheduleKey: "nrp-institutional", managementFeePercent: 6, achRate: 3.5, payoutFeeRate: 0.003, unitFeeRate: 2.5, deductExpenses: true, billMe: false, billMeIncludeManagement: true, payoutFrequency: "MONTHLY" },
      { key: "nrp-owner-c", name: "Riverstone Investments", email: "info@riverstoneinvest.com", phone: "(404) 555-0403", feeScheduleKey: "nrp-institutional", managementFeePercent: 6, achRate: 3.5, payoutFeeRate: 0.003, unitFeeRate: 2.5, deductExpenses: true, billMe: false, billMeIncludeManagement: true, payoutFrequency: "MONTHLY" },
      { key: "nrp-owner-d", name: "Horizon Property Holdings", email: "admin@horizonph.com", phone: "(404) 555-0404", feeScheduleKey: "nrp-institutional", managementFeePercent: 6, achRate: 3.5, payoutFeeRate: 0.003, unitFeeRate: 2.5, deductExpenses: true, billMe: false, billMeIncludeManagement: true, payoutFrequency: "MONTHLY" },
      { key: "nrp-owner-e", name: "Atlas Residential Group", email: "mgmt@atlasresidential.com", phone: "(404) 555-0405", feeScheduleKey: "nrp-institutional", managementFeePercent: 6, achRate: 3.5, payoutFeeRate: 0.003, unitFeeRate: 2.5, deductExpenses: true, billMe: false, billMeIncludeManagement: true, payoutFrequency: "MONTHLY" },
      { key: "nrp-owner-f", name: "Keystone Property Fund", email: "invest@keystonepf.com", phone: "(404) 555-0406", feeScheduleKey: "nrp-premium", managementFeePercent: 8, achRate: 4, payoutFeeRate: 0.004, unitFeeRate: 3, deductExpenses: true, billMe: false, billMeIncludeManagement: true, payoutFrequency: "SEMI_MONTHLY" },
      { key: "nrp-owner-g", name: "Summit Living Partners", email: "ops@summitliving.com", phone: "(404) 555-0407", feeScheduleKey: "nrp-premium", managementFeePercent: 8, achRate: 4, payoutFeeRate: 0.004, unitFeeRate: 3, deductExpenses: true, billMe: false, billMeIncludeManagement: true, payoutFrequency: "SEMI_MONTHLY" },
      { key: "nrp-owner-h", name: "David Morrison (Personal)", email: "david.personal@nationalrp.com", phone: "(404) 555-0408", managementFeePercent: 0, achRate: 2.5, payoutFeeRate: 0.0015, unitFeeRate: 0, deductExpenses: true, billMe: true, billMeIncludeManagement: false, payoutFrequency: "MONTHLY" },
    ],
    properties: generateNRPProperties(),
    merchantApp: {
      businessLegalName: "National Residential Partners Inc",
      dba: "National Residential Partners",
      ein: "13-4567890",
      phone: "(404) 555-0400",
      principalFirst: "David",
      principalLast: "Morrison",
      principalDob: "1974-01-30",
    },
  },
];

// Generate 30 properties for NRP (Enterprise) spread across owners
function generateNRPProperties(): PropertyDef[] {
  const cities = [
    { city: "Atlanta", state: "GA", zip: "30301" },
    { city: "Marietta", state: "GA", zip: "30060" },
    { city: "Decatur", state: "GA", zip: "30030" },
    { city: "Alpharetta", state: "GA", zip: "30009" },
    { city: "Roswell", state: "GA", zip: "30075" },
    { city: "Duluth", state: "GA", zip: "30096" },
    { city: "Kennesaw", state: "GA", zip: "30144" },
    { city: "Lawrenceville", state: "GA", zip: "30043" },
    { city: "Smyrna", state: "GA", zip: "30080" },
    { city: "Johns Creek", state: "GA", zip: "30097" },
  ];

  const names = [
    "Peachtree Place","Buckhead Heights","Midtown Towers","Piedmont Park Residences",
    "Atlantic Station Lofts","Inman Park Village","Virginia Highlands Apartments","Brookhaven Commons",
    "Sandy Springs Landing","Dunwoody Crossing","Vinings Creek","Chamblee Station",
    "Grant Park Terrace","East Atlanta Flats","Ponce City Residences","Lenox Park",
    "Cascade Heights","West End Lofts","Edgewood Place","Candler Park Village",
    "Emory Village Homes","Druid Hills Manor","Toco Hills Apartments","North Druid Terrace",
    "Perimeter Pointe","Cumberland Station","Riverview Landing","Stone Mountain View",
    "Peachtree Corners","Historic Roswell Homes",
  ];

  const ownerKeys = [
    // Greystone (5 props, ~250u)
    "nrp-owner-a","nrp-owner-a","nrp-owner-a","nrp-owner-a","nrp-owner-a",
    // Pinnacle (5 props, ~250u)
    "nrp-owner-b","nrp-owner-b","nrp-owner-b","nrp-owner-b","nrp-owner-b",
    // Riverstone (4 props, ~200u)
    "nrp-owner-c","nrp-owner-c","nrp-owner-c","nrp-owner-c",
    // Horizon (4 props, ~200u)
    "nrp-owner-d","nrp-owner-d","nrp-owner-d","nrp-owner-d",
    // Atlas (4 props, ~200u)
    "nrp-owner-e","nrp-owner-e","nrp-owner-e","nrp-owner-e",
    // Keystone Premium (3 props, ~150u)
    "nrp-owner-f","nrp-owner-f","nrp-owner-f",
    // Summit Premium (3 props, ~150u)
    "nrp-owner-g","nrp-owner-g","nrp-owner-g",
    // David personal (2 props, ~100u)
    "nrp-owner-h","nrp-owner-h",
  ];

  const unitCounts = [
    50,50,50,50,50, // Greystone = 250
    50,50,50,50,50, // Pinnacle = 250
    50,50,50,50,     // Riverstone = 200
    50,50,50,50,     // Horizon = 200
    50,50,50,50,     // Atlas = 200
    50,50,50,        // Keystone = 150
    50,50,50,        // Summit = 150
    50,50,           // David = 100
  ];

  return names.map((name, i) => {
    const loc = cities[i % cities.length];
    return {
      name,
      address: `${1000 + i * 100} ${name.split(" ")[0]} St`,
      city: loc.city,
      state: loc.state,
      zip: loc.zip,
      units: unitCounts[i],
      avgRent: 1700 + randInt(0, 4) * 100,
      cardPct: 25 + randInt(0, 3) * 5,
      ownerKey: ownerKeys[i],
    };
  });
}

// ─── MAIN ────────────────────────────────────────────────

async function main() {
  const passwordHash = await hash("Test1234!", 12);

  console.log("🗑️  Clearing all existing data...");

  // Delete in dependency order
  await prisma.scheduledPayment.deleteMany({});
  await prisma.recurringBilling.deleteMany({});
  await prisma.rentSplitItem.deleteMany({});
  await prisma.rentSplit.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.leaseAddendum.deleteMany({});
  await prisma.lease.deleteMany({});
  await prisma.subscriptionPayment.deleteMany({});
  await prisma.subscription.deleteMany({});
  await prisma.serviceTicket.deleteMany({});
  await prisma.tenantProfile.deleteMany({});
  await prisma.tenantInvite.deleteMany({});
  await prisma.application.deleteMany({});
  await prisma.ownerPayout.deleteMany({});
  await prisma.expense.deleteMany({});
  await prisma.unit.deleteMany({});
  await prisma.owner.deleteMany({});
  await prisma.feeSchedule.deleteMany({});
  await prisma.property.deleteMany({});
  await prisma.merchantApplication.deleteMany({});
  await prisma.dashboardNotice.deleteMany({});
  await prisma.messageRecipient.deleteMany({});
  await prisma.message.deleteMany({});
  await prisma.teamMember.deleteMany({});
  await prisma.adminStaff.deleteMany({});
  await prisma.applicationTemplate.deleteMany({});
  await prisma.user.deleteMany({});

  console.log("✅ Database cleared\n");

  // ─── ADMIN ───
  const admin = await prisma.user.create({
    data: {
      email: "admin@doorstax.com",
      name: "DoorStax Admin",
      role: "ADMIN",
      passwordHash,
    },
  });
  console.log(`Admin: ${admin.email}`);

  // ─── PROCESS EACH PM ───
  let grandTotalUnits = 0;
  let grandTotalTenants = 0;
  let grandTotalPayments = 0;

  for (const pm of PM_CONFIGS) {
    console.log(`\n${"═".repeat(50)}`);
    console.log(`  ${pm.companyName} (${pm.email})`);
    console.log(`${"═".repeat(50)}`);

    // Create PM user
    const pmUser = await prisma.user.create({
      data: {
        email: pm.email,
        name: pm.name,
        role: "PM",
        passwordHash,
        companyName: pm.companyName,
        managerStatus: "ACTIVE",
        tosAcceptedAt: monthsAgo(6),
        privacyAcceptedAt: monthsAgo(6),
      },
    });

    // Create fee schedules
    const feeScheduleMap: Record<string, string> = {};
    for (const fs of pm.feeSchedules) {
      const schedule = await prisma.feeSchedule.create({
        data: {
          landlordId: pmUser.id,
          name: fs.name,
          managementFeePercent: fs.managementFeePercent,
          achRate: fs.achRate,
          deductProcessingFees: fs.achRate > 0,
          deductExpenses: fs.deductExpenses,
          deductPlatformFee: fs.unitFeeRate > 0,
          payoutFeeRate: fs.payoutFeeRate,
          unitFeeRate: fs.unitFeeRate,
          billMe: fs.billMe,
          billMeIncludeManagement: fs.billMeIncludeManagement,
          payoutFrequency: fs.payoutFrequency,
        },
      });
      feeScheduleMap[fs.key] = schedule.id;
    }
    if (pm.feeSchedules.length > 0) {
      console.log(`  ${pm.feeSchedules.length} fee schedule(s) created`);
    }

    // Create owners (with auto-assigned terminal IDs starting at 7000)
    const ownerMap: Record<string, string> = {};
    let ownerTidCounter = 7000;
    for (const ow of pm.owners) {
      const tidStr = String(ownerTidCounter);
      const owner = await prisma.owner.create({
        data: {
          landlordId: pmUser.id,
          name: ow.name,
          email: ow.email,
          phone: ow.phone,
          managementFeePercent: ow.managementFeePercent,
          achRate: ow.achRate,
          deductProcessingFees: ow.achRate > 0,
          deductExpenses: ow.deductExpenses,
          deductPlatformFee: ow.unitFeeRate > 0,
          payoutFeeRate: ow.payoutFeeRate,
          unitFeeRate: ow.unitFeeRate,
          billMe: ow.billMe,
          billMeIncludeManagement: ow.billMeIncludeManagement,
          payoutFrequency: ow.payoutFrequency,
          feeScheduleId: ow.feeScheduleKey ? feeScheduleMap[ow.feeScheduleKey] : undefined,
          terminalId: tidStr,
          achTerminalId: tidStr,
        },
      });
      ownerMap[ow.key] = owner.id;
      ownerTidCounter++;
    }
    console.log(`  ${pm.owners.length} owner(s) created`);

    // Create properties
    const propertyIds: Record<string, string> = {};
    for (const p of pm.properties) {
      propIdx++;
      const prop = await prisma.property.create({
        data: {
          landlordId: pmUser.id,
          ownerId: ownerMap[p.ownerKey],
          name: p.name,
          address: p.address,
          city: p.city,
          state: p.state,
          zip: p.zip,
          propertyType: "MULTIFAMILY",
        },
      });
      propertyIds[p.name] = prop.id;
    }
    console.log(`  ${pm.properties.length} properties created`);

    // Create units, tenants, profiles, leases, payments
    let pmUnits = 0;
    let pmTenants = 0;
    let pmPayments = 0;

    for (const p of pm.properties) {
      const propertyId = propertyIds[p.name];
      const occupiedTarget = Math.round(p.units * 0.9);

      // Batch arrays
      const unitBatch: any[] = [];
      const tenantBatch: any[] = [];
      const profileBatch: any[] = [];
      const leaseBatch: any[] = [];
      const paymentBatch: any[] = [];

      for (let u = 0; u < p.units; u++) {
        unitIdx++;
        const unitId = `u-${unitIdx}`;
        const floor = Math.floor(u / 10) + 1;
        const unitNum = `${floor}${String((u % 10) + 1).padStart(2, "0")}`;
        const isOccupied = u < occupiedTarget;

        const bedrooms = pick(bedroomOpts);
        const bathrooms = pick(bathMap[bedrooms]);
        const sqft = randInt(sqftMap[bedrooms][0], sqftMap[bedrooms][1]);
        const rentVariance = 1 + (Math.random() * 0.4 - 0.2);
        const rentAmount = Math.round(p.avgRent * rentVariance / 50) * 50;

        unitBatch.push({
          id: unitId,
          propertyId,
          unitNumber: unitNum,
          bedrooms,
          bathrooms,
          sqft,
          rentAmount,
          status: isOccupied ? "OCCUPIED" : "AVAILABLE",
          listingEnabled: !isOccupied,
        });

        pmUnits++;

        if (isOccupied) {
          tenantIdx++;
          const firstName = firstNames[tenantIdx % firstNames.length];
          const lastName = lastNames[(tenantIdx * 7) % lastNames.length];
          const tenantEmail = genEmail(firstName, lastName);
          const tenantId = `t-${tenantIdx}`;
          const profileId = `tp-${tenantIdx}`;

          tenantBatch.push({
            id: tenantId,
            email: tenantEmail,
            name: `${firstName} ${lastName}`,
            role: "TENANT",
            passwordHash,
          });

          const tenantBehavior = assignBehavior(tenantIdx);
          profileBatch.push({
            id: profileId,
            userId: tenantId,
            unitId,
            status: "ACTIVE",
            leaseStart: monthsAgo(6),
            leaseEnd: monthsFromNow(6),
            autopayEnabled: Math.random() < AUTOPAY_RATE[tenantBehavior],
          });

          leaseBatch.push({
            tenantId: profileId,
            unitId,
            propertyId,
            landlordId: pmUser.id,
            startDate: monthsAgo(6),
            endDate: monthsFromNow(6),
            rentAmount,
            status: "ACTIVE",
          });

          pmTenants++;

          // Assign behavioral profile deterministically
          const behavior = assignBehavior(tenantIdx);

          // 6 months of payments
          for (let m = 5; m >= 0; m--) {
            paymentIdx++;
            const due = dueDate(m);
            const isCard = Math.random() * 100 < p.cardPct;
            const method = isCard ? "card" : "ach";

            let status: "COMPLETED" | "PENDING" | "FAILED" = "COMPLETED";
            let paidAt: Date | null = new Date(due);

            if (m === 0) {
              // Current month — behavior determines status
              switch (behavior) {
                case "EXCELLENT":
                  status = "COMPLETED";
                  break;
                case "GOOD":
                  status = Math.random() < 0.7 ? "COMPLETED" : "PENDING";
                  break;
                case "FAIR":
                  status = "PENDING";
                  break;
                case "POOR":
                  status = "PENDING";
                  break;
                case "DELINQUENT":
                  status = Math.random() < 0.4 ? "FAILED" : "PENDING";
                  break;
              }
            } else {
              // Historical months — failure chance varies by profile
              if (Math.random() < FAIL_CHANCE[behavior]) {
                status = "FAILED";
              }
            }

            // Set paidAt timing based on behavior profile
            if (status === "COMPLETED") {
              paidAt!.setDate(paidAt!.getDate() + paymentDayOffset(behavior));
            } else {
              paidAt = null; // PENDING and FAILED have no paidAt
            }

            paymentBatch.push({
              id: `pay-${paymentIdx}`,
              tenantId: profileId,
              unitId,
              landlordId: pmUser.id,
              amount: rentAmount,
              type: "RENT",
              status,
              paymentMethod: method,
              dueDate: due,
              paidAt,
              description: `Rent - ${due.toLocaleString("default", { month: "long", year: "numeric" })}`,
              cardBrand: isCard ? pick(cardBrands) : null,
              cardLast4: isCard ? randomLast4() : null,
              achLast4: !isCard ? randomLast4() : null,
            });
            pmPayments++;
          }
        } else if (u === occupiedTarget) {
          // Add one PROSPECT tenant per property (first vacant unit)
          tenantIdx++;
          const firstName = firstNames[tenantIdx % firstNames.length];
          const lastName = lastNames[(tenantIdx * 7) % lastNames.length];
          const tenantEmail = genEmail(firstName, lastName);
          const tenantId = `t-${tenantIdx}`;
          const profileId = `tp-${tenantIdx}`;

          tenantBatch.push({
            id: tenantId,
            email: tenantEmail,
            name: `${firstName} ${lastName}`,
            role: "TENANT",
            passwordHash,
          });

          profileBatch.push({
            id: profileId,
            userId: tenantId,
            unitId,
            status: "PROSPECT",
            leaseStart: null,
            leaseEnd: null,
            autopayEnabled: false,
          });
          pmTenants++;
        }
      }

      // Batch insert
      await prisma.unit.createMany({ data: unitBatch });

      // Create tenants in chunks (avoid unique constraint issues)
      for (const t of tenantBatch) {
        await prisma.user.upsert({
          where: { email: t.email },
          update: {},
          create: t,
        });
      }

      await prisma.tenantProfile.createMany({ data: profileBatch });
      await prisma.lease.createMany({ data: leaseBatch });

      // Payments in chunks of 500
      for (let i = 0; i < paymentBatch.length; i += 500) {
        await prisma.payment.createMany({ data: paymentBatch.slice(i, i + 500) });
      }
    }

    console.log(`  ${pmUnits} units | ${pmTenants} tenants | ${pmPayments} payments`);
    grandTotalUnits += pmUnits;
    grandTotalTenants += pmTenants;
    grandTotalPayments += pmPayments;

    // Expenses (4-5 per property)
    const expCategories = ["MAINTENANCE", "INSURANCE", "MORTGAGE", "SERVICES", "TAXES", "PAYROLL"];
    let pmExpenses = 0;
    for (const p of pm.properties) {
      const numExp = randInt(4, 5);
      for (let e = 0; e < numExp; e++) {
        expenseIdx++;
        await prisma.expense.create({
          data: {
            propertyId: propertyIds[p.name],
            landlordId: pmUser.id,
            category: pick(expCategories) as any,
            amount: randInt(500, 5000),
            date: monthsAgo(randInt(0, 3)),
            description: `${pick(["Monthly", "Quarterly", "Annual"])} ${pick(["maintenance", "insurance", "tax", "service", "repair"])} expense`,
            vendor: pick(["ABC Services", "XYZ Maintenance", "Premier Repairs", "State Farm", "County Assessor", "Staff Payroll"]),
            recurring: Math.random() > 0.5,
          },
        });
        pmExpenses++;
      }
    }
    console.log(`  ${pmExpenses} expenses`);

    // Subscription
    // Calculate tiered price
    function calcPrice(units: number): number {
      const base = 150;
      const additional = Math.max(0, units - 50);
      if (additional === 0) return base;
      let cost = base;
      cost += Math.min(additional, 49) * 3.0;
      cost += Math.min(Math.max(0, additional - 49), 400) * 2.5;
      cost += Math.min(Math.max(0, additional - 449), 500) * 2.0;
      cost += Math.max(0, additional - 949) * 1.5;
      return Math.round(cost * 100) / 100;
    }

    const subAmount = calcPrice(pmUnits);
    await prisma.subscription.create({
      data: {
        userId: pmUser.id,
        status: "ACTIVE",
        basePrice: 150,
        perBuildingPrice: 3,
        buildingCount: pmUnits,
        currentAmount: subAmount,
        nextBillingDate: monthsFromNow(1),
        lastBillingDate: monthsAgo(0),
      },
    });
    console.log(`  Subscription: $${subAmount.toLocaleString()}/mo (${pmUnits} units)`);

    // Merchant application
    const ma = pm.merchantApp;
    await prisma.merchantApplication.create({
      data: {
        userId: pmUser.id,
        status: "APPROVED",
        businessLegalName: ma.businessLegalName,
        dba: ma.dba,
        businessType: "LLC",
        ein: ma.ein,
        businessAddress: pm.properties[0].address,
        businessCity: pm.properties[0].city,
        businessState: pm.properties[0].state,
        businessZip: pm.properties[0].zip,
        businessPhone: ma.phone,
        businessEmail: pm.email,
        principalFirstName: ma.principalFirst,
        principalLastName: ma.principalLast,
        principalTitle: "Managing Member",
        principalDob: new Date(ma.principalDob),
        principalAddress: "123 Executive Dr",
        principalCity: pm.properties[0].city,
        principalState: pm.properties[0].state,
        principalZip: pm.properties[0].zip,
        ownershipPercent: 100,
        numberOfBuildings: pm.properties.length,
        numberOfUnits: pmUnits,
        monthlyVolume: pmUnits * 1800,
        averageTransaction: 1800,
        currentStep: 4,
        completedAt: monthsAgo(3),
      },
    });
    console.log(`  Merchant application: APPROVED`);
  }

  // ─── SUMMARY ────────────────────────────────────────

  console.log(`\n${"═".repeat(50)}`);
  console.log("  SEED COMPLETE");
  console.log(`${"═".repeat(50)}\n`);
  console.log("Credentials (all use password: Test1234!):\n");
  console.log("  Admin:      admin@doorstax.com");
  console.log("  Starter:    mike@mikesrentals.com        (60 units)");
  console.log("  Growth:     alex@metropg.com              (250 units)");
  console.log("  Scale:      jennifer@apexmgmt.com         (650 units)");
  console.log("  Enterprise: david@nationalrp.com          (1500 units)");
  console.log(`\nTotals:`);
  console.log(`  Units:    ${grandTotalUnits.toLocaleString()}`);
  console.log(`  Tenants:  ${grandTotalTenants.toLocaleString()}`);
  console.log(`  Payments: ${grandTotalPayments.toLocaleString()}`);
  console.log("");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
