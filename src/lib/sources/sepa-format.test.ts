import { describe, expect, it } from "vitest";
import { decodeEntries, encodeEntries, entryRange, ENTRY_BYTES } from "./sepa-format";

describe("price entries", () => {
  it("round-trip through their six-byte encoding", () => {
    const entries = [
      { branch: 0, cents: 1 },
      { branch: 2692, cents: 299_999 },
      { branch: 0xffff, cents: 0xffffffff },
    ];
    const bytes = encodeEntries(entries);
    expect(bytes.byteLength).toBe(3 * ENTRY_BYTES);
    expect(decodeEntries(bytes)).toEqual(entries);
  });

  it("decodes a slice that does not start at the buffer's first byte", () => {
    const bytes = encodeEntries([{ branch: 1, cents: 10 }, { branch: 2, cents: 20 }]);
    expect(decodeEntries(bytes.subarray(ENTRY_BYTES))).toEqual([{ branch: 2, cents: 20 }]);
  });

  it("rejects a byte count that is not whole entries", () => {
    expect(() => decodeEntries(new Uint8Array(7))).toThrow(/whole entries/);
  });

  it("gives the inclusive byte range of a product's entries", () => {
    expect(entryRange(0, 1)).toEqual({ start: 0, end: 5 });
    expect(entryRange(10, 3)).toEqual({ start: 60, end: 77 });
  });
});
