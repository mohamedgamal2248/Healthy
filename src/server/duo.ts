import { randomBytes } from "node:crypto";
import { db, must } from "./supabase";
import { E } from "./http";
import type { Auth } from "./auth";
import { addDays } from "@/lib/dates";

export const DUO_DAYS = 7;
const INVITE_VALID_DAYS = 7;
const MAX_OPEN_PER_WEEK = 3;

type Duo = { id: string; code: string; inviter: string; invitee: string | null; start_date: string; created_at: string };

/** 10 characters from an unambiguous alphabet: unguessable enough for a 7-day invite, easy to read out. */
const newCode = () => Array.from(randomBytes(10), (b) => "23456789ABCDEFGHJKMNPQRSTUVWXYZ"[b % 31]).join("");

export async function createDuo(a: Auth): Promise<{ code: string }> {
  const since = new Date(Date.now() - 7 * 86400_000).toISOString();
  const open = (await db().from("hl_duos").select("id", { count: "exact", head: true }).eq("inviter", a.username).gte("created_at", since)).count ?? 0;
  if (open >= MAX_OPEN_PER_WEEK) throw E.bad("وصلت للحد الأسبوعي من دعوات التحدي.", "You reached this week's limit of challenge invites.");
  const code = newCode();
  must(await db().from("hl_duos").insert({ code, inviter: a.username, start_date: a.today }));
  return { code };
}

export async function joinDuo(a: Auth, rawCode: string): Promise<{ joined: boolean }> {
  const code = rawCode.trim().toUpperCase();
  if (!/^[A-Z0-9]{6,24}$/.test(code)) throw E.bad();
  const d = must(await db().from("hl_duos").select("*").eq("code", code).maybeSingle()) as Duo | null;
  if (!d || Date.now() - new Date(d.created_at).getTime() > INVITE_VALID_DAYS * 86400_000) throw E.notFound();
  if (d.inviter === a.username) throw E.bad("لا يمكنك قبول دعوتك أنت.", "You can't accept your own invite.");
  if (d.invitee === a.username) return { joined: true };
  if (d.invitee) throw E.bad("هذه الدعوة استُخدمت بالفعل.", "This invite was already used.");
  // The challenge starts when the friend accepts, so both begin on the same day.
  const upd = must(await db().from("hl_duos").update({ invitee: a.username, start_date: a.today }).eq("id", d.id).is("invitee", null).select("id")) as { id: string }[];
  if (!upd.length) throw E.bad("هذه الدعوة استُخدمت بالفعل.", "This invite was already used.");
  return { joined: true };
}

async function daysDone(username: string, from: string, to: string): Promise<number> {
  const rows = must(await db().from("hl_user_challenges").select("date").eq("username", username).eq("status", "completed").gte("date", from).lte("date", to)) as { date: string }[];
  return new Set(rows.map((r) => r.date)).size;
}

/** My duos from the last two weeks with both sides' day counts (names and counts only: no health data). */
export async function listDuos(a: Auth) {
  const since = new Date(Date.now() - 14 * 86400_000).toISOString();
  const rows = must(await db().from("hl_duos").select("*").or(`inviter.eq.${a.username},invitee.eq.${a.username}`).gte("created_at", since).order("created_at", { ascending: false }).limit(10)) as Duo[];
  const out = [];
  for (const d of rows) {
    const partner = d.inviter === a.username ? d.invitee : d.inviter;
    const end = addDays(d.start_date, DUO_DAYS - 1);
    const to = a.today < end ? a.today : end;
    const [mine, theirs] = await Promise.all([daysDone(a.username, d.start_date, to), partner ? daysDone(partner, d.start_date, to) : Promise.resolve(0)]);
    out.push({ id: d.id, code: partner ? undefined : d.code, partner, startDate: d.start_date, endDate: end, finished: a.today > end, mine, theirs, total: DUO_DAYS });
  }
  return out;
}
