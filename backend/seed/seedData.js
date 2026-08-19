/**
 * Generates ~6 months of realistic, messy synthetic expense data:
 *  - category hierarchy (graph)
 *  - merchants with multiple raw-name variants (feeds the vector layer)
 *  - random day-to-day transactions
 *  - planted recurring subscriptions (some used, some deliberately "unused"
 *    for the last 60+ days, so the unused-subscription detector has
 *    something real to find)
 *
 * Run with: npm run seed   (from backend/)
 */
require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");

const Category = require("../models/Category");
const Merchant = require("../models/Merchant");
const Transaction = require("../models/Transaction");
const Subscription = require("../models/Subscription");
const UsageLog = require("../models/UsageLog");

const { embedText } = require("../utils/embeddings");
const { detectRecurringSubscriptions, flagUnusedSubscriptions } = require("../utils/graphTraversal");

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick(arr) {
  return arr[randInt(0, arr.length - 1)];
}
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(randInt(8, 22), randInt(0, 59), 0, 0);
  return d;
}

const CATEGORY_TREE = [
  { name: "Food", children: ["Food Delivery", "Dining Out", "Groceries"] },
  { name: "Transport", children: ["Cabs", "Fuel", "Public Transit"] },
  { name: "Shopping", children: ["Online Shopping", "Fashion"] },
  { name: "Entertainment", children: ["Streaming Subscriptions", "Movies & Events"] },
  { name: "Bills & Utilities", children: ["Mobile & Internet", "Electricity"] },
  { name: "Health & Fitness", children: ["Gym", "Pharmacy"] },
  { name: "Travel", children: [] },
];

// merchant name -> [category path, raw name variants shown on real statements]
const MERCHANTS = [
  { name: "Swiggy", category: "Food Delivery", raws: ["SWIGGY*ORDER8827", "Swiggy Bangalore Pvt Ltd", "SWIGGY INSTAMART", "UPI-SWIGGY-swiggy@icici"] },
  { name: "Zomato", category: "Food Delivery", raws: ["ZOMATO ONLINE ORDER", "Zomato Ltd", "UPI-ZOMATO-zomato@hdfc"] },
  { name: "Barbeque Nation", category: "Dining Out", raws: ["BARBEQUE NATION HSR", "BBQ NATION BANGALORE"] },
  { name: "Cafe Coffee Day", category: "Dining Out", raws: ["CCD KORAMANGALA", "CAFE COFFEE DAY LTD"] },
  { name: "BigBasket", category: "Groceries", raws: ["BIGBASKET.COM", "BB DAILY SUBSCRIPTION", "UPI-BIGBASKET-bb@icici"] },
  { name: "DMart", category: "Groceries", raws: ["AVENUE SUPERMARTS DMART", "DMART READY"] },
  { name: "Uber", category: "Cabs", raws: ["UBER *TRIP HELP.UBER.COM", "UBER INDIA SYSTEMS", "UPI-UBER-uber@axis"] },
  { name: "Ola", category: "Cabs", raws: ["OLACABS.COM", "ANI TECHNOLOGIES OLA"] },
  { name: "Indian Oil", category: "Fuel", raws: ["INDIAN OIL CORP", "IOCL PETROL PUMP"] },
  { name: "BMTC", category: "Public Transit", raws: ["BMTC BUS PASS", "BANGALORE METROPOLITAN TRANSPORT"] },
  { name: "Amazon", category: "Online Shopping", raws: ["AMAZON.IN", "AMAZON PAY", "AMZN MKTP IN"] },
  { name: "Myntra", category: "Fashion", raws: ["MYNTRA DESIGNS", "MYNTRA JABONG"] },
  { name: "Netflix", category: "Streaming Subscriptions", raws: ["NETFLIX.COM", "NETFLIX INTERNATIONAL"] },
  { name: "Spotify", category: "Streaming Subscriptions", raws: ["SPOTIFY INDIA", "SPOTIFY AB"] },
  { name: "Amazon Prime", category: "Streaming Subscriptions", raws: ["AMAZON PRIME MEMBERSHIP", "PRIME VIDEO IN"] },
  { name: "Hotstar", category: "Streaming Subscriptions", raws: ["DISNEY HOTSTAR", "HOTSTAR SUBSCRIPTION"] },
  { name: "PVR Cinemas", category: "Movies & Events", raws: ["PVR CINEMAS FORUM MALL", "PVR LTD"] },
  { name: "Airtel", category: "Mobile & Internet", raws: ["AIRTEL PAYMENTS BANK", "BHARTI AIRTEL RECHARGE"] },
  { name: "BESCOM", category: "Electricity", raws: ["BESCOM ONLINE PAYMENT", "BANGALORE ELECTRICITY"] },
  { name: "Cult.fit", category: "Gym", raws: ["CULT.FIT MEMBERSHIP", "CUREFIT HEALTHCARE"] },
  { name: "Apollo Pharmacy", category: "Pharmacy", raws: ["APOLLO PHARMACY", "APOLLO HEALTHCO"] },
  { name: "MakeMyTrip", category: "Travel", raws: ["MAKEMYTRIP INDIA", "MMT*TRIP BOOKING"] },
  { name: "IRCTC", category: "Travel", raws: ["IRCTC TICKET BOOKING", "INDIAN RAILWAY CATERING"] },
  { name: "iCloud", category: "Streaming Subscriptions", raws: ["APPLE.COM/BILL ICLOUD", "APPLE SERVICES"] },
];

