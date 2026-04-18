import { ThemeToggle } from "./ThemeToggle";
import markoImg from "../assets/marko.png";

export function AppHeader(): JSX.Element {
  return (
    <header>
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-3">
          <img
            src={markoImg}
            alt="Marko"
            className="h-14 w-14 rounded-xs object-cover"
          />
          <div>
            <h1 className="text-lg font-bold tracking-tight">
              HD Firmware Size Header Editor
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Patch firmware .bin size headers in seconds
            </p>
          </div>
        </div>
        <ThemeToggle />
      </div>
      <div className="mx-6 border-b border-gray-200 dark:border-gray-800" />
    </header>
  );
}
