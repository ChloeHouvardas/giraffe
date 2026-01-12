import {BrowserRouter, Routes, Route} from 'react-router-dom'
import Home from './pages/Home'
import FlashcardsView from './pages/FlashcardsView'

function App() {
  return (
    <BrowserRouter>
      <div className = "min-h-screen">
        {/* <Header /> */}
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/flashcards/:deckId" element={<FlashcardsView />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>

  )
}

export default App