const mongoose = require("mongoose");

const DeliverySchema = new mongoose.Schema(
  {
    deliveryNumber: { type: String, required: true }, // container
    vehiclePlate: { type: String, default: "" },      // transportadora no seu form
    observations: { type: String, default: "" },
    driverName: { type: String, default: "" },        // nome do motorista

    status: { 
      type: String, 
      enum: [
        'pending', 'submitted', 'AGENDADO', 'CONTAINER_MONTADO', 'AGUARDANDO_DESOVA',
        'EM_DESOVA', 'DESOVA_FINALIZADA', 'AGUARDANDO_ANEXO', 'ANEXANDO_DOCUMENTOS_FINAIS',
        'SAINDO_CLIENTE', 'RETORNANDO_PORTO', 'CHEGOU_PORTO',
        'ENTREGUE', 'CANCELADO', 'A_CAMINHO_DO_CLIENTE', 'ENTREGUE_COM_PENDENCIA_CANHOTO',
        'FINALIZADO'
      ],
      default: 'pending' 
    },

    // registrar quando o motorista marcou chegada no cliente
    arrivedAt: { type: Date },

    // registrar quando o container foi montado
    containerMontadoAt: { type: Date },

    // registrar quando o motorista iniciou e finalizou a desova
    desovaStartAt: { type: Date },
    desovaEndAt: { type: Date },

    // registrar quando o motorista confirmou a devolução do container vazio
    saidaClienteAt: { type: Date },
    chegadaPortoAt: { type: Date },
    horarioDevolucaoVazio: { type: Date },

    // Dados do recebedor
    recebedor: { type: String, default: "" },

    // Observação e metadata ao submeter com documentos faltando
    submissionObservation: { type: String, default: "" },
    submissionForce: { type: Boolean, default: false },
    missingDocumentsAtSubmit: { type: [String], default: [] },
    documentsJustification: { type: String, default: "" },
    documentCorrectionLog: {
      type: [
        {
          removedBy: { type: String, default: "" },
          role: { type: String, default: "" },
          documentType: { type: String, default: "" },
          reason: { type: String, default: "" },
          removedAt: { type: Date, default: Date.now }
        }
      ],
      default: []
    },

    // usuário que criou (motorista/admin)
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    userName: { type: String, default: "" },
    userEmail: { type: String, default: "" },

    deliveryDate: { type: Date, default: Date.now },

    // Identificação da cidade (Manaus, Itajaí, etc)
    cityCode: { 
      type: String, 
      enum: ['manaus', 'itajai'], 
      default: 'manaus',
      required: true
    },

    // Relacionamento com ProgramacaoEntrega
    linkedProgramacaoId: { type: mongoose.Schema.Types.ObjectId, ref: "ProgramacaoEntrega" },
    programacaoId: { type: mongoose.Schema.Types.ObjectId, ref: "ProgramacaoEntrega" },

    // caminhos/urls dos documentos
    documents: {
      canhotNF: { type: String, default: null },
      canhotCTE: { type: String, default: null },
      diarioBordo: { type: String, default: null },
      devolucaoVazio: { type: String, default: null },
      retiradaCheio: { type: String, default: null },
      chegadaCliente: { type: String, default: null }, // Fotos da chegada no cliente
      inicioDesova: { type: String, default: null },   // Fotos do início da desova
      fimDesova: { type: String, default: null },      // Fotos do fim da desova
      saidaCliente: { type: String, default: null },
      chegadaPorto: { type: String, default: null },
    },

    // Soft delete para cancelados
    isCanceled: { type: Boolean, default: false },
    canceledAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Índices para performance de consultas comuns
// Índices simples
DeliverySchema.index({ cityCode: 1 });
DeliverySchema.index({ status: 1 });
DeliverySchema.index({ isCanceled: 1 });
DeliverySchema.index({ deliveryNumber: 1 });
DeliverySchema.index({ createdAt: -1 });
DeliverySchema.index({ userName: 1 });
DeliverySchema.index({ driverId: 1 });

// Índices compostos (multi-campo) - maior impacto em performance
DeliverySchema.index({ cityCode: 1, status: 1 });
DeliverySchema.index({ cityCode: 1, isCanceled: 1 });
DeliverySchema.index({ cityCode: 1, createdAt: -1 });
DeliverySchema.index({ cityCode: 1, userName: 1 });
DeliverySchema.index({ status: 1, createdAt: -1 });
DeliverySchema.index({ userName: 1, createdAt: -1 });
DeliverySchema.index({ driverId: 1, cityCode: 1 });

// Índice de texto para busca (deliveryNumber + recebedor)
DeliverySchema.index({ deliveryNumber: 'text', recebedor: 'text' });
DeliverySchema.index({ cityCode: 1, deliveryNumber: 1 });
DeliverySchema.index({ cityCode: 1, status: 1 });
DeliverySchema.index({ cityCode: 1, linkedProgramacaoId: 1 });

module.exports = mongoose.model("Delivery", DeliverySchema);
