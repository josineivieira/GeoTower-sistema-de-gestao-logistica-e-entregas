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
        'EM_DESOVA', 'AGUARDANDO_ANEXO', 'ANEXANDO_DOCUMENTOS_FINAIS', 'EM_ROTA',
        'ENTREGUE', 'CANCELADO', 'A_CAMINHO_DO_CLIENTE', 'ENTREGUE_COM_PENDENCIA_CANHOTO'
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

    // Etapa atual do fluxo de desova
    currentStep: { type: String, default: "" },

    // Dados do recebedor
    recebedor: { type: String, default: "" },

    // Observação e metadata ao submeter com documentos faltando
    submissionObservation: { type: String, default: "" },
    submissionForce: { type: Boolean, default: false },
    missingDocumentsAtSubmit: { type: [String], default: [] },
    documentsJustification: { type: String, default: "" },

    // usuário que criou (motorista/admin)
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    userName: { type: String, default: "" },
    userEmail: { type: String, default: "" },

    deliveryDate: { type: Date, default: Date.now },

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
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Delivery", DeliverySchema);
