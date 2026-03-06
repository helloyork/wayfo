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
      enumerateVariants integer,
      groupId text,
      planItemId text,
      createdAt text not null,
      updatedAt text not null
    );

    create table if not exists jobs (
      id text primary key,
      runId text not null,
      step text not null,
      status text not null,
      inputHash text not null,
      schemaVersion text,
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
      contentHash text,
      schemaVersion text not null,
      createdAt text not null
    );

    create table if not exists product_groups (
      id text primary key,
      productKey text not null unique,
      primaryAsin text,
      createdAt text not null
    );

    create table if not exists product_group_members (
      id text primary key,
      groupId text not null,
      asin text not null,
      createdAt text not null,
      unique(groupId, asin)
    );

    create table if not exists plan_items (
      id text primary key,
      rowHash text not null unique,
      groupId text not null,
      amazonUrl text not null,
      sku text,
      partNumber text,
      upc text,
      planDate text not null,
      isActive integer not null default 1,
      isPrimary integer not null default 0,
      createdAt text not null
    );
  `);

  const runColumns = db
    .prepare("pragma table_info(runs)")
    .all() as Array<{ name: string }>;
  const hasEnumerateVariants = runColumns.some((column) => column.name === "enumerateVariants");
  if (!hasEnumerateVariants) {
    db.exec(
      "alter table runs add column enumerateVariants integer not null default 0;"
    );
  }

  const hasManufacturerId = runColumns.some((column) => column.name === "manufacturerId");
  if (!hasManufacturerId) {
    db.exec("alter table runs add column manufacturerId text;");
  }

  const hasGroupId = runColumns.some((column) => column.name === "groupId");
  if (!hasGroupId) {
    db.exec("alter table runs add column groupId text;");
  }

  const hasPlanItemId = runColumns.some((column) => column.name === "planItemId");
  if (!hasPlanItemId) {
    db.exec("alter table runs add column planItemId text;");
  }

  const jobColumns = db
    .prepare("pragma table_info(jobs)")
    .all() as Array<{ name: string }>;
  const hasJobSchemaVersion = jobColumns.some((column) => column.name === "schemaVersion");
  if (!hasJobSchemaVersion) {
    db.exec("alter table jobs add column schemaVersion text;");
  }

  const artifactColumns = db
    .prepare("pragma table_info(artifacts)")
    .all() as Array<{ name: string }>;
  const hasContentHash = artifactColumns.some((column) => column.name === "contentHash");
  if (!hasContentHash) {
    db.exec("alter table artifacts add column contentHash text;");
  }

  const planItemColumns = db
    .prepare("pragma table_info(plan_items)")
    .all() as Array<{ name: string }>;
  const hasUpc = planItemColumns.some((column) => column.name === "upc");
  if (!hasUpc) {
    db.exec("alter table plan_items add column upc text;");
  }
  const hasPlanItemActive = planItemColumns.some((column) => column.name === "isActive");
  if (!hasPlanItemActive) {
    db.exec("alter table plan_items add column isActive integer not null default 1;");
  }

  db.exec(`
    create index if not exists idx_jobs_idempotency
      on jobs (runId, step, inputHash, schemaVersion);
    create index if not exists idx_artifacts_hash
      on artifacts (runId, type, contentHash);
    create index if not exists idx_product_groups_key
      on product_groups (productKey);
    create index if not exists idx_product_group_members_asin
      on product_group_members (asin);
    create index if not exists idx_plan_items_group
      on plan_items (groupId);
    create index if not exists idx_plan_items_date
      on plan_items (planDate);
  `);

  dbInstance = db;
  return db;
}
