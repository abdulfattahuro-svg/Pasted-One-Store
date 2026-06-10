import { randomBytes } from "crypto";

export function generateRefCode(name: string): string {
  const prefix = name.replace(/\s+/g, "").slice(0, 3).toUpperCase();
  const random = randomBytes(3).toString("hex").toUpperCase();
  return `${prefix}-${random}`;
}
