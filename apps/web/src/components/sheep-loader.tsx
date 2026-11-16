import { cn } from "cn";
import { useId } from "react";

const GRASS_TUFTS = [
  {
    angle: 14,
    path: "M115.2 66.8 C114.6 62.6 113.4 60.2 112.2 59.1 C114.2 59.6 115.8 61.5 116.8 64.5 C117.6 59.5 119.8 55.8 122 54.4 C121.6 57.5 120.4 61 119.9 64.4 C121.3 61.4 123 59.8 124.7 59.4 C123.7 61.5 122.9 63.6 122.4 66.8 Z",
  },
  {
    angle: 72,
    path: "M116.5 66.8 C115.8 63 114.5 60.8 113.5 59.8 C115.5 60.4 117 62.4 118 64.8 C119 61.6 120.6 59.8 122.2 59.2 C121.5 61.5 121 63.8 120.8 66.8 Z",
  },
  {
    angle: 136,
    path: "M114.8 66.8 C114.5 63.4 113.6 61.4 112.5 60.5 C114.4 60.8 115.9 62.4 116.8 64.8 C117.2 60.2 118.4 57 119.8 55.6 C120.2 58.3 119.7 61.3 119.6 64.5 C121.1 60.8 123.2 58.6 125.4 57.8 C124.4 60.5 123.3 63.2 122.6 66.8 Z",
  },
  {
    angle: 202,
    path: "M116.2 66.8 C116.6 63.5 117.8 61.4 119.2 60.3 C119.2 62.2 119 63.8 118.9 65 C120.4 61.8 122.2 59.6 124.2 58.8 C123.2 61.4 122.3 63.8 121.8 66.8 Z",
  },
  {
    angle: 260,
    path: "M115.8 66.8 C115 62.1 113.4 58.6 111.6 56.8 C114.2 57.8 116.3 60.4 117.6 64.2 C118.4 60.8 119.8 58.6 121.4 57.8 C121 60.4 120.7 63.2 120.6 66.8 Z",
  },
  {
    angle: 316,
    path: "M116.4 66.8 C116 63.8 115 61.8 113.8 60.8 C115.6 61.2 117 62.6 117.8 64.8 C118.5 61.6 119.8 59.4 121.2 58.5 C121.4 60.6 121 62.6 120.8 64.8 C122 62.6 123.3 61.5 124.6 61.2 C123.6 62.8 122.8 64.6 122.2 66.8 Z",
  },
] as const;

export function SheepLoader({ label, className }: { label?: string; className?: string }) {
  const id = useId();
  const sheepMaskId = `${id}-sheep`;
  const sheepSymbolId = `${id}-side-sheep`;

  return (
    <div
      role="status"
      aria-label={label ?? "Loading"}
      className={cn("flex flex-col items-center justify-center gap-2", className)}
    >
      <svg viewBox="20 8 200 134" className="sheep-loader-scene w-28 overflow-visible" aria-hidden="true">
        <defs>
          <mask id={sheepMaskId}>
            <rect x="0" y="0" width="38" height="28" fill="black" />
            <g fill="white">
              <rect x="11.5" y="18.2" width="2.4" height="6.8" rx="1.2" transform="rotate(8 12.7 19)" />
              <rect x="19.6" y="18.2" width="2.4" height="6.8" rx="1.2" transform="rotate(-10 20.8 19)" />
              <path d="M23.2 8.6 C27.2 7.6 31.8 8.9 33.4 11.4 C34.5 13.2 33.6 15.8 31.1 16.7 C28.2 17.6 25.1 17 23.4 15.3 Z" />
              <rect x="8.3" y="18.5" width="2.7" height="7.1" rx="1.35" transform="rotate(6 9.6 19)" />
              <rect x="17.1" y="18.5" width="2.7" height="7.1" rx="1.35" transform="rotate(-8 18.4 19)" />
              <path d="M6.4 16 C4.1 16 2.6 14.3 2.9 12.2 C3.2 10.5 4.6 9.5 6.1 9.6 C6.2 6.6 8.8 4.6 11.8 5.2 C13.4 3.2 16.5 3.1 18.3 4.9 C20.2 3.4 23.2 4 24.4 6.2 C26.5 6 28.4 7.5 28.2 9.6 C26.5 9.1 24.8 9.6 24.1 10.9 C24.8 12.7 24.4 14.9 22.9 16.2 C23.1 17.9 21.7 19.6 19.6 19.6 C18.5 19.6 17.7 19.1 17.1 18.4 C15.9 20.1 13.4 20.3 12 18.8 C10.7 20 8.6 19.7 7.6 18.3 C6.2 18.4 5.4 17.3 6.4 16 Z" />
            </g>
            <ellipse cx="22.8" cy="11.4" rx="2.9" ry="1.5" transform="rotate(-28 22.8 11.4)" fill="black" />
            <ellipse cx="22.8" cy="11.4" rx="2.1" ry="0.95" transform="rotate(-28 22.8 11.4)" fill="white" />
            <path
              d="M24.1 10.9 C24.8 12.7 24.4 14.9 22.9 16.2"
              fill="none"
              stroke="black"
              strokeWidth="1"
              strokeLinecap="round"
            />
            <circle cx="29.8" cy="11.8" r="1.15" fill="black" />
          </mask>

          <g id={sheepSymbolId}>
            <rect x="0" y="0" width="38" height="28" fill="var(--loader-white)" mask={`url(#${sheepMaskId})`} />
          </g>
        </defs>

        <g className="sheep-loader-wheel" fill="var(--loader-white)">
          <circle cx="120" cy="98" r="32.5" />
          {GRASS_TUFTS.map((tuft) => (
            <path key={tuft.angle} transform={`rotate(${tuft.angle} 120 98)`} d={tuft.path} />
          ))}
        </g>

        <g className="sheep-loader-mover sheep-loader-mover-1">
          <g className="sheep-loader-body">
            <use href={`#${sheepSymbolId}`} />
          </g>
        </g>
        <g className="sheep-loader-mover sheep-loader-mover-2">
          <g className="sheep-loader-body">
            <use href={`#${sheepSymbolId}`} />
          </g>
        </g>
        <g className="sheep-loader-mover sheep-loader-mover-3">
          <g className="sheep-loader-body">
            <use href={`#${sheepSymbolId}`} />
          </g>
        </g>
      </svg>
      {label && <span className="shimmer type-caption text-muted-foreground">{label}</span>}
    </div>
  );
}
