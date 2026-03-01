/*
Database adapter resolver - MongoDB only (Postgres removed).
The rest of the application should import through `require('./dbAdapter')`
rather than explicitly referencing MongoDB or MockDB.

This adapter will:
1. If MONGODB_URI is set → connect to MongoDB Atlas or local MongoDB
2. If MONGODB_URI is NOT set → fallback to MockDB (in-memory, for testing)
*/

console.log('[DB] Using MongoDB/MockDB adapter (Postgres removed)');
module.exports = require('./mongodbAdapter');
