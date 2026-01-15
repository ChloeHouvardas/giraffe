import FlashcardGenerator from "../components/FlashCardGenerator";
import { useAuth } from '../auth/useAuth';
import { useNavigate, Link } from 'react-router-dom';


export default function Home() {
    const { signOut } = useAuth()
    const navigate = useNavigate()

    const handleLogout = async () => {
        await signOut()
        navigate('/login')
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-8">
            <div className="absolute top-6 right-6 flex gap-3">
                <Link
                    to="/my-words"
                    className="px-6 py-3 rounded transition-all"
                    style={{
                        backgroundColor: 'var(--color-bg-secondary)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text)',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)'
                        e.currentTarget.style.borderColor = 'var(--color-primary)'
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)'
                        e.currentTarget.style.borderColor = 'var(--color-border)'
                    }}
                >
                    My Words
                </Link>
                <Link
                    to="/my-decks"
                    className="px-6 py-3 rounded transition-all"
                    style={{
                        backgroundColor: 'var(--color-bg-secondary)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text)',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)'
                        e.currentTarget.style.borderColor = 'var(--color-primary)'
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)'
                        e.currentTarget.style.borderColor = 'var(--color-border)'
                    }}
                >
                    My Decks
                </Link>
            <button
                onClick={handleLogout}
                    className="px-6 py-3 rounded transition-all"
                style={{
                    backgroundColor: 'var(--color-bg-secondary)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text)',
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)'
                    e.currentTarget.style.borderColor = 'var(--color-primary)'
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)'
                    e.currentTarget.style.borderColor = 'var(--color-border)'
                }}
            >
                Sign Out
            </button>
            </div>

            <div className="text-center w-full max-w-4xl mx-auto px-4">
                <h1 className="text-display mb-4" style={{ color: 'var(--color-text)' }}>
                    Welcome to Giraffe!
                </h1>
                <p className="text-lg mb-12" style={{ color: 'var(--color-text-subdued)' }}>
                    Let's get learning
                </p>

                <FlashcardGenerator />
            </div>
        </div>
        
    )
}
