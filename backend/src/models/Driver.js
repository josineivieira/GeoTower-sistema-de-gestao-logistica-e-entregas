const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const driverSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  username: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  phone: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  role: {
    type: String,
    enum: ['driver', 'manager', 'admin', 'geomar', 'gestor_contratado'],
    default: 'driver'
  },
  // Contratado: GEO, MACHADO, BANDEIRA, TRANSCAVALCANTE, etc
  contratado: {
    type: String,
    trim: true,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  // Used during migration from mockdb: sha256 of password
  legacyPasswordSha256: {
    type: String,
    default: null
  }
  ,
  resetPasswordToken: { type: String, default: null },
  resetPasswordExpires: { type: Date, default: null }
});
// Índices para melhorar performance de busca (login)
driverSchema.index({ username: 1 });
driverSchema.index({ email: 1 });
driverSchema.index({ username: 1, email: 1 });
// Hash password before saving
driverSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
driverSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Remove password from response
driverSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('Driver', driverSchema);
