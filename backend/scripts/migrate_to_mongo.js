/*
Migration script: scans backend/data/<city>/db.json and backend/uploads/<city>/ and imports into MongoDB + S3 (if configured).
Usage: MONGO_URI="..." S3_BUCKET=... S3_REGION=... node scripts/migrate_to_mongo.js --dry-run
*/
const fs = require('fs');
const path = require('path');
const { connectIfNeeded } = require('../src/db/mongo');
const Driver = require('../src/models/Driver');
const Delivery = require('../src/models/Delivery');
const s3 = require('../src/storage/s3');

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log('Migration started', { dryRun });

  // Support both MONGODB_URI (new) and MONGO_URI (legacy)
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('MONGODB_URI or MONGO_URI not provided. Aborting.');
    process.exit(1);
  }

  // Ensure MONGODB_URI is set for connectIfNeeded()
  if (!process.env.MONGODB_URI && process.env.MONGO_URI) {
    process.env.MONGODB_URI = process.env.MONGO_URI;
  }

  await connectIfNeeded();

  const dataRoot = path.join(__dirname, '..', 'data');
  const uploadsRoot = path.join(__dirname, '..', 'uploads');

  const cities = fs.readdirSync(dataRoot).filter(f => fs.statSync(path.join(dataRoot, f)).isDirectory());
  console.log('Found cities:', cities);

  for (const city of cities) {
    const dbPath = path.join(dataRoot, city, 'db.json');
    if (!fs.existsSync(dbPath)) continue;

    console.log('\n=== Migrating city:', city, '===');
    const raw = fs.readFileSync(dbPath, 'utf8');
    const parsed = JSON.parse(raw);

    // Drivers
    for (const d of parsed.drivers || []) {
      console.log('Driver:', d.username || d.email);
      const existing = await Driver.findOne({ $or: [{ username: d.username }, { email: d.email }] }).exec();
      if (existing) {
        console.log('  - already exists, skipping create');
        continue;
      }

      if (dryRun) continue;

      // preserve username, email, name; store legacy sha256 as separate field so auth can handle it
      // Validar role: apenas 'driver', 'manager', 'admin' são válidos
      let role = d.role || 'driver';
      if (!['driver', 'manager', 'admin'].includes(role)) {
        console.log(`  - invalid role "${role}", using "driver" instead`);
        role = 'driver';
      }

      const payload = {
        username: d.username,
        email: d.email,
        name: d.fullName || d.name || d.username,
        password: d.password || 'driver123', // will be hashed by mongoose pre-save
        phone: d.phoneNumber || d.phone || null,
        isActive: d.isActive === undefined ? true : d.isActive,
        role: role
      };
      const created = await Driver.create(payload);

      // store legacy sha256 if present (from mockdb)
      if (d.password) {
        await Driver.updateOne({ _id: created._id }, { $set: { legacyPasswordSha256: d.password } }).exec();
      }

      console.log('  - created driver id:', created._id);
    }

    // Deliveries
    for (const del of parsed.deliveries || []) {
      console.log('Delivery:', del.deliveryNumber);
      if (dryRun) continue;

      // preserve original id in legacyId and let Mongo generate a new ObjectId
      const originalId = del._id || del.id || null;
      const payload = {
        deliveryNumber: del.deliveryNumber,
        vehiclePlate: del.vehiclePlate,
        observations: del.observations,
        driverName: del.driverName,
        status: del.status === 'draft' ? 'pending' : del.status,
        userName: del.userName,
        userEmail: del.userEmail || null,
        userId: null,
        documents: {},
        createdAt: del.createdAt ? new Date(del.createdAt) : undefined,
        updatedAt: del.updatedAt ? new Date(del.updatedAt) : undefined,
        submittedAt: del.submittedAt ? new Date(del.submittedAt) : undefined,
        city: del.city || city,
        legacyId: originalId
      };

      // Try to find userId by username/email mapping
      if (del.userId) {
        // The mockdb userId may be a string like driver1_... which is not a mongoose ObjectId.
        // We try to find a Driver by username/email matching userName or email
        const possible = await Driver.findOne({ $or: [{ username: del.userName }, { email: del.userEmail }] }).exec();
        if (possible) payload.userId = possible._id;
      }

      // Transfer files to S3 if configured. Normalize arrays to comma-separated strings to match current schema.
      if (del.documents && Object.keys(del.documents).length) {
        for (const [type, val] of Object.entries(del.documents)) {
          if (!val) continue;
          if (Array.isArray(val)) {
            const arr = [];
            for (const rel of val) {
              const fullPath = path.join(uploadsRoot, city, rel);
              if (fs.existsSync(fullPath) && process.env.S3_BUCKET) {
                const key = `${city}/${rel}`.replace(/\\/g, '/');
                try {
                  const buffer = fs.readFileSync(fullPath);
                  const url = await s3.uploadBuffer(buffer, key);
                  arr.push(url);
                } catch (err) {
                  console.error('S3 upload error:', err);
                }
              } else {
                arr.push(rel);
              }
            }
            // store as comma-separated string (keeps compatibility with current Delivery schema)
            payload.documents[type] = arr.join(',');
          } else {
            const rel = val;
            const fullPath = path.join(uploadsRoot, city, rel);
            if (fs.existsSync(fullPath) && process.env.S3_BUCKET) {
              const key = `${city}/${rel}`.replace(/\\/g, '/');
              try {
                const buffer = fs.readFileSync(fullPath);
                const url = await s3.uploadBuffer(buffer, key);
                payload.documents[type] = url;
              } catch (err) {
                console.error('S3 upload error:', err);
              }
            } else {
              payload.documents[type] = rel;
            }
          }
        }
      }

      // Skip if delivery already exists (by legacyId or deliveryNumber)
      const already = await Delivery.findOne({ $or: [{ legacyId: originalId }, { deliveryNumber: del.deliveryNumber }] }).exec();
      if (already) {
        console.log('  - delivery exists, skipping');
        continue;
      }

      // Insert delivery
      try {
        await Delivery.create(payload);
        console.log('  - delivery created');
      } catch (err) {
        console.error('  - failed to create delivery:', err && err.message);
      }
    }
  }

  console.log('\nMigration finished');
  process.exit(0);
}

main().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
