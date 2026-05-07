const dotenv = require('dotenv');
dotenv.config();
const { createApp } = require('./app');

const app = createApp();
const port = Number(process.env.PORT || 3000);
const { connectGridFS } = require('./db');

connectGridFS().then(({ bucket }) => {
  if (bucket) {
    console.log("MongoDB GridFS ready");
  }
}).catch(err => {
  console.warn("MongoDB GridFS failed to initialize during startup:", err.message);
});

app.listen(port, () => console.log(`Server listening on ${port}`));
