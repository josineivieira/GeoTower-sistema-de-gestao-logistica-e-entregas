const mongoose = require('mongoose');

const programacaoEntregaSchema = new mongoose.Schema({
  processo: {
    type: String,
    required: [true, 'Processo é obrigatório'],
    trim: true,
    unique: true,
    sparse: true
  },
  recebedor: {
    type: String,
    required: [true, 'Recebedor é obrigatório'],
    trim: true
  },
  container: {
    type: String,
    trim: true,
    default: '-'
  },
  dataAgendamento: {
    type: Date,
    required: [true, 'Data de agendamento é obrigatória']
  },
  contratado: {
    type: String,
    required: [true, 'Contratado é obrigatório'],
    trim: true
  },
  motorista: {
    type: String,
    trim: true,
    default: '-'
  },
  status: {
    type: String,
    enum: {
      values: [
        'AGENDADO',
        'AGUARDANDO_DESOVA',
        'EM_DESOVA',
        'AGUARDANDO_ANEXO',
        'EM_ROTA',
        'ENTREGUE',
        'CANCELADO'
      ],
      message: 'Status deve ser: AGENDADO, AGUARDANDO_DESOVA, EM_DESOVA, AGUARDANDO_ANEXO, EM_ROTA, ENTREGUE ou CANCELADO'
    },
    default: 'AGENDADO'
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

// Pre-save hook para atualizar timestamp
programacaoEntregaSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Índice para buscar por processo
programacaoEntregaSchema.index({ processo: 1 });
programacaoEntregaSchema.index({ dataAgendamento: 1 });
programacaoEntregaSchema.index({ status: 1 });

const ProgramacaoEntrega = mongoose.model('ProgramacaoEntrega', programacaoEntregaSchema);

module.exports = ProgramacaoEntrega;
