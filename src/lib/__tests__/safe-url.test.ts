import { describe, expect, test } from "bun:test";
import { safeHttpUrl } from "../safe-url";

describe("safeHttpUrl", () => {
  test("accepts and normalizes public HTTP links", () => {
    expect(safeHttpUrl(" https://www.mlb.com/news/story ")).toBe("https://www.mlb.com/news/story");
    expect(safeHttpUrl("http://example.com/article")).toBe("http://example.com/article");
  });

  test("rejects executable and local-only schemes", () => {
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpUrl("data:text/html,hello")).toBeNull();
    expect(safeHttpUrl("/relative/article")).toBeNull();
  });

  test("rejects credential-bearing and malformed links", () => {
    expect(safeHttpUrl("https://user:pass@example.com/article")).toBeNull();
    expect(safeHttpUrl("not a url")).toBeNull();
    expect(safeHttpUrl("   ")).toBeNull();
  });
});
