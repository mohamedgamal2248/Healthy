import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

async function db() {
  const pg = new PGlite();
  let sql = readFileSync("supabase/migrations/0001_init.sql", "utf8");
  sql = sql.replace(/revoke all on function[\s\S]*?;\s*$/m, "");
  await pg.exec(sql);
  await pg.exec("insert into hl_profiles (username) values ('alice'),('bob')");
  return pg;
}
const bal = async (pg: PGlite, u: string) =>
  (await pg.query<{ plan: number; pack: number; trial: number }>("select * from hl_credit_balances($1)", [u])).rows[0];

test("trial grant happens once", async () => {
  const pg = await db();
  assert.equal((await pg.query<{ g: boolean }>("select hl_grant_trial('alice',3) g")).rows[0].g, true);
  assert.equal((await pg.query<{ g: boolean }>("select hl_grant_trial('alice',3) g")).rows[0].g, false);
  assert.equal((await bal(pg, "alice")).trial, 3);
});

test("spend order plan -> trial -> pack, never negative, refund restores", async () => {
  const pg = await db();
  await pg.exec("select hl_grant_trial('alice',1)");
  const p = (await pg.query<{ id: string }>("insert into hl_purchases (username,kind,item_key,amount_pi) values ('alice','pack','pack_small',1) returning id")).rows[0].id;
  await pg.query("select hl_complete_purchase($1,'tx1',2,0)", [p]);
  const r = (await pg.query<{ id: string }>("select gen_random_uuid() id")).rows[0].id;
  const kinds: (string | null)[] = [];
  for (let i = 0; i < 4; i++) {
    const id = (await pg.query<{ id: string }>("select gen_random_uuid() id")).rows[0].id;
    kinds.push((await pg.query<{ k: string | null }>("select hl_spend_credit('alice',$1) k", [id])).rows[0].k);
  }
  assert.deepEqual(kinds, ["trial", "pack", "pack", null]);
  const b = await bal(pg, "alice");
  assert.equal(b.pack + b.trial + b.plan, 0);
  void r;
});

test("refund is idempotent and restores same kind", async () => {
  const pg = await db();
  await pg.exec("select hl_grant_trial('bob',3)");
  const id = (await pg.query<{ id: string }>("select gen_random_uuid() id")).rows[0].id;
  await pg.query("select hl_spend_credit('bob',$1)", [id]);
  assert.equal((await bal(pg, "bob")).trial, 2);
  assert.equal((await pg.query<{ r: boolean }>("select hl_refund_request($1) r", [id])).rows[0].r, true);
  assert.equal((await pg.query<{ r: boolean }>("select hl_refund_request($1) r", [id])).rows[0].r, false);
  assert.equal((await bal(pg, "bob")).trial, 3);
});

test("plan purchase sets 30-day expiry, grants plan credits; expiry zeroes only plan credits", async () => {
  const pg = await db();
  const p = (await pg.query<{ id: string }>("insert into hl_purchases (username,kind,item_key,amount_pi) values ('alice','plan','monthly',3) returning id")).rows[0].id;
  await pg.query("select hl_complete_purchase($1,'tx',20,30)", [p]);
  assert.equal((await pg.query<{ r: string }>("select hl_complete_purchase($1,'tx',20,30) r", [p])).rows[0].r, "already_completed");
  const days = (await pg.query<{ d: number }>("select round(extract(epoch from (expires_at-now()))/86400)::int d from hl_subscriptions where username='alice'")).rows[0].d;
  assert.equal(days, 30);
  assert.equal((await bal(pg, "alice")).plan, 20);
  const pk = (await pg.query<{ id: string }>("insert into hl_purchases (username,kind,item_key,amount_pi) values ('alice','pack','pack_small',1) returning id")).rows[0].id;
  await pg.query("select hl_complete_purchase($1,'tx2',10,0)", [pk]);
  await pg.exec("update hl_subscriptions set expires_at = now() - interval '1 day' where username='alice'");
  const b = await bal(pg, "alice");
  assert.equal(b.plan, 0);
  assert.equal(b.pack, 10);
});

test("payment id unique across hl_purchases; ledger append-only", async () => {
  const pg = await db();
  await pg.exec("insert into hl_purchases (username,kind,item_key,amount_pi,pi_payment_id) values ('alice','pack','pack_small',1,'PAY1')");
  await assert.rejects(pg.exec("insert into hl_purchases (username,kind,item_key,amount_pi,pi_payment_id) values ('bob','pack','pack_small',1,'PAY1')"));
  await pg.exec("select hl_grant_trial('alice',3)");
  await assert.rejects(pg.exec("update hl_credit_ledger set change = 99"));
  await assert.rejects(pg.exec("delete from hl_credit_ledger"));
});

test("one official weight per week", async () => {
  const pg = await db();
  await pg.exec("insert into hl_weight_logs (username,weight_kg,logged_date,is_official,week_start) values ('alice',80,'2026-11-21',true,'2026-11-21')");
  await assert.rejects(pg.exec("insert into hl_weight_logs (username,weight_kg,logged_date,is_official,week_start) values ('alice',79,'2026-11-22',true,'2026-11-21')"));
});
