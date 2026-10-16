import { describe, expect, it } from "vitest";
import { imageName, slug } from "../../src/utils/names.js";

describe("slug", () => {
  it.each([
    ["My JS", "my-js"],
    ["billing_api.v2", "billing-api-v2"],
    ["--Ünï--", "uni"],
    ["!!!", "app"],
    ["", "app"],
  ])("%j gives %j", (name, expected) => {
    expect(slug(name)).toBe(expected);
  });
});

describe("imageName", () => {
  it("drops a scope", () => {
    expect(imageName("@acme/my-service")).toBe("my-service");
  });

  it("makes an invalid name valid", () => {
    expect(imageName("My Service")).toBe("my-service");
  });
});
