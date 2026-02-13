const mongoose = require('mongoose');

const motoristaSchema = new mongoose.Schema({
  transportadora: {
    type: String,
    required: [true, 'Transportadora é obrigatória'],
    trim: true
  },
  nome: {
    type: String,
    required: [true, 'Nome do motorista é obrigatório'],
    trim: true
  },
  cpf: {
    type: String,
    required: [true, 'CPF é obrigatório'],
    trim: true,
    match: [/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, 'CPF deve estar no formato XXX.XXX.XXX-XX']
  },
  vinculo: {
    type: String,
    enum: {
      values: ['PRÓPRIO', 'AGREGADO', 'TERCEIRO'],
      message: 'Vínculo deve ser: PRÓPRIO, AGREGADO ou TERCEIRO'
    },
    required: [true, 'Vínculo é obrigatório']
  },
  rastreador: {
    type: String,
    trim: true,
    default: '-'
  },
  expCadastroMotorista: {
    type: Date,
    default: null
  },
  cavalo: {
    type: String,
    trim: true,
    default: ''
  },
  rastreadorCavalo: {
    type: String,
    trim: true,
    default: ''
  },
  expCadastroCavalo: {
    type: Date,
    default: null
  },
  carreta: {
    type: String,
    trim: true,
    default: ''
  },
  rastreadorCarreta: {
    type: String,
    trim: true,
    default: ''
  },
  expCadastroCarreta: {
    type: Date,
    default: null
  },
  telefone: {
    type: String,
    required: [true, 'Telefone é obrigatório'],
    trim: true,
    validate: {
      validator: function(v) {
        // Extrai apenas os dígitos
        const digitos = v.replace(/\D/g, '');
        // Deve ter exatamente 11 dígitos (2 de DDD + 9 de número)
        return digitos.length === 11;
      },
      message: 'Telefone deve conter exatamente 11 dígitos (formato correto: (92) 98528-5394)'
    }
  },
  observacoes: {
    type: String,
    default: '',
    trim: true
  },
  ativo: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: () => new Date()
  },
  updatedAt: {
    type: Date,
    default: () => new Date()
  }
});

// Create a compound unique index for transportadora + cpf
motoristaSchema.index({ transportadora: 1, cpf: 1 }, { unique: true, sparse: true });

// Update updatedAt before save
motoristaSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

motoristaSchema.methods.toJSON = function() {
  const obj = this.toObject();
  return obj;
};

module.exports = mongoose.model('Motorista', motoristaSchema);
