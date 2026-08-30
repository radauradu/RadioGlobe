import { LoaderCircle } from "lucide-react";

interface LoadingChipProps {
  label: string;
}

export default function LoadingChip({ label }: LoadingChipProps) {
  return (
    <div className="loading-chip" role="status" aria-live="polite">
      <LoaderCircle className="loading-chip-spinner" strokeWidth={1.75} />
      <span className="loading-chip-label">{label}</span>
    </div>
  );
}
