// app.ts
import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';

interface Bet { user: string; amount: number; guess: number; } // 1-6

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.post(
  '/bet',
  (req: Request<{}, {}, Bet>, res: Response) => {
    const { user, amount, guess } = req.body;
    if (guess < 1 || guess > 6) return res.status(400).send({ error: 'Guess must be between 1 and 6.' });

    const roll = Math.floor(Math.random() * 6) + 1;
    const won = guess === roll;
    res.send({ user, roll, won, payout: won ? amount * 6 : 0 });
  }
);

app.listen(3000, () => console.log('Server running on http://localhost:3000'));
