import "./assets/main.css";
import { IndividualFileHeaderEdit } from "./IndividualFileHeaderEdit";
import { BatchPanel } from "./BatchHeaderEdit";

function App(): JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 text-gray-100 p-8">
      <div className="flex flex-col lg:flex-row gap-8 items-center lg:items-start justify-center w-full">
        {/* Individual file header edit */}
        <div className="w-full max-w-xl rounded-2xl border border-gray-700 bg-gray-900 p-10 shadow-xl">
          <IndividualFileHeaderEdit />
        </div>

        {/* Batch folder panel */}
        <div className="w-full max-w-xl rounded-2xl border border-gray-700 bg-gray-900 p-10 shadow-xl">
          <BatchPanel />
        </div>
      </div>
    </div>
  );
}

export default App;
