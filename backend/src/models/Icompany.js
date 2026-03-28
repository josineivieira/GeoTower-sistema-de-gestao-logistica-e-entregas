const mongoose = require('mongoose');

const icompanySchema = new mongoose.Schema({
  // Identificação
  codigo: {
    type: String,
    required: [true, 'Código é obrigatório'],
    unique: true,
    trim: true,
  },
  geomaritima: {
    type: String,
    trim: true,
  },

  // Datas principais
  dtInicio: {
    type: Date,
    default: new Date(),
  },
  dtInicioRota: {
    type: Date,
  },
  dtSM: {
    type: Date,
  },
  dtAgendamentoDescarga: {
    type: Date,
  },
  dtChegada: {
    type: Date,
  },
  dtInicioDescarga: {
    type: Date,
  },
  hrInicioDescarga: {
    type: String,
  },
  dtDescidaCNTRCarga: {
    type: Date,
  },
  dtRetiraPD: {
    type: Date,
  },
  dtFimDescarga: {
    type: Date,
  },
  dtColeta: {
    type: Date,
  },
  dtChegadaPlanta: {
    type: Date,
  },
  dtInicioCarregamento: {
    type: Date,
  },
  dtFimCarregamento: {
    type: Date,
  },
  dtSaidaPlanta: {
    type: Date,
  },
  dtEntradaPlanta: {
    type: Date,
  },
  dtDevolucaoCNTR: {
    type: Date,
  },
  dtAverbacaoMDFE: {
    type: Date,
  },

  // Confirmação do motorista
  arrivedAt: {
    type: Date,
  },

  // Situação
  situacao: {
    type: String,
    enum: ['AGENDADO', 'EM_ANDAMENTO', 'CONCLUÍDO', 'CANCELADO', 'PENDENTE'],
    default: 'PENDENTE',
  },

  // Partes envolvidas
  cliente: {
    type: String,
    trim: true,
  },
  remetente: {
    type: String,
    trim: true,
  },
  destinatario: {
    type: String,
    trim: true,
  },
  contratado: {
    type: String,
    trim: true,
  },

  // Tipo e transporte
  tipo: {
    type: String,
    trim: true,
  },
  motorista: {
    type: String,
    trim: true,
  },
  motoristaRetra: {
    type: String,
    trim: true,
  },
  motoristaPulmao: {
    type: String,
    trim: true,
  },
  tracao: {
    type: String,
    trim: true,
  },
  reboque: {
    type: String,
    trim: true,
  },

  // Origem e Destino
  origem: {
    type: String,
    trim: true,
  },
  ufColeta: {
    type: String,
    trim: true,
  },
  terminal: {
    type: String,
    trim: true,
  },
  destino: {
    type: String,
    trim: true,
  },
  ufEntrega: {
    type: String,
    trim: true,
  },

  // Valores
  vlFreteProcesso: {
    type: Number,
    default: 0,
  },
  vlPedagio: {
    type: Number,
    default: 0,
  },
  vlFreteLista: {
    type: Number,
    default: 0,
  },
  vlAbastecimento: {
    type: Number,
    default: 0,
  },

  // Pagamento
  pagamento: {
    type: String,
    trim: true,
  },
  tagPedagio: {
    type: String,
    trim: true,
  },

  // Documentação
  stabCTeNFSe: {
    type: String,
    trim: true,
  },
  numCTeNFSe: {
    type: String,
    trim: true,
  },
  numAverbacaoCTE: {
    type: String,
    trim: true,
  },
  numCIOT: {
    type: String,
    trim: true,
  },
  situacaoCIOT: {
    type: String,
    trim: true,
  },
  numMDFE: {
    type: String,
    trim: true,
  },
  situacaoMDFE: {
    type: String,
    trim: true,
  },

  // Booking / Marítimo
  numBooking: {
    type: String,
    trim: true,
  },
  numBookingAgendamento: {
    type: String,
    trim: true,
  },
  armador: {
    type: String,
    trim: true,
  },
  navio: {
    type: String,
    trim: true,
  },

  // Container/Carga
  numero: {
    type: String,
    trim: true,
  },
  tara: {
    type: Number,
    default: 0,
  },
  lacre: {
    type: String,
    trim: true,
  },
  payload: {
    type: Number,
    default: 0,
  },

  // Condições de carga
  temperatura: {
    type: Number,
    default: null,
  },
  umidade: {
    type: Number,
    default: null,
  },
  ventilacao: {
    type: Number,
    default: null,
  },
  pesoBruto: {
    type: Number,
    default: 0,
  },

  // Estabelecimento
  estab: {
    type: String,
    trim: true,
  },
  stabCT: {
    type: String,
    trim: true,
  },

  // Metadados
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  city: {
    type: String,
    enum: ['manaus', 'itajai'],
  },
}, {
  timestamps: true,
  collection: 'basegeomars',
});

// Índices para melhor performance
icompanySchema.index({ codigo: 1, city: 1 });
icompanySchema.index({ geomaritima: 1, city: 1 });
icompanySchema.index({ situacao: 1, city: 1 });
icompanySchema.index({ cliente: 1, city: 1 });
icompanySchema.index({ dtInicio: -1, city: 1 });

module.exports = mongoose.model('Icompany', icompanySchema, process.env.MONGO_COLLECTION || 'icompany');
