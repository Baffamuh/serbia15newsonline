import { describe, it, expect } from "vitest";
import { slugify } from "@/lib/media";
describe("short news links", () => {
  it("keeps story links very short", () => {
    const s = slugify("Gwamnatin Tarayya ta sanar da sabon tsarin ilimi a jihohin arewa baki daya");
    expect(s.length).toBeLessThanOrEqual(29);
    expect(s).toMatch(/^gwamnatin-tarayya-ta-[a-z0-9]{4}$/);
  });
});
