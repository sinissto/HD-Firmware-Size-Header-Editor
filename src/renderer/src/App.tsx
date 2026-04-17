import "./assets/main.css";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ThemeToggle } from "./components/ThemeToggle";
import { IndividualFileHeaderEdit } from "./IndividualFileHeaderEdit";
import { BatchPanel } from "./BatchHeaderEdit";

function App(): JSX.Element {
  return (
    <ThemeProvider>
      <div className="flex min-h-screen flex-col bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100">
        {/* Top bar */}
        <div className="flex justify-end px-6 py-3">
          <ThemeToggle />
        </div>

        {/* Main content */}
        <div className="flex flex-1 items-center justify-center p-8 pt-2">
          <div className="flex flex-col lg:flex-row gap-8 items-center lg:items-start justify-center w-full">
            {/* Individual file header edit */}
            <div className="w-full max-w-xl rounded-2xl border border-gray-200 bg-gray-50 p-10 shadow-xl dark:border-gray-700 dark:bg-gray-900">
              <IndividualFileHeaderEdit />
            </div>

            {/* Batch folder panel */}
            <div className="w-full max-w-xl rounded-2xl border border-gray-200 bg-gray-50 p-10 shadow-xl dark:border-gray-700 dark:bg-gray-900">
              <BatchPanel />
            </div>
          </div>
        </div>
      </div>
    </ThemeProvider>
  );
}

export default App;
