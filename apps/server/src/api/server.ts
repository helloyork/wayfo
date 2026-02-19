import express from "express";
import cors from "cors";
import { runsRouter } from "./routes/runs";
import { settingsRouter } from "./routes/settings";

export function createServer() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "2mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api/runs", runsRouter);
  app.use("/api/settings", settingsRouter);

  return app;
}
