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
        <div className="flex items-center justify-between px-6 py-3">
          <div>
            <h1 className="text-lg font-bold tracking-tight">HD Firmware Header Editor</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Patch firmware .bin headers in seconds</p>
          </div>
          <ThemeToggle />
        </div>
        <div className="mx-6 border-b border-gray-200 dark:border-gray-800" />

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
