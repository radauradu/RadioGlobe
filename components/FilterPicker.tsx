"use client";

import { ChevronDown, Search } from "lucide-react";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

interface FilterPickerProps {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  allLabel: string;
}

interface MenuPosition {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
}

const MENU_MIN_WIDTH = 168;
const MENU_MAX_WIDTH = 240;
const MENU_GAP = 4;
const VIEWPORT_MARGIN = 8;

function measureMenuPosition(trigger: HTMLElement): MenuPosition {
  const rect = trigger.getBoundingClientRect();
  const width = Math.min(
    MENU_MAX_WIDTH,
    Math.max(MENU_MIN_WIDTH, rect.width),
    window.innerWidth - VIEWPORT_MARGIN * 2,
  );

  let left = rect.left;
  if (left + width > window.innerWidth - VIEWPORT_MARGIN) {
    left = window.innerWidth - VIEWPORT_MARGIN - width;
  }
  if (left < VIEWPORT_MARGIN) {
    left = VIEWPORT_MARGIN;
  }

  const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_MARGIN;
  const spaceAbove = rect.top - VIEWPORT_MARGIN;
  const preferredMax = Math.min(220, window.innerHeight * 0.38);
  let top = rect.bottom + MENU_GAP;
  let maxHeight = Math.min(preferredMax, spaceBelow - MENU_GAP);

  if (maxHeight < 120 && spaceAbove > spaceBelow) {
    maxHeight = Math.min(preferredMax, spaceAbove - MENU_GAP);
    top = rect.top - MENU_GAP - maxHeight;
  }

  maxHeight = Math.max(96, maxHeight);

  return { top, left, width, maxHeight };
}

export default function FilterPicker({
  label,
  value,
  options,
  onChange,
  allLabel,
}: FilterPickerProps) {
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [filter, setFilter] = useState("");
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const uniqueOptions = useMemo(() => [...new Set(options)], [options]);
  const showSearch = uniqueOptions.length > 12;
  const matches = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) return uniqueOptions;
    return uniqueOptions.filter((item) => item.toLowerCase().includes(query));
  }, [filter, uniqueOptions]);

  const selectedLabel = value === "all" ? label : value;

  function close() {
    setOpen(false);
    setFilter("");
  }

  function choose(next: string) {
    onChange(next);
    close();
  }

  function openMenu() {
    const trigger = triggerRef.current;
    if (!trigger) return;
    setMenuPosition(measureMenuPosition(trigger));
    setOpen(true);
  }

  useLayoutEffect(() => {
    if (!open) return;

    const trigger = triggerRef.current;
    if (!trigger) return;

    function updatePosition() {
      if (!triggerRef.current) return;
      setMenuPosition(measureMenuPosition(triggerRef.current));
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }

    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (triggerRef.current?.contains(target)) return;
      if (
        target instanceof Element &&
        target.closest(".filter-picker-menu")
      ) {
        return;
      }
      close();
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  const menu =
    open && mounted && menuPosition
      ? createPortal(
          <div
            className="filter-picker-menu"
            role="dialog"
            aria-modal="false"
            aria-labelledby={titleId}
            style={{
              top: menuPosition.top,
              left: menuPosition.left,
              width: menuPosition.width,
              maxHeight: menuPosition.maxHeight,
            }}
          >
            <p id={titleId} className="filter-picker-menu-label">
              {label}
            </p>

            {showSearch ? (
              <div className="filter-picker-menu-search">
                <div className="field-wrap">
                  <Search strokeWidth={1.75} />
                  <input
                    value={filter}
                    onChange={(event) => setFilter(event.target.value)}
                    placeholder={`Search ${label.toLowerCase()}`}
                    className="apple-field apple-field-search filter-picker-search-field"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint="search"
                  />
                </div>
              </div>
            ) : null}

            <div
              className="filter-picker-list"
              role="listbox"
              aria-label={label}
            >
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
                <p className="filter-picker-empty">
                  Loading {label.toLowerCase()}s…
                </p>
              ) : matches.length === 0 ? (
                <p className="filter-picker-empty">No matches</p>
              ) : null}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="filter-picker">
      <button
        ref={triggerRef}
        type="button"
        className={`apple-field filter-picker-trigger ${
          open ? "filter-picker-trigger-open" : ""
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => (open ? close() : openMenu())}
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
      {menu}
    </div>
  );
}
