import type { AppType } from "@api/app";
import { hc } from "hono/client";

export const bridge = (url: string) => hc<AppType>(url);

export async function unwrap<T>(response: Promise<{ ok: boolean; status: number; json: () => Promise<T> }>) {
  const res = await response;
  if (!res.ok) throw new Error(`Bridge responded ${res.status}`);
  return res.json();
}
