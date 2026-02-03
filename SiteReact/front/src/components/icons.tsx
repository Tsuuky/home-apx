import type { SVGProps } from "react";

const baseProps = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export function IconDashboard(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props} aria-hidden="true">
      <path d="M4 13h6V4H4v9Z" />
      <path d="M14 20h6V11h-6v9Z" />
      <path d="M4 20h6v-5H4v5Z" />
      <path d="M14 9h6V4h-6v5Z" />
    </svg>
  );
}

export function IconSeason(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props} aria-hidden="true">
      <path d="M12 3v2" />
      <path d="M12 19v2" />
      <path d="M4.9 4.9l1.4 1.4" />
      <path d="M17.7 17.7l1.4 1.4" />
      <path d="M3 12h2" />
      <path d="M19 12h2" />
      <path d="M4.9 19.1l1.4-1.4" />
      <path d="M17.7 6.3l1.4-1.4" />
      <circle cx="12" cy="12" r="4" />
    </svg>
  );
}

export function IconStock(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props} aria-hidden="true">
      <path d="M3 7l9-4 9 4" />
      <path d="M3 7v10l9 4 9-4V7" />
      <path d="M12 3v18" />
      <path d="M3 7l9 4 9-4" />
    </svg>
  );
}

export function IconWater(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...baseProps} {...props} aria-hidden="true">
      <path d="M12 3s5 5 5 9a5 5 0 1 1-10 0c0-4 5-9 5-9Z" />
      <path d="M9.5 14.5c.6 1 1.7 1.7 2.8 1.7" />
    </svg>
  );
}
