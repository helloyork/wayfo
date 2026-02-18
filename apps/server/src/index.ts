import { createServer } from "./api/server";
import { ensureDir, dataRoot, runsRoot } from "./core/paths";
import { getDb } from "./core/store/sqlite";

const port = Number(process.env.PORT ?? 4000);

ensureDir(dataRoot);
ensureDir(runsRoot);
getDb();

const app = createServer();

app.listen(port, () => {
  console.log(`Wayfo server listening on http://localhost:${port}`);
});
