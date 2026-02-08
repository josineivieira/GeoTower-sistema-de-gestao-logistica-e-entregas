const { normalizeDeliveryForResponse } = require('./src/utils/storageUtils');

const sample = {
  documents: {
    canhotNF: ['[{"name":"NF_1770561417949_0.jpg"}]','{"path":"manaus/BBB/NF_1770561417949_0.jpg"}']
  }
};

console.log(JSON.stringify(normalizeDeliveryForResponse(sample), null, 2));
