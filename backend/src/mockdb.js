// Mock MongoDB database with file persistence (per-city instances)
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class MockDatabase {
  constructor(dbFile) {
    this.DB_FILE = dbFile || path.join(__dirname, '../data/db.json');
    this.collections = {
      drivers: [],
      deliveries: []
    };
    this.init();
  }

  ensureDataDir() {
    const dataDir = path.dirname(this.DB_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  loadFromFile() {
    try {
      if (fs.existsSync(this.DB_FILE)) {
        const data = fs.readFileSync(this.DB_FILE, 'utf8');
        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch (parseErr) {
          // Backup corrupted file to avoid silent overwrite
          const corruptPath = this.DB_FILE + '.corrupt.' + Date.now();
          try {
            fs.renameSync(this.DB_FILE, corruptPath);
            console.error(`⚠️ db.json parse error. Backed up corrupt file to ${corruptPath}`);
          } catch (mvErr) {
            console.error('⚠️ Falha ao mover arquivo corrompido:', mvErr);
          }
          return false;
        }
        this.collections = parsed;
        console.log('✓ Database loaded from file', this.DB_FILE);
        return true;
      }
    } catch (error) {
      console.error('Erro ao carregar banco:', error);
    }
    return false;
  }

  saveToFile() {
    try {
      this.ensureDataDir();
      // Write atomically: write to temp file then rename
      const tmpPath = this.DB_FILE + '.tmp';
      fs.writeFileSync(tmpPath, JSON.stringify(this.collections, null, 2));
      fs.renameSync(tmpPath, this.DB_FILE);
    } catch (error) {
      console.error('Erro ao salvar banco:', error);
    }
  }

  init() {
    // Tenta carregar dados existentes
    if (this.loadFromFile()) {
      return;
    }

    // Se não existir, cria dados iniciais
    const adminId = 'admin_' + crypto.randomUUID();
    const managerId = 'manager_' + crypto.randomUUID();
    const driver1Id = 'driver1_' + crypto.randomUUID();
    const driver2Id = 'driver2_' + crypto.randomUUID();

    const hashPassword = (pwd) => crypto.createHash('sha256').update(pwd).digest('hex');

    const now = new Date();
    
    this.collections.drivers = [
      {
        _id: adminId,
        username: 'admin',
        password: hashPassword('admin123'),
        email: 'admin@test.com',
        name: 'Administrador',
        fullName: 'Administrador',
        role: 'admin',
        phoneNumber: '1199999999',
        cnh: '12345678901',
        isActive: true,
        createdAt: now.toISOString()
      },
      {
        _id: managerId,
        username: 'gerente',
        password: hashPassword('gerente123'),
        email: 'gerente@test.com',
        name: 'Gerente',
        fullName: 'Gerente da Entrega',
        role: 'manager',
        phoneNumber: '1199999999',
        cnh: '12345678901',
        isActive: true,
        createdAt: now.toISOString()
      },
      {
        _id: driver1Id,
        username: 'motorista1',
        password: hashPassword('driver123'),
        email: 'motorista1@test.com',
        name: 'João Silva',
        fullName: 'João Silva',
        role: 'driver',
        phoneNumber: '11987654321',
        cnh: 'ABC1234567',
        isActive: true,
        createdAt: now.toISOString()
      },
      {
        _id: driver2Id,
        username: 'motorista2',
        password: hashPassword('driver123'),
        email: 'motorista2@test.com',
        name: 'Maria Santos',
        fullName: 'Maria Santos',
        role: 'driver',
        phoneNumber: '11987654322',
        cnh: 'DEF1234567',
        isActive: true,
        createdAt: now.toISOString()
      }
    ];

    this.collections.deliveries = [
      {
        _id: 'ent1_' + crypto.randomUUID(),
        userId: driver1Id,
        userName: 'João Silva',
        driverName: 'João Silva',
        deliveryNumber: 'ENT001',
        vehiclePlate: 'ABC1234',
        status: 'submitted',
        documents: { canhotNF: 'ENT001/NF.jpg' },
        createdAt: new Date(now - 2*24*60*60*1000).toISOString(),
        submittedAt: new Date(now - 2*24*60*60*1000).toISOString(),
        updatedAt: new Date(now - 2*24*60*60*1000).toISOString()
      },
      {
        _id: 'ent2_' + crypto.randomUUID(),
        userId: driver1Id,
        userName: 'João Silva',
        driverName: 'João Silva',
        deliveryNumber: 'ENT002',
        vehiclePlate: 'ABC1234',
        status: 'draft',
        documents: {},
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      },
      {
        _id: 'ent3_' + crypto.randomUUID(),
        userId: driver2Id,
        userName: 'Maria Santos',
        driverName: 'Maria Santos',
        deliveryNumber: 'ENT003',
        vehiclePlate: 'XYZ9876',
        status: 'submitted',
        documents: { canhotNF: 'ENT003/NF.jpg' },
        createdAt: new Date(now - 24*60*60*1000).toISOString(),
        submittedAt: new Date(now - 24*60*60*1000).toISOString(),
        updatedAt: new Date(now - 24*60*60*1000).toISOString()
      },
      {
        _id: 'ent4_' + crypto.randomUUID(),
        userId: driver2Id,
        userName: 'Maria Santos',
        driverName: 'Maria Santos',
        deliveryNumber: 'ENT004',
        vehiclePlate: 'XYZ9876',
        status: 'submitted',
        documents: { canhotNF: 'ENT004/NF.jpg', canhotCTE: 'ENT004/CTE.jpg' },
        createdAt: new Date(now - 3*60*60*1000).toISOString(),
        submittedAt: new Date(now - 3*60*60*1000).toISOString(),
        updatedAt: new Date(now - 3*60*60*1000).toISOString()
      }
    ];

    this.saveToFile();
    console.log('✓ Database initialized and saved', this.DB_FILE);
  }

  find(model, query = {}) {
    const collection = this.collections[model];
    if (!collection) return [];
    
    let results = [...collection];
    
    // Filter by query
    if (Object.keys(query).length > 0) {
      results = results.filter(item => {
        for (let [key, value] of Object.entries(query)) {
          if (key === '$or') {
            // Handle OR queries: valor é um array de objetos de query
            const orMatch = value.some(orQuery => {
              // Cada orQuery é like: { deliveryNumber: { $regex: '...', $options: 'i' } }
              return Object.entries(orQuery).every(([fieldName, fieldQuery]) => {
                // fieldName é tipo "deliveryNumber", fieldQuery é tipo { $regex: '...', $options: 'i' }
                if (typeof fieldQuery === 'object' && fieldQuery.$regex) {
                  // Trata regex com case-insensitive
                  return new RegExp(fieldQuery.$regex, 'i').test(String(item[fieldName]));
                }
                // Trata igualdade simples
                return item[fieldName] === fieldQuery;
              });
            });
            if (!orMatch) return false;
          } else if (typeof value === 'object' && value.$regex) {
            if (!new RegExp(value.$regex, 'i').test(String(item[key]))) return false;
          } else {
            if (item[key] !== value) return false;
          }
        }
        return true;
      });
    }

    return results;
  }

  findOne(model, query = {}) {
    const results = this.find(model, query);
    return results.length > 0 ? results[0] : null;
  }

  findById(model, id) {
    const results = this.find(model, { _id: id });
    return results.length > 0 ? results[0] : null;
  }

  create(model, data) {
    const collection = this.collections[model];
    if (!collection) return null;

    if (model === 'deliveries') {
      console.log('📦 Salvando entrega no mockdb:', data);
    }

    const item = {
      _id: crypto.randomUUID(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    collection.push(item);
    this.saveToFile();
    return item;
  }

  updateOne(model, query, updates) {
    const item = this.findOne(model, query);
    if (!item) return null;

    Object.assign(item, updates, { updatedAt: new Date().toISOString() });
    this.saveToFile();
    return item;
  }

  deleteOne(model, query) {
    const collection = this.collections[model];
    if (!collection) return false;

    const index = collection.findIndex(item => {
      for (let [key, value] of Object.entries(query)) {
        if (item[key] !== value) return false;
      }
      return true;
    });

    if (index > -1) {
      collection.splice(index, 1);
      this.saveToFile();
      return true;
    }
    return false;
  }
}

// Cache per city
const instances = {};

function forCity(city = 'manaus') {
  const name = String(city || 'manaus').toLowerCase();

  // If MONGODB_URI is present, use MongoDB adapter (keeps same API surface)
  if (process.env.MONGODB_URI) {
    try {
      const mongoAdapter = require('./mongodbAdapter');
      return mongoAdapter.forCity(name);
    } catch (err) {
      console.error('Error loading mongodb adapter, falling back to file mockdb:', err);
    }
  }

  if (!instances[name]) {
    // If BACKEND_DATA_DIR is provided, use it to store per-city DB files (persistent disk)
    const baseDir = process.env.BACKEND_DATA_DIR ? path.resolve(process.env.BACKEND_DATA_DIR) : path.join(__dirname, '..', 'data');
    const dbPath = path.join(baseDir, name, 'db.json');
    console.log('📁 MockDB using file:', dbPath);
    instances[name] = new MockDatabase(dbPath);
  }
  return instances[name];
}

// Export forCity
module.exports.forCity = forCity;

// Default lazy proxy: delegate to current forCity('manaus') implementation at call time
const defaultProxy = {
  find: (...args) => forCity('manaus').find(...args),
  findOne: (...args) => forCity('manaus').findOne(...args),
  findById: (...args) => forCity('manaus').findById(...args),
  create: (...args) => forCity('manaus').create(...args),
  updateOne: (...args) => forCity('manaus').updateOne(...args),
  deleteOne: (...args) => forCity('manaus').deleteOne(...args),
  forCity
};

module.exports = defaultProxy;
