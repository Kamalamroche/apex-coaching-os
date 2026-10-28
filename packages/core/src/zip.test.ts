import { describe, expect, it } from "vitest";
import { zipFiles } from "./zip";

describe("zipFiles", () => {
  it("writes a stored zip with the right signatures, sizes and CRCs", () => {
    const zip = zipFiles([{ name: "a.txt", content: "hello" }, { name: "b.csv", content: "x,y\r\n" }], new Date(2026, 9, 28, 18, 0, 0));
    const v = new DataView(zip.buffer);
    expect(v.getUint32(0, true)).toBe(0x04034b50);
    expect(v.getUint32(14, true)).toBe(0x3610a686); // crc32("hello")
    expect(v.getUint32(18, true)).toBe(5);
    expect(new TextDecoder().decode(zip.slice(30, 35))).toBe("a.txt");
    expect(new TextDecoder().decode(zip.slice(35, 40))).toBe("hello");
    const end = zip.length - 22;
    expect(v.getUint32(end, true)).toBe(0x06054b50);
    expect(v.getUint16(end + 10, true)).toBe(2);
    expect(v.getUint32(v.getUint32(end + 16, true), true)).toBe(0x02014b50);
  });
});
