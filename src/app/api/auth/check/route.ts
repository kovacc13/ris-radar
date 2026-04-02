import { NextResponse } from "next/server";
import { cookies } from "next/headers";

function getValidPasswords(): string[] {
  const passwords: string[] = [];
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith("APP_PASSWORD") && value) {
      passwords.push(value);
    }
  }
  return passwords;
}

export async function GET() {
  const passwords = getValidPasswords();

  if (passwords.length === 0) {
    return NextResponse.json({ ok: true });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get("ris-auth")?.value;

  if (!token) {
    return NextResponse.json({ ok: false });
  }

  // Prüfe ob der Token zu irgendeinem gültigen Passwort passt
  const isValid = passwords.some(
    (pw) => token === Buffer.from(`ok:${pw}`).toString("base64")
  );

  return NextResponse.json({ ok: isValid });
}
