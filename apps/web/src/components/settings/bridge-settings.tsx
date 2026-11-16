import { zodResolver } from "@hookform/resolvers/zod";
import { type BridgeConnection, bridgeConnectionSchema } from "@rancher/shared/config";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { type Connection, useGraphs } from "@/stores/graph";
import { type Bridge, usePreferences } from "@/stores/preferences";
import { Section } from "./field";

const STATES: Record<Connection, string> = {
  open: "Connected",
  connecting: "Connecting…",
  closed: "Offline, retrying",
  unauthorized: "Token rejected",
};

function BridgeForm({ bridge, onDone }: { bridge?: Bridge; onDone: () => void }) {
  const saveBridge = usePreferences((state) => state.saveBridge);
  const form = useForm<BridgeConnection>({
    resolver: zodResolver(bridgeConnectionSchema),
    defaultValues: { name: bridge?.name ?? "", url: bridge?.url ?? "https://", token: bridge?.token ?? "" },
  });
  const submit = form.handleSubmit((values) => {
    const parsed = bridgeConnectionSchema.parse(values);
    saveBridge({ id: bridge?.id ?? crypto.randomUUID(), enabled: bridge?.enabled ?? true, ...parsed });
    onDone();
  });
  const error = (name: keyof BridgeConnection) => form.formState.errors[name]?.message;

  return (
    <Card size="sm" className="my-2">
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-3">
          {(["name", "url", "token"] as const).map((name) => (
            <Field key={name} data-invalid={Boolean(error(name))}>
              <FieldLabel htmlFor={`bridge-${name}`}>{name === "url" ? "URL" : name}</FieldLabel>
              <Input
                id={`bridge-${name}`}
                type={name === "token" ? "password" : "text"}
                autoComplete="off"
                spellCheck={false}
                aria-invalid={Boolean(error(name))}
                placeholder={name === "token" ? "Only for a bridge with RANCHER_TOKEN" : undefined}
                className={name === "name" ? undefined : "font-mono"}
                {...form.register(name)}
              />
              <FieldError errors={[form.formState.errors[name]]} />
            </Field>
          ))}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onDone}>
              Cancel
            </Button>
            <Button type="submit" size="sm">
              Save
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function BridgeRow({ bridge, removable }: { bridge: Bridge; removable: boolean }) {
  const [editing, setEditing] = useState(false);
  const { saveBridge, removeBridge } = usePreferences();
  const connection = useGraphs((state) => state.connections[bridge.id]);
  if (editing) return <BridgeForm bridge={bridge} onDone={() => setEditing(false)} />;
  const connecting = bridge.enabled && (connection ?? "connecting") === "connecting";
  return (
    <li className="flex items-center gap-3 py-2">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="type-body font-medium">{bridge.name}</span>
        <span className="type-caption truncate font-mono text-muted-foreground">{bridge.url}</span>
        <span
          className={
            connection === "unauthorized"
              ? "type-caption text-destructive"
              : connecting
                ? "shimmer type-caption text-muted-foreground"
                : "type-caption text-muted-foreground"
          }
        >
          {bridge.enabled ? STATES[connection ?? "connecting"] : "Off"}
        </span>
      </div>
      <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
        Edit
      </Button>
      {removable && (
        <Button variant="ghost" size="sm" onClick={() => removeBridge(bridge.id)}>
          Remove
        </Button>
      )}
      <Switch
        aria-label={`Connect to ${bridge.name}`}
        checked={bridge.enabled}
        onCheckedChange={(enabled) => saveBridge({ ...bridge, enabled })}
      />
    </li>
  );
}

export function BridgeSettings() {
  const bridges = usePreferences((state) => state.bridges);
  const [adding, setAdding] = useState(false);
  return (
    <Section title="Bridges">
      <p className="type-caption pb-1 text-muted-foreground">
        A bridge reads harnesses on its machine. Add a hosted bridge to see cloud sessions next to local ones.
      </p>
      <ul className="divide-y">
        {bridges.map((bridge) => (
          <BridgeRow key={bridge.id} bridge={bridge} removable={bridges.length > 1} />
        ))}
      </ul>
      {adding ? (
        <BridgeForm onDone={() => setAdding(false)} />
      ) : (
        <Button size="sm" className="mt-2 self-start" onClick={() => setAdding(true)}>
          Add bridge
        </Button>
      )}
    </Section>
  );
}
