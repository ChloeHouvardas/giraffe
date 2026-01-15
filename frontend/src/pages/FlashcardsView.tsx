import { useParams, Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';

interface Flashcard {
    front: string;
    back: string;
}

interface DeckData {
    deck_id: string;
    title: string;
    flashcards: Flashcard[];
    count: number;
    difficulty: string;
}

export default function FlashcardsView() {
    const { deckId } = useParams<{ deckId: string }>();
    const navigate = useNavigate();
    
    const [deckData, setDeckData] = useState<DeckData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [flipped, setFlipped] = useState(false);

    // Fetch deck from database on mount
    useEffect(() => {
        const fetchDeck = async () => {
            if (!deckId) {
                setError('No deck ID provided');
                setLoading(false);
                return;
            }

            try {
                const response = await fetch(`http://localhost:8000/api/decks/${deckId}`);
                
                if (!response.ok) {
                    if (response.status === 404) {
                        throw new Error('Deck not found');
                    }
                    throw new Error(`Error: ${response.status}`);
                }

                const data = await response.json();
                setDeckData(data);
                
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load deck');
            } finally {
                setLoading(false);
            }
        };

        fetchDeck();
    }, [deckId]);

    // Handlers
    const handleNext = () => {
        if (!deckData) return;
        setFlipped(false);
        setCurrentIndex((prev) => (prev + 1) % deckData.flashcards.length);
    };

    const handlePrevious = () => {
        if (!deckData) return;
        setFlipped(false);
        setCurrentIndex((prev) => (prev - 1 + deckData.flashcards.length) % deckData.flashcards.length);
    };

    const handleFlip = () => {
        setFlipped(!flipped);
    };

    // Keyboard navigation
    useEffect(() => {
        if (loading || !deckData) return;

        const handleKeyPress = (e: KeyboardEvent) => {
            switch (e.key) {
                case 'ArrowLeft':
                    e.preventDefault();
                    setFlipped(false);
                    setCurrentIndex((prev) => (prev - 1 + deckData.flashcards.length) % deckData.flashcards.length);
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    setFlipped(false);
                    setCurrentIndex((prev) => (prev + 1) % deckData.flashcards.length);
                    break;
                case ' ':
                case 'Enter':
                    e.preventDefault();
                    setFlipped((prev) => !prev);
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [currentIndex, flipped, loading, deckData]);

    // Loading state
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
                <div className="text-center">
                    <div
                        className="inline-block w-12 h-12 border-4 rounded-full animate-spin mb-4"
                        style={{
                            borderColor: 'var(--color-primary)',
                            borderTopColor: 'transparent'
                        }}
                    />
                    <p style={{ color: 'var(--color-text-subdued)' }}>Loading flashcards...</p>
                </div>
            </div>
        );
    }

    // Error state
    if (error || !deckData) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
                <div className="text-center">
                    <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--color-text)' }}>
                        {error || 'Deck not found'}
                    </h2>
                    <Link 
                        to="/" 
                        className="px-6 py-3 rounded transition-all inline-block"
                        style={{
                            backgroundColor: 'var(--color-primary)',
                            color: '#ffffff',
                        }}
                    >
                        Back to Home
                    </Link>
                </div>
            </div>
        );
    }

    const { flashcards, difficulty } = deckData;
    const currentCard = flashcards[currentIndex];
    const progress = ((currentIndex + 1) / flashcards.length) * 100;

    return (
        <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
            {/* Top Navigation Bar */}
            <nav 
                className="sticky top-0 z-50 w-full px-4 py-4 border-b"
                style={{
                    backgroundColor: 'var(--color-bg-secondary)',
                    borderColor: 'var(--color-border)',
                }}
            >
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate(-1)}
                            className="px-4 py-2 rounded transition-all flex items-center gap-2 font-medium"
                            style={{
                                backgroundColor: 'var(--color-bg-tertiary)',
                                border: '1px solid var(--color-border)',
                                color: 'var(--color-text)',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--color-primary)';
                                e.currentTarget.style.borderColor = 'var(--color-primary)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)';
                                e.currentTarget.style.borderColor = 'var(--color-border)';
                            }}
                        >
                            <span>←</span>
                            <span>Back</span>
                        </button>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <Link
                            to="/"
                            className="px-4 py-2 rounded transition-all text-sm font-medium"
                            style={{
                                backgroundColor: 'var(--color-bg-tertiary)',
                                border: '1px solid var(--color-border)',
                                color: 'var(--color-text)',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--color-primary)';
                                e.currentTarget.style.borderColor = 'var(--color-primary)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)';
                                e.currentTarget.style.borderColor = 'var(--color-border)';
                            }}
                        >
                            Home
                        </Link>
                        <Link
                            to="/my-words"
                            className="px-4 py-2 rounded transition-all text-sm font-medium"
                            style={{
                                backgroundColor: 'var(--color-bg-tertiary)',
                                border: '1px solid var(--color-border)',
                                color: 'var(--color-text)',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--color-primary)';
                                e.currentTarget.style.borderColor = 'var(--color-primary)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)';
                                e.currentTarget.style.borderColor = 'var(--color-border)';
                            }}
                        >
                            My Words
                        </Link>
                        <Link
                            to="/my-decks"
                            className="px-4 py-2 rounded transition-all text-sm font-medium"
                            style={{
                                backgroundColor: 'var(--color-bg-tertiary)',
                                border: '1px solid var(--color-border)',
                                color: 'var(--color-text)',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--color-primary)';
                                e.currentTarget.style.borderColor = 'var(--color-primary)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)';
                                e.currentTarget.style.borderColor = 'var(--color-border)';
                            }}
                        >
                            My Decks
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <div className="flex items-center justify-center p-6 pt-12">
                <div className="max-w-3xl w-full">
                    {/* Progress Header */}
                    <div className="mb-8 text-center">
                        <h1 className="text-3xl font-bold mb-3" style={{ color: 'var(--color-text)' }}>
                            Your Flashcards
                        </h1>
                        <div className="mb-2">
                            <p className="text-lg font-medium mb-2" style={{ color: 'var(--color-text-subdued)' }}>
                                Card {currentIndex + 1} of {flashcards.length} • {difficulty}
                            </p>
                            {/* Progress Bar */}
                            <div 
                                className="w-full h-2 rounded-full overflow-hidden"
                                style={{ backgroundColor: 'var(--color-bg-tertiary)' }}
                            >
                                <div
                                    className="h-full transition-all duration-300 rounded-full"
                                    style={{
                                        width: `${progress}%`,
                                        backgroundColor: 'var(--color-primary)',
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Flashcard */}
                    <div 
                        className="relative mb-8"
                        style={{ perspective: '1000px' }}
                    >
                        <div
                            onClick={handleFlip}
                            className="relative w-full cursor-pointer transition-transform duration-300"
                            style={{
                                transformStyle: 'preserve-3d',
                                transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                                minHeight: '400px',
                            }}
                        >
                            {/* Card Front */}
                            <div
                                className="absolute inset-0 w-full rounded-xl p-12 flex items-center justify-center backface-hidden"
                                style={{
                                    backgroundColor: '#ffffff',
                                    border: '3px solid var(--color-primary)',
                                    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
                                    transform: 'rotateY(0deg)',
                                    WebkitBackfaceVisibility: 'hidden',
                                    backfaceVisibility: 'hidden',
                                }}
                            >
                                <div className="text-center">
                                    <p 
                                        className="text-sm mb-4 font-medium uppercase tracking-wide"
                                        style={{ color: 'var(--color-text-muted)' }}
                                    >
                                        Front
                                    </p>
                                    <p 
                                        className="text-5xl md:text-6xl font-bold mb-6"
                                        style={{ color: '#1a1614' }}
                                    >
                                        {currentCard.front}
                                    </p>
                                    <p 
                                        className="text-sm mt-6"
                                        style={{ color: '#8a8279' }}
                                    >
                                        Click or press Space to flip
                                    </p>
                                </div>
                            </div>

                            {/* Card Back */}
                            <div
                                className="absolute inset-0 w-full rounded-xl p-12 flex items-center justify-center backface-hidden"
                                style={{
                                    backgroundColor: '#ffffff',
                                    border: '3px solid var(--color-primary)',
                                    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
                                    transform: 'rotateY(180deg)',
                                    WebkitBackfaceVisibility: 'hidden',
                                    backfaceVisibility: 'hidden',
                                }}
                            >
                                <div className="text-center">
                                    <p 
                                        className="text-sm mb-4 font-medium uppercase tracking-wide"
                                        style={{ color: 'var(--color-text-muted)' }}
                                    >
                                        Back
                                    </p>
                                    <p 
                                        className="text-4xl md:text-5xl font-bold mb-6"
                                        style={{ color: '#1a1614' }}
                                    >
                                        {currentCard.back}
                                    </p>
                                    <p 
                                        className="text-sm mt-6"
                                        style={{ color: '#8a8279' }}
                                    >
                                        Click or press Space to flip
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Card Controls */}
                    <div className="flex justify-between items-center gap-4 mb-6">
                        <button
                            onClick={handlePrevious}
                            disabled={currentIndex === 0}
                            className="px-6 py-3 rounded-lg transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            style={{
                                backgroundColor: currentIndex === 0 
                                    ? 'var(--color-bg-secondary)' 
                                    : 'var(--color-bg-tertiary)',
                                border: '2px solid var(--color-border)',
                                color: 'var(--color-text)',
                            }}
                            onMouseEnter={(e) => {
                                if (currentIndex !== 0) {
                                    e.currentTarget.style.backgroundColor = 'var(--color-primary)';
                                    e.currentTarget.style.borderColor = 'var(--color-primary)';
                                    e.currentTarget.style.color = '#ffffff';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (currentIndex !== 0) {
                                    e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)';
                                    e.currentTarget.style.borderColor = 'var(--color-border)';
                                    e.currentTarget.style.color = 'var(--color-text)';
                                }
                            }}
                        >
                            <span>←</span>
                            <span>Previous</span>
                        </button>

                        <button
                            onClick={handleFlip}
                            className="px-8 py-3 rounded-lg transition-all font-medium"
                            style={{
                                backgroundColor: 'var(--color-primary)',
                                color: '#ffffff',
                                border: '2px solid var(--color-primary)',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.opacity = '0.9';
                                e.currentTarget.style.transform = 'scale(1.05)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.opacity = '1';
                                e.currentTarget.style.transform = 'scale(1)';
                            }}
                        >
                            {flipped ? 'Show Front' : 'Flip Card'}
                        </button>

                        <button
                            onClick={handleNext}
                            disabled={currentIndex === flashcards.length - 1}
                            className="px-6 py-3 rounded-lg transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            style={{
                                backgroundColor: currentIndex === flashcards.length - 1
                                    ? 'var(--color-bg-secondary)'
                                    : 'var(--color-bg-tertiary)',
                                border: '2px solid var(--color-border)',
                                color: 'var(--color-text)',
                            }}
                            onMouseEnter={(e) => {
                                if (currentIndex !== flashcards.length - 1) {
                                    e.currentTarget.style.backgroundColor = 'var(--color-primary)';
                                    e.currentTarget.style.borderColor = 'var(--color-primary)';
                                    e.currentTarget.style.color = '#ffffff';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (currentIndex !== flashcards.length - 1) {
                                    e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)';
                                    e.currentTarget.style.borderColor = 'var(--color-border)';
                                    e.currentTarget.style.color = 'var(--color-text)';
                                }
                            }}
                        >
                            <span>Next</span>
                            <span>→</span>
                        </button>
                    </div>

                    {/* Keyboard Hints */}
                    <div className="text-center">
                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                            Keyboard: ← → to navigate • Space/Enter to flip
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}