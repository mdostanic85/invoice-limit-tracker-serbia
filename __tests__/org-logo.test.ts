import { describe, expect, it } from "vitest";
import { validateLogoFile } from "@/lib/constants/org-logo";

describe("org-logo-service", () => {
  it("accepts PNG and JPEG files within size limit", () => {
    expect(
      validateLogoFile({ name: "logo.png", type: "image/png", size: 1024 })
    ).toBeNull();
    expect(
      validateLogoFile({ name: "logo.jpg", type: "image/jpeg", size: 1024 })
    ).toBeNull();
  });

  it("rejects unsupported formats", () => {
    expect(
      validateLogoFile({ name: "logo.svg", type: "image/svg+xml", size: 1024 })
    ).toMatch(/PNG and JPEG/i);
  });

  it("rejects files larger than 2 MB", () => {
    expect(
      validateLogoFile({ name: "logo.png", type: "image/png", size: 2 * 1024 * 1024 + 1 })
    ).toMatch(/2 MB/i);
  });
});
