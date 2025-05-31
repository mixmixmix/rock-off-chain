import express from 'express';
import cors from 'cors';

const app = express();
const port = 3000;

app.use(cors());

app.get('/roll-dice', (req, res) => {
  const roll = Math.floor(Math.random() * 6) + 1;
  res.json({ roll });
});

app.listen(port, () => {
  console.log(`Dice app listening at http://localhost:${port}`);
});
