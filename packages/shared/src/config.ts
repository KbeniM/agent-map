import { z } from "zod";

export const adapterSettingsSchema = z.object({
  enabled: z.boolean(),
  path: z.string().trim().max(1000).optional(),
});

export const bridgeSettingsSchema = z.object({
  retentionDays: z.number().int().min(1).max(365),
  sinceHours: z.number().int().min(1).max(8760),
  adapters: z.record(z.string().max(60), adapterSettingsSchema),
});

export const bridgeSettingsPatchSchema = bridgeSettingsSchema
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, "Nothing to change");

export type AdapterSettings = z.infer<typeof adapterSettingsSchema>;
export type BridgeSettings = z.infer<typeof bridgeSettingsSchema>;

export type AdapterMode = "files" | "hooks";

export type AdapterInfo = {
  id: string;
  name: string;
  harness: string;
  modes: AdapterMode[];
  enabled: boolean;
  path?: string;
  defaultPath?: string;
  sessions: number;
  lastEventAt?: string;
  error?: string;
  hookPath?: string;
};

export const bridgeConnectionSchema = z.object({
  name: z.string().trim().min(1, "Name it").max(60),
  url: z.url({ protocol: /^https?$/, message: "Use an http(s) URL" }).transform((url) => url.replace(/\/+$/, "")),
  token: z.string().trim().max(500),
});

export const retentionSchema = bridgeSettingsSchema.pick({ retentionDays: true, sinceHours: true });

export type BridgeConnection = z.input<typeof bridgeConnectionSchema>;
