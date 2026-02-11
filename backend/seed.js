const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const path = require('path');
const dotenv = require('dotenv');

// Carrega variáveis de ambiente
dotenv.config({ path: path.join(__dirname, '../.env') });

const Driver = require('./src/models/Driver');
const Delivery = require('./src/models/Delivery');

// Conecta ao MongoDB
const connectDB = async () => {
  try {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    try {
      const mongoServer = await MongoMemoryServer.create();
      const mongoUri = mongoServer.getUri();
      await mongoose.connect(mongoUri);
      console.log('✓ MongoDB em memória conectado');
    } catch (err) {
      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/delivery-docs';
      await mongoose.connect(mongoUri);
      console.log('✓ MongoDB localhost conectado');
    }
  } catch (error) {
    console.error('✗ Erro ao conectar MongoDB:', error.message);
    process.exit(1);
  }
};

const seedDatabase = async () => {
  try {
    await connectDB();

    // Limpa dados antigos
    await Driver.deleteMany({});
    await Delivery.deleteMany({});
    console.log('✓ Banco limpo');

    // Cria usuários de teste
    const adminPassword = await bcrypt.hash('admin123', 10);
    const managerPassword = await bcrypt.hash('gerente123', 10);
    const driverPassword = await bcrypt.hash('driver123', 10);

    const admin = await Driver.create({
      username: 'admin',
      password: adminPassword,
      email: 'admin@test.com',
      fullName: 'Administrador',
      role: 'admin',
      phoneNumber: '1199999999',
      cnh: '12345678901'
    });

    const manager = await Driver.create({
      username: 'gerente',
      password: managerPassword,
      email: 'gerente@test.com',
      fullName: 'Gerente da Entrega',
      role: 'manager',
      phoneNumber: '1199999999',
      cnh: '12345678901'
    });

    const driver1 = await Driver.create({
      username: 'motorista1',
      password: driverPassword,
      email: 'motorista1@test.com',
      fullName: 'João Silva',
      role: 'driver',
      phoneNumber: '11987654321',
      cnh: 'ABC1234567'
    });

    const driver2 = await Driver.create({
      username: 'motorista2',
      password: driverPassword,
      email: 'motorista2@test.com',
      fullName: 'Maria Santos',
      role: 'driver',
      phoneNumber: '11987654322',
      cnh: 'DEF1234567'
    });

    console.log('✓ Usuários criados:');
    console.log('  - admin / admin123');
    console.log('  - gerente / gerente123');
    console.log('  - motorista1 / driver123');
    console.log('  - motorista2 / driver123');

    // Cria entregas de teste
    const deliveries = [];

    // Entregas do motorista 1
    deliveries.push(await Delivery.create({
      userId: driver1._id,
      userName: driver1.fullName,
      deliveryNumber: 'ENT001',
      vehiclePlate: 'ABC1234',
      status: 'submitted',
      documents: {
        canhotNF: 'EMOV001/canhotNF_ENT001.jpg',
        canhotCTE: 'EMOV001/canhotCTE_ENT001.jpg'
      },
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    }));

    deliveries.push(await Delivery.create({
      userId: driver1._id,
      userName: driver1.fullName,
      deliveryNumber: 'ENT002',
      vehiclePlate: 'ABC1234',
      status: 'draft',
      documents: {},
      createdAt: new Date()
    }));

    // Entregas do motorista 2
    deliveries.push(await Delivery.create({
      userId: driver2._id,
      userName: driver2.fullName,
      deliveryNumber: 'ENT003',
      vehiclePlate: 'XYZ9876',
      status: 'submitted',
      documents: {
        canhotNF: 'EMOV002/canhotNF_ENT003.jpg'
      },
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
    }));

    deliveries.push(await Delivery.create({
      userId: driver2._id,
      userName: driver2.fullName,
      deliveryNumber: 'ENT004',
      vehiclePlate: 'XYZ9876',
      status: 'submitted',
      documents: {
        canhotNF: 'EMOV002/canhotNF_ENT004.jpg',
        canhotCTE: 'EMOV002/canhotCTE_ENT004.jpg',
        diarioBordo: 'EMOV002/diarioBordo_ENT004.jpg'
      },
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000)
    }));

    console.log(`✓ ${deliveries.length} entregas criadas`);

    console.log('\n═════════════════════════════════════');
    console.log('✓ BANCO DE DADOS POPULADO COM SUCESSO!');
    console.log('═════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('✗ Erro ao popular banco:', error);
    process.exit(1);
  }
};

seedDatabase();
