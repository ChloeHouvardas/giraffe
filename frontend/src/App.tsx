function App() {
  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-display">I'm just testing the styling real quick</h1>
        
        <div className="card">
          <h2 className="text-xl font-semibold mb-3">Card Component</h2>
          <p className="text-[var(--color-text-subdued)] mb-4">
            Hello world
          </p>
          <button className="btn-primary">
            Get Started
          </button>
        </div>

        <div className="card">
          <h3 className="font-semibold mb-2">Another Card</h3>
          <p className="text-sm text-[var(--color-text-muted)]">
            Hover over cards and buttons to see the interactions!
          </p>
        </div>
      </div>
    </div>
  )
}

export default App