import './assets/main.css'

function App(): JSX.Element {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-950 text-gray-100">
      <div className="rounded-2xl border border-gray-700 bg-gray-900 p-10 shadow-xl">
        <h1 className="mb-2 text-2xl font-bold tracking-tight">Firmware Header Tool</h1>
        <p className="text-sm text-gray-400">
          Select a <code className="rounded bg-gray-800 px-1">.bin</code> file to write its
          length header.
        </p>
      </div>
    </div>
  )
}

export default App
