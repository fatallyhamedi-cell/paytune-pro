const app = require('./app');
require('dotenv').config();

const PORT = Number(process.env.PORT) || 3000;

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 PAYTUNE backend server listening on http://localhost:${PORT}`);
  });
}

module.exports = app;
