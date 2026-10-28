import { describe, expect, it } from "vitest";
import { detectDelimiter, parseCsv, toCsv } from "./csv";

describe("parseCsv", () => {
  it("reads quoted cells with commas, quotes and line breaks", () => {
    const rows = parseCsv('name,notes\r\n"Smith, Priya","Said ""hip is fine""\nfeels good"\r\n');
    expect(rows).toEqual([["name", "notes"], ["Smith, Priya", 'Said "hip is fine"\nfeels good']]);
  });

  it("reads a paste from Google Sheets as tab-separated and drops blank rows", () => {
    expect(detectDelimiter("Client\tExercise\nPriya\tPlank")).toBe("\t");
    expect(parseCsv("Client\tExercise\n\nPriya\tPlank\n\t\n")).toEqual([["Client", "Exercise"], ["Priya", "Plank"]]);
  });

  it("reads European Excel's semicolons and strips a byte order mark", () => {
    expect(parseCsv("﻿a;b\n1,5;2")).toEqual([["a", "b"], ["1,5", "2"]]);
  });
});

describe("toCsv", () => {
  it("round-trips through parseCsv", () => {
    const rows = [["Client", "Note"], ["Priya", 'Hip "tight", better'], ["Sam", "Line one\nline two"]];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });

  it("writes empty cells for null and undefined", () => {
    expect(toCsv([["a", null, undefined, 3]])).toBe("a,,,3\r\n");
  });
});

describe("formula safety", () => {
  it("stops a client's note running as a spreadsheet formula, and reads it back unchanged", () => {
    const csv = toCsv([["=HYPERLINK(\"x\")", -5, "-3 kg this week"]]);
    expect(csv.startsWith("\"'=HYPERLINK")).toBe(true);
    expect(parseCsv(csv)).toEqual([['=HYPERLINK("x")', "-5", "-3 kg this week"]]);
  });
});
