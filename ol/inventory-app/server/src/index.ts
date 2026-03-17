import express from "express";
import cors from "cors";
import { config } from "dotenv";

import roRouter from "./routes/debug-ro";
import productsRouter from "./routes/products";
import whRouter from "./routes/warehouse";

config();

const app = express();
app.use(cors());
app.use(express.json());

app.use("/ro", roRouter);
app.use("/", productsRouter);
app.use("/wh", whRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

const PORT = Number(process.env.PORT ?? 4000);
app.listen(PORT, () => {
  console.log(`server listening on :${PORT}`);
});
