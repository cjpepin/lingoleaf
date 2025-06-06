import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { useIsMobile } from "../use-mobile";

const MOBILE_BREAKPOINT = 768;
let listeners: Array<(e: MediaQueryListEvent) => void> = [];

function mockMatchMedia() {
  listeners = [];
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: window.innerWidth < MOBILE_BREAKPOINT,
      media: query,
      addEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => {
        listeners.push(cb);
      },
      removeEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => {
        listeners = listeners.filter((l) => l !== cb);
      },
    })),
  });
}

function dispatchChange(width: number) {
  window.innerWidth = width;
  listeners.forEach((cb) => cb({ matches: width < MOBILE_BREAKPOINT } as MediaQueryListEvent));
}

function TestComponent() {
  const value = useIsMobile();
  return <div data-testid="result">{value ? "mobile" : "desktop"}</div>;
}

describe("useIsMobile", () => {
  beforeEach(() => {
    mockMatchMedia();
  });

  it("returns correct value when viewport width changes", () => {
    window.innerWidth = 1024;
    render(<TestComponent />);
    expect(screen.getByTestId("result").textContent).toBe("desktop");

    dispatchChange(500);
    expect(screen.getByTestId("result").textContent).toBe("mobile");

    dispatchChange(900);
    expect(screen.getByTestId("result").textContent).toBe("desktop");
  });
});
