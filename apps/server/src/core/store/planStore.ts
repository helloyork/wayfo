import { nanoid } from "nanoid";
import { getDb } from "./sqlite";

export type ProductGroup = {
  id: string;
  productKey: string;
  primaryAsin?: string | null;
  createdAt: string;
};

export type PlanItem = {
  id: string;
  rowHash: string;
  groupId: string;
  amazonUrl: string;
  sku?: string | null;
  partNumber?: string | null;
  upc?: string | null;
  planDate: string;
  isActive: boolean;
  isPrimary: boolean;
  createdAt: string;
};

export function getProductGroupByAsin(asin: string): ProductGroup | null {
  const db = getDb();
  const row = db.prepare(
    `
      select pg.id, pg.productKey, pg.primaryAsin, pg.createdAt
      from product_groups pg
      inner join product_group_members m on m.groupId = pg.id
      where m.asin = @asin
      limit 1
    `
  ).get({ asin }) as ProductGroup | undefined;
  return row ?? null;
}

export function getProductGroupByKey(productKey: string): ProductGroup | null {
  const db = getDb();
  const row = db.prepare(
    "select id, productKey, primaryAsin, createdAt from product_groups where productKey = @productKey"
  ).get({ productKey }) as ProductGroup | undefined;
  return row ?? null;
}

export function createProductGroup(input: { productKey: string; primaryAsin?: string | null }) {
  const db = getDb();
  const now = new Date().toISOString();
  const group: ProductGroup = {
    id: nanoid(),
    productKey: input.productKey,
    primaryAsin: input.primaryAsin ?? null,
    createdAt: now
  };
  db.prepare(
    `
      insert into product_groups (id, productKey, primaryAsin, createdAt)
      values (@id, @productKey, @primaryAsin, @createdAt)
    `
  ).run(group);
  return group;
}

export function setProductGroupPrimaryAsin(groupId: string, asin: string) {
  const db = getDb();
  db.prepare(
    `
      update product_groups
      set primaryAsin = @asin
      where id = @groupId and (primaryAsin is null or primaryAsin = '')
    `
  ).run({ groupId, asin });
}

export function addProductGroupMembers(groupId: string, asins: string[]) {
  const db = getDb();
  const now = new Date().toISOString();
  const insert = db.prepare(
    `
      insert or ignore into product_group_members (id, groupId, asin, createdAt)
      values (@id, @groupId, @asin, @createdAt)
    `
  );
  const txn = db.transaction((items: string[]) => {
    for (const asin of items) {
      if (!asin) continue;
      insert.run({ id: nanoid(), groupId, asin, createdAt: now });
    }
  });
  txn(asins);
}

export function getPlanItemByRowHash(rowHash: string): PlanItem | null {
  const db = getDb();
  const row = db.prepare(
    `
      select id, rowHash, groupId, amazonUrl, sku, partNumber, upc, planDate, isActive, isPrimary, createdAt
      from plan_items
      where rowHash = @rowHash
      limit 1
    `
  ).get({ rowHash }) as (Omit<PlanItem, "isPrimary" | "isActive"> & {
    isPrimary: number;
    isActive: number;
  }) | undefined;
  if (!row) {
    return null;
  }
  return {
    ...row,
    isActive: row.isActive === 1,
    isPrimary: row.isPrimary === 1
  };
}

export function getPlanItemById(id: string): PlanItem | null {
  const db = getDb();
  const row = db.prepare(
    `
      select id, rowHash, groupId, amazonUrl, sku, partNumber, upc, planDate, isActive, isPrimary, createdAt
      from plan_items
      where id = @id
      limit 1
    `
  ).get({ id }) as (Omit<PlanItem, "isPrimary" | "isActive"> & {
    isPrimary: number;
    isActive: number;
  }) | undefined;
  if (!row) {
    return null;
  }
  return {
    ...row,
    isActive: row.isActive === 1,
    isPrimary: row.isPrimary === 1
  };
}

export function createPlanItem(input: {
  rowHash: string;
  groupId: string;
  amazonUrl: string;
  sku?: string | null;
  partNumber?: string | null;
  upc?: string | null;
  planDate: string;
  isPrimary: boolean;
}) {
  const existing = getPlanItemByRowHash(input.rowHash);
  if (existing) {
    const db = getDb();
    db.prepare(
      `
        update plan_items
        set groupId = @groupId,
            amazonUrl = @amazonUrl,
            sku = @sku,
            partNumber = @partNumber,
            upc = @upc,
            planDate = @planDate,
            isActive = 1,
            isPrimary = @isPrimary
        where rowHash = @rowHash
      `
    ).run({
      rowHash: input.rowHash,
      groupId: input.groupId,
      amazonUrl: input.amazonUrl,
      sku: input.sku ?? null,
      partNumber: input.partNumber ?? null,
      upc: input.upc ?? null,
      planDate: input.planDate,
      isPrimary: input.isPrimary ? 1 : 0
    });
    return getPlanItemByRowHash(input.rowHash)!;
  }
  const db = getDb();
  const now = new Date().toISOString();
  const item: PlanItem = {
    id: nanoid(),
    rowHash: input.rowHash,
    groupId: input.groupId,
    amazonUrl: input.amazonUrl,
    sku: input.sku ?? null,
    partNumber: input.partNumber ?? null,
    upc: input.upc ?? null,
    planDate: input.planDate,
    isActive: true,
    isPrimary: input.isPrimary,
    createdAt: now
  };
  db.prepare(
    `
      insert into plan_items (id, rowHash, groupId, amazonUrl, sku, partNumber, upc, planDate, isActive, isPrimary, createdAt)
      values (@id, @rowHash, @groupId, @amazonUrl, @sku, @partNumber, @upc, @planDate, @isActive, @isPrimary, @createdAt)
    `
  ).run({
    ...item,
    isActive: item.isActive ? 1 : 0,
    isPrimary: item.isPrimary ? 1 : 0
  });
  return item;
}

export function deactivateAllPlanItems() {
  const db = getDb();
  db.prepare("update plan_items set isActive = 0").run();
}

export function listActivePlanItemsByDate(planDate: string): PlanItem[] {
  const db = getDb();
  type PlanItemRow = Omit<PlanItem, "isActive" | "isPrimary"> & {
    isActive: number;
    isPrimary: number;
  };
  const rows = db.prepare(
    `
      select id, rowHash, groupId, amazonUrl, sku, partNumber, upc, planDate, isActive, isPrimary, createdAt
      from plan_items
      where planDate = @planDate and isActive = 1
      order by createdAt asc
    `
  ).all({ planDate }) as PlanItemRow[];
  return rows.map((row) => ({
    ...row,
    isActive: row.isActive === 1,
    isPrimary: row.isPrimary === 1
  }));
}
