"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import ApplePanel from "@/components/ApplePanel";
import { APP_NAME } from "@/lib/brand";
import {
  hasSeenWelcomeGuide,
  markWelcomeGuideSeen,
} from "@/lib/welcomeGuide";

const STEPS = [
  {
    title: "Explore the globe",
    body: "Drag or spin the 3D Earth to wander live radio stations around the world.",
  },
  {
    title: "Tune in",
    body: "Tap a station dot on the globe, or pick one from the station menu.",
  },
  {
    title: "Search and filter",
    body: "Use Search, Country, and Genre in the menu to narrow what you hear.",
  },
  {
    title: "Find nearby radio",
    body: "Tap the location button to tune the nearest station to you.",
  },
  {
    title: "Control playback",
    body: "Play, pause, shuffle, save favorites, and share from the player bar at the bottom.",
  },
] as const;

export default function WelcomeGuide() {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!hasSeenWelcomeGuide()) {
      setOpen(true);
    }
  }, []);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        markWelcomeGuideSeen();
        setOpen(false);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function close() {
    markWelcomeGuideSeen();
    setOpen(false);
  }

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="welcome-guide-overlay"
      onPointerDown={close}
      role="presentation"
    >
      <ApplePanel
        className="welcome-guide-panel"
        aria-label={`How to use ${APP_NAME}`}
        id="welcome-guide"
      >
        <div
          className="welcome-guide-sheet"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <header className="welcome-guide-header">
            <p id={titleId} className="welcome-guide-title">
              Welcome to {APP_NAME}
            </p>
            <p className="welcome-guide-lead">
              {APP_NAME} lets you discover and listen to live radio on an
              interactive 3D globe.
            </p>
          </header>

          <ol className="welcome-guide-steps">
            {STEPS.map((step, index) => (
              <li key={step.title} className="welcome-guide-step">
                <span className="welcome-guide-step-index" aria-hidden>
                  {index + 1}
                </span>
                <span className="welcome-guide-step-copy">
                  <span className="welcome-guide-step-title">{step.title}</span>
                  <span className="welcome-guide-step-body">{step.body}</span>
                </span>
              </li>
            ))}
          </ol>

          <footer className="welcome-guide-footer">
            <button
              type="button"
              className="apple-control welcome-guide-btn"
              onClick={close}
            >
              Start exploring
            </button>
          </footer>
        </div>
      </ApplePanel>
    </div>,
    document.body,
  );
}
