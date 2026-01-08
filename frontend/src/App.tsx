import {BrowserRouter, Routes, Route} from 'react-router-dom'
import Home from './pages/Home'

function App() {
  return (
    <BrowserRouter>
      <div className = "min-h-screen">
        {/* <Header /> */}
        <main>
          <Routes>
            <Route path="/" element={<Home/>}/>
          </Routes>
        </main>
      </div>
    </BrowserRouter>

  )
}

export default App