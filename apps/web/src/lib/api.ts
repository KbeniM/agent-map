import type { AppType } from "@api/app";
import { hc } from "hono/client";
import type { Bridge } from "@/stores/preferences";

export const authHeaders = (bridge: Bridge): Record<string, string> =>
  bridge.token ? { authorization: `Bearer ${bridge.token}` } : {};

export const client = (bridge: Bridge) => hc<AppType>(bridge.url, { headers: () => authHeaders(bridge) });

// why: the RPC response type is a union with the validator's error body; callers only ever see the success body
type Data<R> = R extends { json(): Promise<infer T> }
  ? T extends { success: false } | { error: string }
    ? never
    : T
  : never;

export async function unwrap<R extends { ok: boolean; status: number; json(): Promise<unknown> }>(
  response: Promise<R>,
) {
  const res = await response;
  if (res.status === 401) throw new Error("The bridge rejected the token");
  if (!res.ok) throw new Error(`The bridge answered ${res.status}`);
  return (await res.json()) as Data<R>;
}
