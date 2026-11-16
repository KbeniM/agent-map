import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { type ColourBy, type Theme, type ToolLabels, usePreferences, type View } from "@/stores/preferences";
import { Field, Section } from "./field";

function Choice<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: Record<T, string>;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as T)}>
      <SelectTrigger size="sm" aria-label={label} className="w-36">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(options).map(([key, text]) => (
          <SelectItem key={key} value={key}>
            {text as string}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function DisplaySettings() {
  const { theme, view, display, setTheme, setView, setDisplay } = usePreferences();
  return (
    <>
      <Section title="Appearance">
        <Field label="Theme">
          <Choice<Theme>
            label="Theme"
            value={theme}
            onChange={setTheme}
            options={{ system: "System", light: "Light", dark: "Dark" }}
          />
        </Field>
        <Field label="View">
          <Choice<View> label="View" value={view} onChange={setView} options={{ "3d": "3D", "2d": "2D" }} />
        </Field>
        <Field label="Colour by" hint="Sphere colour on the map">
          <Choice<ColourBy>
            label="Colour by"
            value={display.colourBy}
            onChange={(colourBy) => setDisplay({ colourBy })}
            options={{ session: "Session", provider: "Provider", harness: "Harness" }}
          />
        </Field>
      </Section>
      <Section title="Map">
        <Field label="Tool calls per agent" hint={`${display.toolsPerAgent} latest`}>
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
        <Field label="Tool labels">
          <Choice<ToolLabels>
            label="Tool labels"
            value={display.toolLabels}
            onChange={(toolLabels) => setDisplay({ toolLabels })}
            options={{ live: "While running", hover: "On hover" }}
          />
        </Field>
        <Field label="Particles" hint="Flow along running links">
          <Switch
            aria-label="Particles"
            checked={display.particles}
            onCheckedChange={(particles) => setDisplay({ particles })}
          />
        </Field>
        <Field label="Live window" hint={`Active for ${display.liveSeconds} s after the last event`}>
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
    </>
  );
}
