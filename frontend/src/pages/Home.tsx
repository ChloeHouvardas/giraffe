import FlashcardGenerator from "../components/FlashCardGenerator";
import { useAuth } from '../auth/useAuth';
import { useNavigate } from 'react-router-dom';


export default function Home() {
    const { signOut } = useAuth()
    const navigate = useNavigate()

    const handleLogout = async () => {
        await signOut()
        navigate('/login')
    }

    return (
        <div className = "min-h-screen flex items-center justify-center p-6">
            <button
                onClick={handleLogout}
                className="absolute top-6 right-6 px-6 py-3 rounded transition-all"
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

            <div className="text-center">
                <h1 className="text-display text-text mb-4">
                    Welcome to Giraffe!
                </h1>
                <p className="text-lg text-text-subdued">
                    Let's get learning
                </p>

                <FlashcardGenerator />
            </div>
        </div>
        
    )
}
