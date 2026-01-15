import {BrowserRouter, Routes, Route} from 'react-router-dom'
import { ProtectedRoute } from './auth/ProtectedRoute'
import Home from './pages/Home'
import FlashcardsView from './pages/FlashcardsView'
import GeneratedDeckPreview from './pages/GeneratedDeckPreview'
import MyWords from './pages/MyWords'
import MyDecks from './pages/MyDecks'
import ConversationPractice from './pages/ConversationPractice'
import ConversationSettings from './pages/ConversationSettings'
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
            <Route path="/practice/conversation/:deckId/settings" element={<ProtectedRoute><ConversationSettings /></ProtectedRoute>} />
            <Route path="/practice/conversation/:deckId" element={<ProtectedRoute><ConversationPractice /></ProtectedRoute>} />
            <Route path="/my-words" element={<ProtectedRoute><MyWords /></ProtectedRoute>} />
            <Route path="/my-decks" element={<ProtectedRoute><MyDecks /></ProtectedRoute>} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>

  )
}

export default App