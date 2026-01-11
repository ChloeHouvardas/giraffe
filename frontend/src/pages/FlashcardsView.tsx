import { useLocation, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';

interface Flashcard {
    front: string;
    back: string;
}

interface LocationState {
    flashcards: Flashcard[];
    sourceText?: string;
    difficulty?: string;
}

export default function FlashcardsView() {
    const location = useLocation();
    const state = location.state as LocationState;
    
    const [currentIndex, setCurrentIndex] = useState(0);
    const [flipped, setFlipped] = useState(false);

    // Debug: Log what we received
    useEffect(() => {
        console.log('Location state:', state);
        console.log('Flashcards:', state?.flashcards);
    }, [state]);

    // Handle case where user navigates directly (no state)
    if (!state || !state.flashcards || state.flashcards.length === 0) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-text mb-4">
                        No flashcards found
                    </h2>
                    <p className="text-text-subdued mb-6">
                        State: {JSON.stringify(state)}
                    </p>
                    <Link 
                        to="/"
                        className="px-6 py-3 bg-primary text-white rounded-md hover:opacity-90"
                    >
                        Go Back Home
                    </Link>
                </div>
            </div>
        );
    }

    const { flashcards, difficulty } = state;
    const currentCard = flashcards[currentIndex];

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
                {/* Header */}
                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-bold text-text mb-2">
                        Your Flashcards
                    </h1>
                    <p className="text-text-subdued">
                        {currentIndex + 1} / {flashcards.length} • {difficulty} difficulty
                    </p>
                </div>

                {/* Flashcard */}
                <div 
                    onClick={handleFlip}
                    className="bg--color-bg-secondary border-2 border-border-default rounded-lg shadow-lg p-12 mb-8 min-h-[300px] flex items-center justify-center cursor-pointer hover:shadow-xl transition-shadow"
                >
                    <div className="text-center">
                        <p className="text-sm text-text-subdued mb-2">
                            {flipped ? 'Back' : 'Front'}
                        </p>
                        <p className="text-4xl font-bold text-text">
                            {flipped ? currentCard.back : currentCard.front}
                        </p>
                        <p className="text-sm text-text-subdued mt-4">
                            Click to flip
                        </p>
                    </div>
                </div>

                {/* Navigation */}
                <div className="flex justify-between items-center mb-6">
                    <button
                        onClick={handlePrevious}
                        disabled={flashcards.length <= 1}
                        className="px-6 py-2 bg-primary text-text rounded-md hover:opacity-90 disabled:opacity-50"
                    >
                        Previous
                    </button>
                    <button
                        onClick={handleNext}
                        disabled={flashcards.length <= 1}
                        className="px-6 py-2 bg-primary text-white rounded-md hover:opacity-90 disabled:opacity-50"
                    >
                        Next
                    </button>
                </div>

                {/* Actions */}
                <div className="flex justify-center gap-4">
                    <Link 
                        to="/"
                        className="px-6 py-2 border border-border-default rounded-md hover:opacity-50"
                    >
                        Generate New Cards
                    </Link>
                </div>

                {/* All Cards List */}
                <div className="mt-12">
                    <h2 className="text-xl font-bold text-text mb-4">All Cards</h2>
                    <div className="space-y-2">
                        {flashcards.map((card, index) => (
                            <div 
                                key={index}
                                onClick={() => { setCurrentIndex(index); setFlipped(false); }}
                                className={`p-4 border rounded-md cursor-pointer hover:opacity-50 ${
                                    index === currentIndex ? 'border-primary bg--color-primary-light' : 'border-border-default'
                                }`}
                            >
                                <div className="flex justify-between">
                                    <span className="font-medium">{card.front}</span>
                                    <span className="text-text-subdued">{card.back}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}