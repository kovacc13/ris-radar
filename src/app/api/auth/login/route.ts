import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { password?: string };
  const correctPassword = process.env.APP_PASSWORD;

  if (!correctPassword) {
    // Kein Passwort gesetzt → jeder kommt rein
    const response = NextResponse.json({ ok: true });
    (await cookies()).set("ris-auth", "open", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 Tage
    });
    return response;
  }

  if (body.password === correctPassword) {
    // Einfacher Token aus Passwort-Hash
    const token = Buffer.from(`ok:${correctPassword}`).toString("base64");
    const response = NextResponse.json({ ok: true });
    (await cookies()).set("ris-auth", token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 Tage
    });
    return response;
  }

  return NextResponse.json({ ok: false, error: "Falsches Passwort" }, { status: 401 });
}
