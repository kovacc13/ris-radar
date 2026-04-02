import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

// Alle gültigen Passwörter aus Env-Variablen sammeln
function getValidPasswords(): string[] {
  const passwords: string[] = [];
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith("APP_PASSWORD") && value) {
      passwords.push(value);
    }
  }
  return passwords;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { password?: string };
  const passwords = getValidPasswords();

  if (passwords.length === 0) {
    // Kein Passwort gesetzt → jeder kommt rein
    const response = NextResponse.json({ ok: true });
    (await cookies()).set("ris-auth", "open", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  }

  if (body.password && passwords.includes(body.password)) {
    const token = Buffer.from(`ok:${body.password}`).toString("base64");
    const response = NextResponse.json({ ok: true });
    (await cookies()).set("ris-auth", token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  }

  return NextResponse.json({ ok: false, error: "Falsches Passwort" }, { status: 401 });
}
