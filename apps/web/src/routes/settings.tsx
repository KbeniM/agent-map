import { PaintBoardIcon, Plug01Icon, ServerStack01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Panel } from "@/components/panel";
import { OptionMenu } from "@/components/pickers";
import { AdapterSettings } from "@/components/settings/adapter-settings";
import { BridgeSettings } from "@/components/settings/bridge-settings";
import { DisplaySettings } from "@/components/settings/display-settings";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMapStore } from "@/stores/map";
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
  const options = Object.fromEntries(bridges.map((option) => [option.id, option.name]));
  return (
    <>
      {bridges.length > 1 && (
        <OptionMenu
          label="Bridge"
          className="mt-2 w-full"
          align="start"
          value={bridge.id}
          options={options}
          icons={Object.fromEntries(bridges.map((option) => [option.id, ServerStack01Icon]))}
          onChange={setSelected}
        />
      )}
      <AdapterSettings key={bridge.id} bridge={bridge} />
    </>
  );
}

function Settings() {
  const { tab = "harnesses" } = Route.useSearch();
  const navigate = Route.useNavigate();
  const leftOpen = useMapStore((state) => state.leftOpen);
  if (!leftOpen) return null;
  return (
    <Panel side="left" label="Settings" wide>
      <Tabs
        value={tab}
        onValueChange={(next) => navigate({ search: { tab: next as typeof tab }, replace: true })}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="px-4 pt-3">
          <TabsList className="w-full">
            <TabsTrigger value="harnesses">
              <HugeiconsIcon icon={Plug01Icon} className="max-sm:hidden" />
              Harnesses
            </TabsTrigger>
            <TabsTrigger value="bridges">
              <HugeiconsIcon icon={ServerStack01Icon} className="max-sm:hidden" />
              Bridges
            </TabsTrigger>
            <TabsTrigger value="display">
              <HugeiconsIcon icon={PaintBoardIcon} className="max-sm:hidden" />
              Display
            </TabsTrigger>
          </TabsList>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          <div className="min-w-0 px-4 pb-4">
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
        </ScrollArea>
      </Tabs>
    </Panel>
  );
}
