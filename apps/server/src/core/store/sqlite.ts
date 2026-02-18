import path from "path";
import Database from "better-sqlite3";
import { dataRoot, ensureDir } from "../paths";

let dbInstance: Database.Database | null = null;

export function getDb() {
  if (dbInstance) {
    return dbInstance;
  }

  ensureDir(dataRoot);
  const dbPath = path.join(dataRoot, "wayfo.sqlite");
  const db = new Database(dbPath);

  db.exec(`
    create table if not exists runs (
      id text primary key,
      status text not null,
      currentStep text,
      amazonUrl text not null,
      marketContext text,
      createdAt text not null,
      updatedAt text not null
    );

    create table if not exists jobs (
      id text primary key,
      runId text not null,
      step text not null,
      status text not null,
      inputHash text not null,
      attempts integer not null,
      errorSummary text,
      createdAt text not null,
      updatedAt text not null
    );

    create table if not exists artifacts (
      id text primary key,
      runId text not null,
      jobId text,
      type text not null,
      path text not null,
      schemaVersion text not null,
      createdAt text not null
    );
  `);

  dbInstance = db;
  return db;
}
