"use client";

import { ChevronDown, Search, X } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";

interface FilterPickerProps {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  allLabel: string;
}

export default function FilterPicker({
  label,
  value,
  options,
  onChange,
  allLabel,
}: FilterPickerProps) {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setFilter("");
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const uniqueOptions = useMemo(() => [...new Set(options)], [options]);
  const matches = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) return uniqueOptions;
    return uniqueOptions.filter((item) => item.toLowerCase().includes(query));
  }, [filter, uniqueOptions]);

  const selectedLabel = value === "all" ? label : value;

  function choose(next: string) {
    onChange(next);
    setOpen(false);
  }

  const sheet =
    open && mounted
      ? createPortal(
          <div
            className="filter-picker-overlay"
            onPointerDown={() => setOpen(false)}
          >
            <div
              className="apple-panel filter-picker-sheet"
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <div className="filter-picker-header">
                <p id={titleId} className="apple-title">
                  {label}
                </p>
                <button
                  type="button"
                  className="apple-icon-btn"
                  onClick={() => setOpen(false)}
                  aria-label={`Close ${label.toLowerCase()} picker`}
                >
                  <X className="sidebar-close-icon text-[#86868b]" strokeWidth={1.75} />
                </button>
              </div>

              <div className="filter-picker-controls">
                <div className="field-wrap">
                  <Search strokeWidth={1.75} />
                  <input
                    value={filter}
                    onChange={(event) => setFilter(event.target.value)}
                    placeholder={`Search ${label.toLowerCase()}`}
                    className="apple-field apple-field-search"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint="search"
                  />
                </div>
              </div>

              <div className="filter-picker-list" role="listbox" aria-label={label}>
                <button
                  type="button"
                  role="option"
                  aria-selected={value === "all"}
                  className={`filter-picker-option ${
                    value === "all" ? "filter-picker-option-active" : ""
                  }`}
                  onClick={() => choose("all")}
                >
                  {allLabel}
                </button>
                {matches.map((item) => (
                  <button
                    type="button"
                    role="option"
                    aria-selected={value === item}
                    key={item}
                    className={`filter-picker-option ${
                      value === item ? "filter-picker-option-active" : ""
                    }`}
                    onClick={() => choose(item)}
                  >
                    {item}
                  </button>
                ))}
                {uniqueOptions.length === 0 ? (
                  <p className="sidebar-empty">Loading {label.toLowerCase()}s…</p>
                ) : matches.length === 0 ? (
                  <p className="sidebar-empty">No matches</p>
                ) : null}
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        type="button"
        className="apple-field filter-picker-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen(true)}
      >
        <span
          className={`filter-picker-value ${
            value === "all" ? "filter-picker-placeholder" : ""
          }`}
        >
          {selectedLabel}
        </span>
        <ChevronDown className="filter-picker-chevron" strokeWidth={1.75} />
      </button>
      {sheet}
    </>
  );
}
