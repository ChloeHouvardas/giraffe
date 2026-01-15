import {BrowserRouter, Routes, Route} from 'react-router-dom'
import { ProtectedRoute } from './auth/ProtectedRoute'
import Home from './pages/Home'
import FlashcardsView from './pages/FlashcardsView'
import GeneratedDeckPreview from './pages/GeneratedDeckPreview'
import MyWords from './pages/MyWords'
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

            {/* Cannot access until logged in */}
            <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
            <Route path="/preview/:deckId" element={<ProtectedRoute><GeneratedDeckPreview /></ProtectedRoute>} />
            <Route path="/flashcards/:deckId" element={<ProtectedRoute><FlashcardsView /></ProtectedRoute>} />
            <Route path="/my-words" element={<ProtectedRoute><MyWords /></ProtectedRoute>} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>

  )
}

export default App