// merchant -> subscription config (planted so detection algorithm finds them)
const SUBSCRIPTION_PLANS = [
  { merchant: "Netflix", amount: 649, frequency: "monthly", usagePattern: "active" },
  { merchant: "Spotify", amount: 119, frequency: "monthly", usagePattern: "active" },
  { merchant: "Amazon Prime", amount: 1499, frequency: "yearly", usagePattern: "active" },
  { merchant: "Hotstar", amount: 299, frequency: "monthly", usagePattern: "unused" }, // deliberately unused
  { merchant: "Cult.fit", amount: 999, frequency: "monthly", usagePattern: "unused" }, // deliberately unused
  { merchant: "iCloud", amount: 75, frequency: "monthly", usagePattern: "active" },
];

async function seed() {
  await connectDB();
  console.log("[seed] clearing existing data...");
  await Promise.all([
    Category.deleteMany({}),
    Merchant.deleteMany({}),
    Transaction.deleteMany({}),
    Subscription.deleteMany({}),
    UsageLog.deleteMany({}),
  ]);

  console.log("[seed] creating category graph...");
  const categoryDocs = {};
  for (const top of CATEGORY_TREE) {
    const parent = await Category.create({ name: top.name });
    categoryDocs[top.name] = parent;
    for (const childName of top.children) {
      const child = await Category.create({ name: childName, parent: parent._id });
      categoryDocs[childName] = child;
    }
  }

  console.log("[seed] creating merchants (with messy raw-name variants)...");
  const merchantDocs = {};
  for (const m of MERCHANTS) {
    const category = categoryDocs[m.category];
    const doc = await Merchant.create({
      normalizedName: m.name,
      rawNames: m.raws,
      category: category._id,
      // embed the normalized name + all raw variants together so fuzzy
      // matches against ANY messy statement string still find this merchant
      embedding: embedText([m.name, ...m.raws].join(" ")),
    });
    merchantDocs[m.name] = doc;
  }

  console.log("[seed] generating 6 months of everyday transactions...");
  const txnDocs = [];
  const everydayMerchants = MERCHANTS.filter(
    (m) => !SUBSCRIPTION_PLANS.find((s) => s.merchant === m.name)
  );

  for (let day = 0; day < 180; day++) {
    const numTxnsToday = randInt(0, 3);
    for (let i = 0; i < numTxnsToday; i++) {
      const m = pick(everydayMerchants);
      const raw = pick(m.raws);
      const amount = randInt(80, 2200);
      txnDocs.push({
        date: daysAgo(day),
        amount,
        rawDescription: raw,
        merchant: merchantDocs[m.name]._id,
        type: "debit",
        embedding: embedText(raw + " " + m.category),
      });
    }
  }

  console.log("[seed] planting recurring subscriptions...");
  for (const plan of SUBSCRIPTION_PLANS) {
    const merchantMeta = MERCHANTS.find((m) => m.name === plan.merchant);
    const intervalDays = plan.frequency === "monthly" ? 30 : plan.frequency === "yearly" ? 365 : 7;
    const cycles = plan.frequency === "yearly" ? 1 : Math.floor(180 / intervalDays);

    for (let c = 0; c < cycles; c++) {
      const jitter = randInt(-1, 1); // real billing dates jitter by a day or two
      const dayOffset = c * intervalDays + jitter;
      if (dayOffset > 179) continue;
      const raw = pick(merchantMeta.raws);
      txnDocs.push({
        date: daysAgo(dayOffset),
        amount: plan.amount + randInt(-5, 5), // tiny real-world variance
        rawDescription: raw,
        merchant: merchantDocs[plan.merchant]._id,
        type: "debit",
        embedding: embedText(raw + " " + merchantMeta.category),
      });
    }
  }

  await Transaction.insertMany(txnDocs);
  console.log(`[seed] inserted ${txnDocs.length} transactions`);

  console.log("[seed] running graph-based subscription detection...");
  await detectRecurringSubscriptions();

  console.log("[seed] simulating usage logs (app opens / check-ins)...");
  const subs = await Subscription.find().populate("merchant");
  for (const sub of subs) {
    const plan = SUBSCRIPTION_PLANS.find((p) => p.merchant === sub.merchant.normalizedName);
    if (!plan) continue;

    if (plan.usagePattern === "active") {
      // usage events every few days, including recently
      for (let day = 0; day < 180; day += randInt(2, 6)) {
        await UsageLog.create({ subscription: sub._id, date: daysAgo(day) });
      }
    } else {
      // "unused" pattern: only usage events older than 60 days -> looks abandoned
      for (let day = 65; day < 180; day += randInt(5, 12)) {
        await UsageLog.create({ subscription: sub._id, date: daysAgo(day) });
      }
    }
  }

  console.log("[seed] flagging unused subscriptions...");
  await flagUnusedSubscriptions(UsageLog);

  console.log("[seed] done! Summary:");
  console.log(`  Categories: ${await Category.countDocuments()}`);
  console.log(`  Merchants: ${await Merchant.countDocuments()}`);
  console.log(`  Transactions: ${await Transaction.countDocuments()}`);
  console.log(`  Subscriptions: ${await Subscription.countDocuments()}`);
  const unused = await Subscription.find({ status: "possibly-unused" });
  console.log(`  Possibly-unused subscriptions: ${unused.map((s) => s.name).join(", ")}`);

  await mongoose.connection.close();
  process.exit(0);
}

seed().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
