import {BrowserRouter, Routes, Route} from 'react-router-dom'
import Home from './pages/Home'
import FlashcardsView from './pages/FlashcardsView'
import Login from './pages/Login'
import Register from './pages/Register'

function App() {
  return (
    <BrowserRouter>
      <div className = "min-h-screen">
        {/* <Header /> */}
        <main>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/" element={<Home />} />
            <Route path="/flashcards/:deckId" element={<FlashcardsView />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>

  )
}

export default App