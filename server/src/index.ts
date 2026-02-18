import cors from 'cors';
import express from 'express';
import conversationsRouter from './routes/conversations.js';
import nodesRouter from './routes/nodes.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use(conversationsRouter);
app.use(nodesRouter);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
});

const port = process.env.PORT ? Number(process.env.PORT) : 3001;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
