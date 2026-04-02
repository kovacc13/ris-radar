import RisSearch from "@/components/ris-search";
import PasswordGate from "@/components/password-gate";

export default function Home() {
  return (
    <PasswordGate>
      <RisSearch />
    </PasswordGate>
  );
}
