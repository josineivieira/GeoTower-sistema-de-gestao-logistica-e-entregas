const mongoose = require('mongoose');

const programacaoEntregaSchema = new mongoose.Schema({
  processo: {
    type: String,
    required: [true, 'Processo é obrigatório'],
    trim: true,
    unique: true,
    sparse: true
  },
  processoLog: {
    type: String,
    trim: true,
    default: ''
  },
  recebedor: {
    type: String,
    required: [true, 'Recebedor é obrigatório'],
    trim: true
  },
  remetente: {
    type: String,
    trim: true,
    default: ''
  },
  destinatario: {
    type: String,
    trim: true,
    default: ''
  },
  container: {
    type: String,
    trim: true,
    default: '-'
  },
  armador: {
    type: String,
    trim: true,
    default: ''
  },
  dataAgendamento: {
    type: String,
    required: [true, 'Data de agendamento é obrigatória'],
    trim: true
  },
  dtColeta: {
    type: String,
    trim: true,
    default: ''
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
  linkedDeliveryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Delivery',
    default: null
  },
  status: {
    type: String,
    enum: {
      values: [
        'AGENDADO',
        'CONTAINER_MONTADO',
        'A_CAMINHO_DO_CLIENTE',
        'AGUARDANDO_DESOVA',
        'EM_DESOVA',
        'AGUARDANDO_ANEXO',
        'ANEXANDO_DOCUMENTOS_FINAIS',
        'ENTREGUE',
        'FINALIZADO',
        'ENTREGUE_COM_PENDENCIA_CANHOTO',
        'CANCELADO'
      ],
      message: 'Status deve ser um dos valores válidos'
    },
    default: 'AGENDADO'
  },
  // indica se o motorista já confirmou a devolução do container vazio
  containerReturned: {
    type: Boolean,
    default: false,
  },
  observacoes: {
    type: String,
    default: '',
    trim: true
  },
  origem: {
    type: String,
    trim: true,
    default: ''
  },
  estab: {
    type: String,
    trim: true,
    enum: ['', 'LAM', 'LSC'],
    default: ''
  },
  sentido: {
    type: String,
    trim: true,
    uppercase: true,
    enum: ['', 'ORIGEM', 'DESTINO'],
    default: ''
  },
  ativo: {
    type: Boolean,
    default: true
  },
  editedBy: {
    type: String,
    default: '',
    trim: true
  },
  editedAt: {
    type: Date
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

// Índices para performance de consultas
// Índices simples
programacaoEntregaSchema.index({ processo: 1 });
programacaoEntregaSchema.index({ dataAgendamento: 1 });
programacaoEntregaSchema.index({ status: 1 });
programacaoEntregaSchema.index({ origem: 1 });
programacaoEntregaSchema.index({ estab: 1 });
programacaoEntregaSchema.index({ sentido: 1 });
programacaoEntregaSchema.index({ contratado: 1 });
programacaoEntregaSchema.index({ ativo: 1 });

// Índices compostos (multi-campo) para queries frequentes
programacaoEntregaSchema.index({ origem: 1, dataAgendamento: 1 });
programacaoEntregaSchema.index({ origem: 1, dtColeta: 1 });
programacaoEntregaSchema.index({ estab: 1, dataAgendamento: 1 });
programacaoEntregaSchema.index({ estab: 1, dtColeta: 1 });
programacaoEntregaSchema.index({ estab: 1, sentido: 1, dataAgendamento: 1 });
programacaoEntregaSchema.index({ estab: 1, sentido: 1, dtColeta: 1 });
programacaoEntregaSchema.index({ sentido: 1, status: 1 });
programacaoEntregaSchema.index({ contratado: 1, status: 1 });
programacaoEntregaSchema.index({ contratado: 1, ativo: 1 });
programacaoEntregaSchema.index({ ativo: 1, status: 1 });
programacaoEntregaSchema.index({ dataAgendamento: 1, status: 1 });

// Índices de text search
programacaoEntregaSchema.index({ processo: 'text', container: 'text', armador: 'text', recebedor: 'text', remetente: 'text', destinatario: 'text' });

const ProgramacaoEntrega = mongoose.model('ProgramacaoEntrega', programacaoEntregaSchema);

module.exports = ProgramacaoEntrega;
