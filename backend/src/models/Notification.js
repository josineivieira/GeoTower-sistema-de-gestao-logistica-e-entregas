const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: ['info', 'warning', 'error', 'success'],
      default: 'info'
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },

    // Roles que podem receber a notificação (filtrado no backend por role do usuário)
    recipientRoles: { type: [String], default: ['admin', 'manager'] },

    // Usuário que gerou a notificação (opcional)
    senderId: { type: String },
    senderName: { type: String },

    // Entidade relacionada (delivery, programacao, etc.)
    relatedEntity: {
      type: { type: String, enum: ['delivery', 'programacao', 'user'] },
      id: { type: String },
      number: { type: String } // container number, etc.
    },

    // Dados específicos da notificação
    metadata: { type: mongoose.Schema.Types.Mixed },

    // Cidade relacionada
    city: { type: String, default: 'manaus' },

    // Expiração (opcional)
    expiresAt: { type: Date }
  },
  {
    timestamps: true
  }
);

// Índices para performance
NotificationSchema.index({ city: 1, createdAt: -1 });
NotificationSchema.index({ recipientRoles: 1, createdAt: -1 });
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Notification", NotificationSchema);