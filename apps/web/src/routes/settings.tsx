import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Panel } from "@/components/panel";
import { AdapterSettings } from "@/components/settings/adapter-settings";
import { BridgeSettings } from "@/components/settings/bridge-settings";
import { DisplaySettings } from "@/components/settings/display-settings";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePreferences } from "@/stores/preferences";

const searchSchema = z.object({ tab: z.enum(["harnesses", "bridges", "display"]).optional() });

export const Route = createFileRoute("/settings")({
  validateSearch: (search) => searchSchema.parse(search),
  component: Settings,
});

function Harnesses() {
  const bridges = usePreferences((state) => state.bridges);
  const [selected, setSelected] = useState(bridges[0]?.id);
  const bridge = bridges.find((candidate) => candidate.id === selected) ?? bridges[0];
  if (!bridge) return null;
  return (
    <>
      {bridges.length > 1 && (
        <Select value={bridge.id} onValueChange={setSelected}>
          <SelectTrigger size="sm" aria-label="Bridge" className="mt-2 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {bridges.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <AdapterSettings key={bridge.id} bridge={bridge} />
    </>
  );
}

function Settings() {
  const { tab = "harnesses" } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <Panel side="left" label="Settings" wide>
      <Tabs
        value={tab}
        onValueChange={(next) => navigate({ search: { tab: next as typeof tab }, replace: true })}
        className="flex min-h-0 flex-1 flex-col"
      >
        <TabsList>
          <TabsTrigger value="harnesses">Harnesses</TabsTrigger>
          <TabsTrigger value="bridges">Bridges</TabsTrigger>
          <TabsTrigger value="display">Display</TabsTrigger>
        </TabsList>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
          <TabsContent value="harnesses">
            <Harnesses />
          </TabsContent>
          <TabsContent value="bridges">
            <BridgeSettings />
          </TabsContent>
          <TabsContent value="display">
            <DisplaySettings />
          </TabsContent>
        </div>
      </Tabs>
    </Panel>
  );
}
