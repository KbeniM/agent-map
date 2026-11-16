import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { cn } from "cn";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type PickerItem = { value: string; label: string; icon?: ReactNode };

const OptionIcon = ({ icon }: { icon?: IconSvgElement }) =>
  icon ? <HugeiconsIcon icon={icon} strokeWidth={1.75} className="size-3.5 shrink-0 text-muted-foreground" /> : null;

export function OptionMenu<T extends string>({
  value,
  options,
  icons,
  onChange,
  label,
  variant = "outline",
  size = "sm",
  align = "end",
  className,
}: {
  value: T;
  options: Record<T, string>;
  icons?: Partial<Record<T, IconSvgElement>>;
  onChange: (value: T) => void;
  label: string;
  variant?: "outline" | "ghost";
  size?: "sm" | "xs";
  align?: "start" | "end";
  className?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          aria-label={label}
          className={cn("type-caption justify-between gap-2 font-normal normal-case tracking-normal", className)}
        >
          <span className="flex min-w-0 items-center gap-2">
            <OptionIcon icon={icons?.[value]} />
            <span className="truncate">{options[value]}</span>
          </span>
          <HugeiconsIcon icon={ArrowDown01Icon} strokeWidth={2} className="size-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-auto min-w-36">
        <DropdownMenuRadioGroup value={value} onValueChange={(next) => onChange(next as T)}>
          {Object.entries(options).map(([key, text]) => (
            <DropdownMenuRadioItem
              key={key}
              value={key}
              className="type-caption gap-2 font-normal normal-case tracking-normal"
            >
              <OptionIcon icon={icons?.[key as T]} />
              {text as string}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SearchCombobox({
  value,
  items,
  onChange,
  label,
  placeholder = "Search…",
  emptyText = "No matches",
  className,
}: {
  value: string;
  items: PickerItem[];
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  emptyText?: string;
  className?: string;
}) {
  const anchor = useComboboxAnchor();
  const selected = items.find((item) => item.value === value) ?? items[0] ?? null;

  return (
    <Combobox
      items={items}
      value={selected}
      onValueChange={(next) => {
        if (next) onChange(next.value);
      }}
    >
      <div ref={anchor} className={cn("min-w-0", className)}>
        <ComboboxTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              aria-label={label}
              className="type-caption h-8 w-full justify-between gap-2 px-2.5 font-normal normal-case tracking-normal"
            />
          }
        >
          <span className="flex min-w-0 items-center gap-2">
            {selected?.icon}
            <span className="truncate">
              <ComboboxValue />
            </span>
          </span>
        </ComboboxTrigger>
      </div>
      <ComboboxContent anchor={anchor} className="min-w-44">
        <ComboboxInput showTrigger={false} placeholder={placeholder} className="type-caption" />
        <ComboboxEmpty className="type-caption">{emptyText}</ComboboxEmpty>
        <ComboboxList>
          {(item: PickerItem) => (
            <ComboboxItem key={item.value} value={item} className="type-caption gap-2">
              {item.icon}
              {item.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
