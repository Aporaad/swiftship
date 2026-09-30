import { afterEach, describe, expect, it, vi } from "vitest";
import { createSmartOrderCodeGenerator } from "./generateSmartOrderCode";

const fixedDate = () => new Date(2026, 8, 30, 12, 0, 0);

afterEach(() => vi.restoreAllMocks());

function makeDependencies(
  overrides: Partial<Parameters<typeof createSmartOrderCodeGenerator>[0]> = {}
) {
  return {
    findOrdersByNumberPrefix: vi.fn().mockResolvedValue([]),
    settings: { orderPrefix: "ALX", orderStartNumber: 1001 },
    now: fixedDate,
    random: () => 0.5,
    ...overrides,
  };
}

describe("createSmartOrderCodeGenerator", () => {
  it("increments the largest existing suffix while respecting the configured start number", async () => {
    const findOrdersByNumberPrefix = vi
      .fn()
      .mockResolvedValue([
        { orderNumber: "ALX-2609-1008" },
        { orderNumber: "ALX-2609-1004" },
        { orderNumber: "ALX-2609-invalid" },
      ]);

    const generate = createSmartOrderCodeGenerator(
      makeDependencies({ findOrdersByNumberPrefix })
    );

    await expect(generate()).resolves.toBe("ALX-2609-1009");
    expect(findOrdersByNumberPrefix).toHaveBeenCalledWith("ALX-2609");
  });

  it("uses the configured start number when no matching order exists", async () => {
    const generate = createSmartOrderCodeGenerator(makeDependencies());

    await expect(generate()).resolves.toBe("ALX-2609-1001");
  });

  it("preserves the random placeholder fallback when lookup fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const generate = createSmartOrderCodeGenerator(
      makeDependencies({
        findOrdersByNumberPrefix: vi
          .fn()
          .mockRejectedValue(new Error("offline")),
      })
    );

    await expect(generate()).resolves.toBe("ALX-2609-5501");
  });
});
