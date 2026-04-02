import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const correctPassword = process.env.APP_PASSWORD;

  // Kein Passwort gesetzt → jeder kommt rein
  if (!correctPassword) {
    return NextResponse.json({ ok: true });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get("ris-auth")?.value;

  if (!token) {
    return NextResponse.json({ ok: false });
  }

  const expected = Buffer.from(`ok:${correctPassword}`).toString("base64");
  return NextResponse.json({ ok: token === expected });
}
