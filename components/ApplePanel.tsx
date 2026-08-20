import type { ReactNode } from "react";

interface ApplePanelProps {
  children: ReactNode;
  className?: string;
  id?: string;
  "aria-label"?: string;
}

export default function ApplePanel({
  children,
  className = "",
  id,
  "aria-label": ariaLabel,
}: ApplePanelProps) {
  return (
    <div
      id={id}
      className={`apple-panel ${className}`.trim()}
      aria-label={ariaLabel}
    >
      {children}
    </div>
  );
}
