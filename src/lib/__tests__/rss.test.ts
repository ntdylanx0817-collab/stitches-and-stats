import { test, expect, describe } from "bun:test";
import { rssText, rssHref } from "@/app/api/news/route";

/**
 * fast-xml-parser yields a bare string for a plain element and an object for
 * one carrying attributes, so both feed shapes have to round-trip. RSS 2.0 puts
 * the URL in the element text; Atom puts it on a `href` attribute.
 */
describe("rssText", () => {
  test("returns a bare string unchanged", () => {
    expect(rssText("Ohtani hits 50th")).toBe("Ohtani hits 50th");
  });

  test("reads #text from an attributed element", () => {
    expect(rssText({ "#text": "Judge walks off" })).toBe("Judge walks off");
  });

  test("returns empty for a missing field", () => {
    expect(rssText(undefined)).toBe("");
  });

  test("returns empty rather than stringifying an object with no #text", () => {
    // The previous inline form fell back to the object itself, which became
    // the literal "[object Object]" once passed through String().
    expect(rssText({ "@_href": "https://example.com" })).toBe("");
  });

  test("preserves an empty string", () => {
    expect(rssText("")).toBe("");
  });
});

describe("rssHref", () => {
  test("prefers the href attribute, as Atom uses", () => {
    expect(rssHref({ "@_href": "https://example.com/a" })).toBe("https://example.com/a");
  });

  test("falls back to element text, as RSS 2.0 uses", () => {
    expect(rssHref("https://example.com/b")).toBe("https://example.com/b");
  });

  test("falls back to #text when there is no href", () => {
    expect(rssHref({ "#text": "https://example.com/c" })).toBe("https://example.com/c");
  });

  test("prefers href over #text when both are present", () => {
    expect(rssHref({ "@_href": "https://href.example", "#text": "https://text.example" })).toBe(
      "https://href.example"
    );
  });

  test("returns empty for a missing link, so the item is dropped", () => {
    // The caller drops any item without a link, so "" is the signal for that.
    expect(rssHref(undefined)).toBe("");
    expect(rssHref({})).toBe("");
  });
});
