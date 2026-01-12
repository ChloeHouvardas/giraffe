import { useParams, Link } from 'react-router-dom';
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

    // Loading state
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p>Loading flashcards...</p>
            </div>
        );
    }

    // Error state
    if (error || !deckData) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-2xl font-bold mb-4">
                        {error || 'Deck not found'}
                    </h2>
                    <Link to="/" className="px-6 py-3 bg-primary text-white rounded-md">
                        Create New Deck
                    </Link>
                </div>
            </div>
        );
    }

    const { flashcards, difficulty } = deckData;
    const currentCard = flashcards[currentIndex];

    // Your existing handlers
    const handleNext = () => {
        setFlipped(false);
        setCurrentIndex((prev) => (prev + 1) % flashcards.length);
    };

    const handlePrevious = () => {
        setFlipped(false);
        setCurrentIndex((prev) => (prev - 1 + flashcards.length) % flashcards.length);
    };

    const handleFlip = () => {
        setFlipped(!flipped);
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-6">
            <div className="max-w-2xl w-full">
                {/* Your existing flashcard UI */}
                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-bold mb-2">Your Flashcards</h1>
                    <p>{currentIndex + 1} / {flashcards.length} • {difficulty}</p>
                </div>

                {/* Flashcard */}
                <div onClick={handleFlip} className="bg-white border-2 rounded-lg shadow-lg p-12 mb-8 min-h-[300px] flex items-center justify-center cursor-pointer">
                    <div className="text-center">
                        <p className="text-sm mb-2">{flipped ? 'Back' : 'Front'}</p>
                        <p className="text-4xl font-bold">{flipped ? currentCard.back : currentCard.front}</p>
                        <p className="text-sm mt-4">Click to flip</p>
                    </div>
                </div>

                {/* Navigation */}
                <div className="flex justify-between mb-6">
                    <button onClick={handlePrevious} className="px-6 py-2 bg-gray-200 rounded-md">Previous</button>
                    <button onClick={handleNext} className="px-6 py-2 bg-primary text-white rounded-md">Next</button>
                </div>

                {/* Actions */}
                <div className="flex justify-center">
                    <Link to="/" className="px-6 py-2 border rounded-md">Generate New Cards</Link>
                </div>
            </div>
        </div>
    );
}