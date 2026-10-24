import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { getPool, closePool } from "../src/db.js";

test("connects to Supabase and reads the orders table", async () => {
  try {
    const pool = getPool();

    const result = await pool.query(`
      SELECT
        current_database() AS database_name,
        to_regclass('public.orders') IS NOT NULL AS orders_table_exists
    `);

    assert.equal(result.rows[0].orders_table_exists, true);

    console.log("Supabase database connection successful.");
    console.log("Orders table exists:", result.rows[0].orders_table_exists);
  } finally {
    await closePool();
  }
});
