// Simple in-memory database using SQLite
const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

// Create in-memory database
const db = new Database(':memory:');

// Create tables
db.exec(`
  CREATE TABLE drivers (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    email TEXT,
    fullName TEXT,
    role TEXT DEFAULT 'driver',
    phoneNumber TEXT,
    cnh TEXT,
    createdAt INTEGER
  );

  CREATE TABLE deliveries (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    userName TEXT NOT NULL,
    deliveryNumber TEXT UNIQUE NOT NULL,
    vehiclePlate TEXT,
    status TEXT DEFAULT 'draft',
    documents TEXT DEFAULT '{}',
    createdAt INTEGER,
    updatedAt INTEGER,
    FOREIGN KEY (userId) REFERENCES drivers(id)
  );
`);

// Seed data with test users and deliveries
const seedData = () => {
  const bcrypt = require('bcrypt');
  const crypto = require('crypto');

  const adminHash = crypto.createHash('sha256').update('admin123').digest('hex');
  const managerHash = crypto.createHash('sha256').update('gerente123').digest('hex');
  const driverHash = crypto.createHash('sha256').update('driver123').digest('hex');

  const adminId = crypto.randomUUID();
  const managerId = crypto.randomUUID();
  const driver1Id = crypto.randomUUID();
  const driver2Id = crypto.randomUUID();

  // Insert test users
  db.prepare(`
    INSERT INTO drivers (id, username, password, email, fullName, role, phoneNumber, cnh, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(adminId, 'admin', adminHash, 'admin@test.com', 'Administrador', 'admin', '1199999999', '12345678901', Date.now());

  db.prepare(`
    INSERT INTO drivers (id, username, password, email, fullName, role, phoneNumber, cnh, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(managerId, 'gerente', managerHash, 'gerente@test.com', 'Gerente da Entrega', 'manager', '1199999999', '12345678901', Date.now());

  db.prepare(`
    INSERT INTO drivers (id, username, password, email, fullName, role, phoneNumber, cnh, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(driver1Id, 'motorista1', driverHash, 'motorista1@test.com', 'João Silva', 'driver', '11987654321', 'ABC1234567', Date.now());

  db.prepare(`
    INSERT INTO drivers (id, username, password, email, fullName, role, phoneNumber, cnh, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(driver2Id, 'motorista2', driverHash, 'motorista2@test.com', 'Maria Santos', 'driver', '11987654322', 'DEF1234567', Date.now());

  // Insert test deliveries
  const now = Date.now();
  db.prepare(`
    INSERT INTO deliveries (id, userId, userName, deliveryNumber, vehiclePlate, status, documents, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(crypto.randomUUID(), driver1Id, 'João Silva', 'ENT001', 'ABC1234', 'submitted', '{"canhotNF":"EMOV001/canhotNF.jpg"}', now - 2*24*60*60*1000, now);

  db.prepare(`
    INSERT INTO deliveries (id, userId, userName, deliveryNumber, vehiclePlate, status, documents, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(crypto.randomUUID(), driver1Id, 'João Silva', 'ENT002', 'ABC1234', 'draft', '{}', now, now);

  db.prepare(`
    INSERT INTO deliveries (id, userId, userName, deliveryNumber, vehiclePlate, status, documents, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(crypto.randomUUID(), driver2Id, 'Maria Santos', 'ENT003', 'XYZ9876', 'submitted', '{"canhotNF":"EMOV002/canhotNF.jpg"}', now - 24*60*60*1000, now);

  db.prepare(`
    INSERT INTO deliveries (id, userId, userName, deliveryNumber, vehiclePlate, status, documents, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(crypto.randomUUID(), driver2Id, 'Maria Santos', 'ENT004', 'XYZ9876', 'submitted', '{"canhotNF":"EMOV002/canhotNF.jpg","canhotCTE":"EMOV002/canhotCTE.jpg"}', now - 3*60*60*1000, now);

  console.log('✓ Test data seeded');
};

// Database operations
module.exports = {
  db,
  seedData,

  // Users
  findUserByUsername: (username) => {
    return db.prepare('SELECT * FROM drivers WHERE username = ?').get(username);
  },

  findUserById: (id) => {
    return db.prepare('SELECT * FROM drivers WHERE id = ?').get(id);
  },

  createUser: (user) => {
    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO drivers (id, username, password, email, fullName, role, phoneNumber, cnh, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, user.username, user.password, user.email, user.fullName, user.role || 'driver', user.phoneNumber, user.cnh, Date.now());
    return { id, ...user };
  },

  // Deliveries
  findAllDeliveries: (filters = {}) => {
    let query = 'SELECT * FROM deliveries WHERE 1=1';
    const params = [];

    if (filters.status && filters.status !== 'all') {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters.q) {
      query += ' AND (deliveryNumber LIKE ? OR vehiclePlate LIKE ? OR userName LIKE ?)';
      const search = `%${filters.q}%`;
      params.push(search, search, search);
    }

    query += ' ORDER BY createdAt DESC';
    return db.prepare(query).all(...params);
  },

  findDeliveryById: (id) => {
    return db.prepare('SELECT * FROM deliveries WHERE id = ?').get(id);
  },

  createDelivery: (delivery) => {
    const id = crypto.randomUUID();
    const now = Date.now();
    db.prepare(`
      INSERT INTO deliveries (id, userId, userName, deliveryNumber, vehiclePlate, status, documents, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, delivery.userId, delivery.userName, delivery.deliveryNumber, delivery.vehiclePlate, delivery.status || 'draft', JSON.stringify(delivery.documents || {}), now, now);
    return { id, ...delivery, createdAt: now, updatedAt: now };
  },

  updateDelivery: (id, updates) => {
    const now = Date.now();
    const documents = updates.documents ? JSON.stringify(updates.documents) : undefined;
    
    let query = 'UPDATE deliveries SET updatedAt = ?';
    const params = [now];

    if (updates.status) {
      query += ', status = ?';
      params.push(updates.status);
    }
    if (documents) {
      query += ', documents = ?';
      params.push(documents);
    }

    query += ' WHERE id = ?';
    params.push(id);

    db.prepare(query).run(...params);
    return this.findDeliveryById(id);
  },

  deleteDelivery: (id) => {
    db.prepare('DELETE FROM deliveries WHERE id = ?').run(id);
  }
};
