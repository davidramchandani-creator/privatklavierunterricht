import { testStand } from "./actions";
import TestmodusBoard from "./_components/TestmodusBoard";

export const dynamic = "force-dynamic";

export default async function TestmodusPage() {
  const stand = await testStand();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-800 text-[#1C244B]">Testmodus</h1>
        <p className="text-sm text-gray-500 mt-1">
          Den ganzen Ablauf durchspielen, ohne dass ein echter Schüler etwas
          davon merkt.
        </p>
      </div>

      <TestmodusBoard stand={stand} />
    </div>
  );
}
