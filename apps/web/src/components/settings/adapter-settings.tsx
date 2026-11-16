import { zodResolver } from "@hookform/resolvers/zod";
import { FloppyDiskIcon, Settings02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { type AdapterInfo, type BridgeSettings, retentionSchema } from "@rancher/shared/config";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { SheepLoader } from "@/components/sheep-loader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockTitle,
} from "@/components/ui/code-block";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { client, unwrap } from "@/lib/api";
import { pushSnippet, SETUP, type Snippet } from "@/lib/setup";
import { ago, useNow } from "@/lib/time";
import type { Bridge } from "@/stores/preferences";
import { Field, Section } from "./field";

function useBridgeSettings(bridge: Bridge) {
  const queryClient = useQueryClient();
  const settings = useQuery({
    queryKey: ["settings", bridge.id, bridge.url],
    queryFn: () => unwrap(client(bridge).v1.settings.$get()),
  });
  const save = useMutation({
    mutationFn: (patch: Partial<BridgeSettings>) => unwrap(client(bridge).v1.settings.$patch({ json: patch })),
    onSuccess: (next) => {
      queryClient.setQueryData(["settings", bridge.id, bridge.url], next);
      void queryClient.invalidateQueries({ queryKey: ["adapters", bridge.id] });
    },
  });
  return { settings, save };
}

function CopyBlock({ snippet }: { snippet: Snippet }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="type-caption text-muted-foreground">{snippet.title}</span>
      {snippet.content && (
        <CodeBlock size="sm">
          <CodeBlockHeader>
            <CodeBlockTitle className="font-mono text-muted-foreground">{snippet.file ?? "Terminal"}</CodeBlockTitle>
            <CodeBlockActions>
              <CodeBlockCopyButton value={snippet.content} />
            </CodeBlockActions>
          </CodeBlockHeader>
          <CodeBlockContent className="max-h-56">{snippet.content}</CodeBlockContent>
        </CodeBlock>
      )}
    </div>
  );
}

function AdapterRow({
  adapter,
  bridge,
  onSave,
}: {
  adapter: AdapterInfo;
  bridge: Bridge;
  onSave: (patch: Partial<BridgeSettings>) => void;
}) {
  const [open, setOpen] = useState(false);
  const now = useNow(10_000);
  const save = (change: { enabled?: boolean; path?: string }) =>
    onSave({ adapters: { [adapter.id]: { enabled: adapter.enabled, path: adapter.path, ...change } } });
  const modes = [
    adapter.modes.includes("files") && "reads files",
    adapter.modes.includes("hooks") && "accepts hooks",
  ].filter(Boolean);
  const snippets = SETUP[adapter.id]?.({ url: bridge.url, secured: Boolean(bridge.token) }) ?? [];

  return (
    <li className="flex min-w-0 flex-col gap-2 py-2.5">
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="type-body font-medium">{adapter.name}</span>
          <span className="type-caption text-muted-foreground">
            {modes.join(" · ")} · {adapter.sessions} {adapter.sessions === 1 ? "session" : "sessions"}
            {adapter.lastEventAt && ` · last event ${ago(adapter.lastEventAt, now)} ago`}
          </span>
          {adapter.error && <span className="type-caption truncate text-destructive">{adapter.error}</span>}
        </div>
        <Button variant="ghost" size="sm" aria-expanded={open} onClick={() => setOpen(!open)}>
          <HugeiconsIcon icon={Settings02Icon} />
          Set up
        </Button>
        <Switch
          aria-label={`Enable ${adapter.name}`}
          checked={adapter.enabled}
          onCheckedChange={(enabled) => save({ enabled })}
        />
      </div>
      {open && (
        <div className="flex flex-col gap-3 pb-1">
          {adapter.modes.includes("files") && (
            <Input
              aria-label={`${adapter.name} folder`}
              defaultValue={adapter.path}
              placeholder={adapter.defaultPath}
              className="font-mono"
              spellCheck={false}
              onBlur={(event) => {
                const path = event.target.value.trim();
                if (path !== (adapter.path ?? "")) save({ path: path || undefined });
              }}
            />
          )}
          {snippets.map((snippet) => (
            <CopyBlock key={snippet.title} snippet={snippet} />
          ))}
        </div>
      )}
    </li>
  );
}

function RetentionForm({
  settings,
  onSave,
}: {
  settings: BridgeSettings;
  onSave: (patch: Partial<BridgeSettings>) => void;
}) {
  const form = useForm({ resolver: zodResolver(retentionSchema), defaultValues: settings });
  useEffect(() => form.reset(settings), [form, settings]);
  const fields = [
    ["retentionDays", "Keep events", "days"],
    ["sinceHours", "Replay transcripts from the last", "hours"],
  ] as const;
  return (
    <form onSubmit={form.handleSubmit((values) => onSave(values))}>
      {fields.map(([name, label, unit]) => (
        <Field key={name} label={label} hint={form.formState.errors[name]?.message}>
          <Input
            type="number"
            aria-label={label}
            className="w-20 text-right"
            {...form.register(name, { valueAsNumber: true })}
          />
          <span className="type-caption w-10 text-muted-foreground">{unit}</span>
        </Field>
      ))}
      {form.formState.isDirty && (
        <Button type="submit" size="sm" className="mt-1">
          <HugeiconsIcon icon={FloppyDiskIcon} />
          Save
        </Button>
      )}
    </form>
  );
}

export function AdapterSettings({ bridge }: { bridge: Bridge }) {
  const adapters = useQuery({
    queryKey: ["adapters", bridge.id, bridge.url],
    queryFn: () => unwrap(client(bridge).v1.adapters.$get()),
    refetchInterval: 5000,
  });
  const { settings, save } = useBridgeSettings(bridge);
  const failure = adapters.error ?? settings.error;

  if (failure) {
    const rejected = failure.message.includes("token");
    return (
      <Alert variant="destructive" className="my-3">
        <AlertDescription>
          {rejected
            ? `${bridge.name} rejected its token. Update the token in Bridges.`
            : `Unable to reach ${bridge.url}. Start the bridge with bun run dev, or check the URL in Bridges.`}
        </AlertDescription>
      </Alert>
    );
  }
  if (adapters.isPending) {
    return <SheepLoader label="Loading adapters…" className="py-4" />;
  }
  return (
    <>
      <Section title="Adapters">
        <ul className="divide-y">
          {adapters.data?.map((adapter) => (
            <AdapterRow key={adapter.id} adapter={adapter} bridge={bridge} onSave={(patch) => save.mutate(patch)} />
          ))}
        </ul>
        <div className="pt-3">
          <CopyBlock snippet={pushSnippet({ url: bridge.url, secured: Boolean(bridge.token) })} />
        </div>
      </Section>
      {settings.data && (
        <Section title="Storage">
          <RetentionForm settings={settings.data} onSave={(patch) => save.mutate(patch)} />
        </Section>
      )}
    </>
  );
}
