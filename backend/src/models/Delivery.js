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
    horarioDevolucaoVazio: { type: Date },

    // Dados do recebedor
    recebedor: { type: String, default: "" },

    // Observação e metadata ao submeter com documentos faltando
    submissionObservation: { type: String, default: "" },
    submissionForce: { type: Boolean, default: false },
    missingDocumentsAtSubmit: { type: [String], default: [] },
    documentsJustification: { type: String, default: "" },

    // Referência ao registro Ycompany correspondente (se existir)
    linkedYcompanyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ycompany',
      default: null
    },

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
