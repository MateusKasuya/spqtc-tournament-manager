import { describe, it, expect } from "vitest";
import { displayName } from "@/lib/display-name";

describe("nome de exibição da mesa", () => {
  it("com apelido mostra o apelido", () => {
    expect(displayName({ name: "Mateus Kasuya", nickname: "Kasuya" })).toBe("Kasuya");
  });

  it("sem apelido mostra o nome", () => {
    expect(displayName({ name: "Mateus Kasuya", nickname: null })).toBe("Mateus Kasuya");
  });
});
