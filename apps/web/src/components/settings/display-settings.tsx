import {
  AiChipIcon,
  ArrowUpRight01Icon,
  CircleIcon,
  ColorsIcon,
  CubeIcon,
  DashboardSpeed01Icon,
  FlowConnectionIcon,
  GridIcon,
  Layers01Icon,
  LeftToRightListBulletIcon,
  MaximizeScreenIcon,
  MinimizeScreenIcon,
  Move01Icon,
  PaintBucketIcon,
  Plug01Icon,
  RefreshIcon,
  Route01Icon,
  SparklesIcon,
  Tag01Icon,
  Target02Icon,
  TextIcon,
  Time04Icon,
  ViewOffSlashIcon,
  Wrench01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { OptionMenu } from "@/components/pickers";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { THEME_ICONS, TOOL_DISPLAY_ICONS, VIEW_ICONS } from "@/lib/icons";
import {
  type ColourBy,
  type GraphSpacing,
  type LabelVisibility,
  type Theme,
  type ToolDisplay,
  usePreferences,
  type View,
} from "@/stores/preferences";
import { Field, Section } from "./field";

export function DisplaySettings() {
  const { theme, view, display, setTheme, setView, setDisplay, resetDisplay } = usePreferences();
  const particleSpeed = display.particleSpeed ?? 0.004;
  const panSpeed = display.panSpeed ?? 1;

  return (
    <>
      <Section title="Appearance">
        <Field icon={PaintBucketIcon} label="Theme">
          <OptionMenu<Theme>
            label="Theme"
            className="w-36"
            value={theme}
            onChange={setTheme}
            options={{ system: "System", light: "Light", dark: "Dark" }}
            icons={THEME_ICONS}
          />
        </Field>
        <Field icon={CubeIcon} label="View">
          <OptionMenu<View>
            label="View"
            className="w-36"
            value={view}
            onChange={setView}
            options={{ "3d": "3D", "2d": "2D" }}
            icons={VIEW_ICONS}
          />
        </Field>
        <Field icon={ColorsIcon} label="Colour by" hint="Sphere colour on the map">
          <OptionMenu<ColourBy>
            label="Colour by"
            className="w-36"
            value={display.colourBy}
            onChange={(colourBy) => setDisplay({ colourBy })}
            options={{ session: "Session", provider: "Provider", harness: "Harness" }}
            icons={{ session: Layers01Icon, provider: AiChipIcon, harness: Plug01Icon }}
          />
        </Field>
        <Field icon={Tag01Icon} label="Node labels" hint="Titles shown below spheres">
          <OptionMenu<LabelVisibility>
            label="Node labels"
            className="w-36"
            value={display.labels ?? "all"}
            onChange={(labels) => setDisplay({ labels })}
            options={{ all: "All agents", focus: "Live & selected", off: "Hidden" }}
            icons={{ all: TextIcon, focus: Target02Icon, off: ViewOffSlashIcon }}
          />
        </Field>
        <Field icon={SparklesIcon} label="Live glow" hint="Pulse halos around active nodes">
          <Switch
            aria-label="Live glow"
            checked={display.halos ?? true}
            onCheckedChange={(halos) => setDisplay({ halos })}
          />
        </Field>
      </Section>

      <Section title="Links & Motion">
        <Field icon={FlowConnectionIcon} label="Connector particles" hint="Flow along running links">
          <Switch
            aria-label="Connector particles"
            checked={display.particles}
            onCheckedChange={(particles) => setDisplay({ particles })}
          />
        </Field>
        <Field
          icon={DashboardSpeed01Icon}
          label="Connector animation speed"
          hint={`${(particleSpeed / 0.004).toFixed(2)}× flow speed`}
        >
          <Slider
            aria-label="Connector animation speed"
            className="w-36"
            disabled={!display.particles}
            min={0.001}
            max={0.015}
            step={0.001}
            value={[particleSpeed]}
            onValueChange={([next]) => setDisplay({ particleSpeed: next })}
          />
        </Field>
        <Field icon={Route01Icon} label="Curved subagent links" hint="Bend spawn arcs between agents">
          <Switch
            aria-label="Curved subagent links"
            checked={display.curvedLinks ?? true}
            onCheckedChange={(curvedLinks) => setDisplay({ curvedLinks })}
          />
        </Field>
        <Field icon={ArrowUpRight01Icon} label="Direction arrows" hint="Show flow direction at node rims">
          <Switch
            aria-label="Direction arrows"
            checked={display.arrows ?? true}
            onCheckedChange={(arrows) => setDisplay({ arrows })}
          />
        </Field>
        <Field icon={Move01Icon} label="Pan speed" hint={`${panSpeed.toFixed(1)}× right-drag sensitivity`}>
          <Slider
            aria-label="Pan speed"
            className="w-36"
            min={0.4}
            max={3}
            step={0.1}
            value={[panSpeed]}
            onValueChange={([next]) => setDisplay({ panSpeed: next })}
          />
        </Field>
      </Section>

      <Section title="Layout & Activity">
        <Field icon={GridIcon} label="Graph spacing" hint="Distance between nodes">
          <OptionMenu<GraphSpacing>
            label="Graph spacing"
            className="w-36"
            value={display.spacing ?? "balanced"}
            onChange={(spacing) => setDisplay({ spacing })}
            options={{ compact: "Compact", balanced: "Balanced", spread: "Spread" }}
            icons={{ compact: MinimizeScreenIcon, balanced: CircleIcon, spread: MaximizeScreenIcon }}
          />
        </Field>
        <Field icon={Wrench01Icon} label="Tool calls per agent" hint={`${display.toolsPerAgent} latest on map`}>
          <Slider
            aria-label="Tool calls per agent"
            className="w-36"
            min={0}
            max={24}
            step={1}
            value={[display.toolsPerAgent]}
            onValueChange={([toolsPerAgent]) => setDisplay({ toolsPerAgent })}
          />
        </Field>
        <Field icon={LeftToRightListBulletIcon} label="Tool calls" hint="Detail level in agent activity">
          <OptionMenu<ToolDisplay>
            label="Tool calls"
            className="w-36"
            value={display.toolDisplay ?? "detailed"}
            onChange={(toolDisplay) => setDisplay({ toolDisplay })}
            options={{ detailed: "Detailed", simple: "Simple", off: "Off" }}
            icons={TOOL_DISPLAY_ICONS}
          />
        </Field>
        <Field icon={Time04Icon} label="Live window" hint={`Active for ${display.liveSeconds} s after the last event`}>
          <Slider
            aria-label="Live window"
            className="w-36"
            min={10}
            max={300}
            step={10}
            value={[display.liveSeconds]}
            onValueChange={([liveSeconds]) => setDisplay({ liveSeconds })}
          />
        </Field>
      </Section>

      <div className="pt-3">
        <Button variant="outline" size="sm" onClick={resetDisplay}>
          <HugeiconsIcon icon={RefreshIcon} />
          Reset display defaults
        </Button>
      </div>
    </>
  );
}
