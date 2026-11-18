require('dotenv').config({ quiet: true });

for (const key of ['DATABASE_URL', 'JWT_SECRET']) {
  if (!process.env[key]) {
    console.error(`Missing ${key} in .env (copy .env.example to .env and fill it in)`);
    process.exit(1);
  }
}

const app = require('./app');
const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`API running on http://localhost:${port}/api`));
