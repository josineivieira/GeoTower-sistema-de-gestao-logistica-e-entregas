require('dotenv').config();
const mongoose = require('mongoose');
const Ycompany = require('./src/models/Ycompany');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const sample = await Ycompany.findOne().lean();
    
    if (sample) {
      console.log('\n=== CAMPOS PREENCHIDOS NO YCOMPANY ===\n');
      Object.keys(sample).forEach(key => {
        const value = sample[key];
        if (value !== null && value !== undefined && String(value).trim() !== '') {
          console.log(`${key}: ${String(value).substring(0, 60)}`);
        }
      });
    }
    
    process.exit(0);
  } catch(e) {
    console.error('Erro:', e.message);
    process.exit(1);
  }
})();
