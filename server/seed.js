/**
 * Sample data seed script.
 * Run: node seed.js
 * Requires: MONGODB_URI in .env
 *
 * Creates 7 sample listings covering all demo scenarios:
 * 1. Clean listing
 * 2. Misleading claim
 * 3. Incomplete information
 * 4. Invalid price (blocked by backend validation)
 * 5. Unsupported category (blocked by backend validation)
 * 6. Listing requiring wording revision
 * 7. Beauty listing with prohibited medical claims
 */

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const crypto = require('crypto');
const Listing = require('./src/models/Listing');

const normalize = (s) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();

function computeHash(listing) {
  const raw = [
    normalize(listing.title),
    normalize(listing.description),
    normalize(listing.category),
    normalize(listing.seller?.name),
  ].join('||');
  return crypto.createHash('sha256').update(raw).digest('hex');
}

const sampleListings = [
  // 1. Clean listing — should pass all checks
  {
    title: 'Sony WH-1000XM5 Wireless Noise-Cancelling Headphones',
    description: 'Sony WH-1000XM5 headphones feature industry-leading noise cancellation with 8 microphones and Auto NC Optimizer. Up to 30-hour battery life with quick charge (3 min = 3 hours). Multipoint connection allows pairing with two devices simultaneously. Soft fit leather, lightweight design at 250g. Compatible with Android and iOS.',
    category: 'Electronics',
    price: 349.99,
    attributes: { 'Battery Life': '30 hours', 'Weight': '250g', 'Bluetooth': '5.2', 'Color': 'Black' },
    seller: { name: 'TechStore Pro', contact: 'hello@techstorepro.com' },
    tags: ['headphones', 'wireless', 'noise-cancelling', 'sony'],
  },
  // 2. Misleading claim — contains prohibited superlatives
  {
    title: 'Best Phone Ever — 100% Guaranteed Lowest Price in the Market',
    description: 'This is the world\'s number one smartphone with guaranteed lowest prices anywhere. Our phone beats every competitor and is clinically proven to improve productivity. Once in a lifetime deal — act now before stock runs out forever. Unlimited performance, zero lag, no other phone comes close.',
    category: 'Electronics',
    price: 999.99,
    attributes: { 'Storage': '256GB', 'RAM': '12GB', 'Color': 'Space Grey' },
    seller: { name: 'MobileDeals24', contact: 'sales@mobiledeals24.com' },
    tags: ['smartphone', 'mobile', 'deals'],
  },
  // 3. Incomplete listing — vague description, missing attributes
  {
    title: 'Running Shoes',
    description: 'Good shoes for running.',
    category: 'Sports',
    price: 89.00,
    attributes: {},
    seller: { name: 'SportShop', contact: '' },
    tags: [],
  },
  // 4. Listing requiring wording revision — hype language, comparative claims
  {
    title: 'Revolutionary Anti-Aging Serum — Outperforms All Competitors',
    description: 'Our mind-blowing, revolutionary anti-aging serum is scientifically proven to reverse aging by 10 years. Unlike any competitor, this game-changing formula cures wrinkles and treats all skin conditions. Amazing results guaranteed within 7 days or we will refund you completely. Risk-free, zero side effects.',
    category: 'Beauty',
    price: 79.99,
    attributes: { 'Volume': '30ml', 'Type': 'Serum' },
    seller: { name: 'GlowLab Beauty', contact: 'care@glowlab.com' },
    tags: ['skincare', 'serum', 'anti-aging'],
  },
  // 5. Clean Electronics listing — should pass with minor notes
  {
    title: 'Logitech MX Master 3S Wireless Mouse',
    description: 'The Logitech MX Master 3S wireless mouse features an ultra-fast MagSpeed electromagnetic scroll wheel, 8K DPI precision tracking on any surface, and Quiet Clicks reducing click noise by 90%. Connect up to 3 devices via Bluetooth or USB receiver. 70-day battery life. USB-C charging. Compatible with Windows, macOS, Linux, iPadOS.',
    category: 'Electronics',
    price: 99.99,
    attributes: { 'DPI': '200-8000', 'Battery': '70 days', 'Connectivity': 'Bluetooth / USB', 'Weight': '141g' },
    seller: { name: 'TechStore Pro', contact: 'hello@techstorepro.com' },
    tags: ['mouse', 'wireless', 'logitech', 'productivity'],
  },
  // 6. Clothing listing — missing key attributes, needs revision
  {
    title: 'Mens Casual T-Shirt — Summer Collection',
    description: 'A comfortable casual t-shirt for men, perfect for everyday wear. Available in multiple colors. Great for summer activities.',
    category: 'Clothing',
    price: 24.99,
    attributes: { 'Color': 'Blue' },
    seller: { name: 'FashionForward', contact: 'info@fashionforward.com' },
    tags: ['t-shirt', 'clothing', 'casual'],
  },
  // 7. Services listing — with unverifiable claims
  {
    title: 'Professional SEO Services — Guaranteed #1 Google Ranking',
    description: 'Our SEO experts guarantee your website will rank number one on Google within 30 days. We use proven techniques that beat all competitor agencies. Best SEO service in the world with 100% success rate. We have never failed a client. Your money back if you are not on page one.',
    category: 'Services',
    price: 499.00,
    attributes: { 'Duration': '30 days', 'Includes': 'Full audit, on-page, link building' },
    seller: { name: 'RankBoost Agency', contact: 'hello@rankboost.com' },
    tags: ['seo', 'marketing', 'services', 'digital'],
  },
];

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  // Clear existing listings
  await Listing.deleteMany({});
  console.log('Cleared existing listings');

  for (const data of sampleListings) {
    const contentHash = computeHash(data);
    try {
      await Listing.create({ ...data, contentHash });
      console.log(`✓ Created: ${data.title.slice(0, 50)}`);
    } catch (err) {
      if (err.code === 11000) {
        console.log(`⚠ Duplicate skipped: ${data.title.slice(0, 50)}`);
      } else {
        console.error(`✗ Failed: ${data.title.slice(0, 50)} — ${err.message}`);
      }
    }
  }

  await mongoose.disconnect();
  console.log('\nSeed complete.');
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
