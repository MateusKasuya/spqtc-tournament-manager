import { describe, it, expect } from "vitest";
import { formatCountdown } from "@/lib/format";

describe("formatCountdown", () => {
  it("abaixo de 1 hora é mm:ss, como o Relógio", () => {
    expect(formatCountdown(0)).toBe("00:00");
    expect(formatCountdown(59 * 60 + 5)).toBe("59:05");
  });

  it("a partir de 1 hora é h:mm:ss", () => {
    expect(formatCountdown(3600)).toBe("1:00:00");
    expect(formatCountdown(2 * 3600 + 15 * 60 + 9)).toBe("2:15:09");
  });
});
