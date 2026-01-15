import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';

interface Flashcard {
    front: string;
    back: string;
}

interface PreviewData {
    flashcards: Flashcard[];
    difficulty: string;
    sourceText: string;
    defaultTitle: string;
    tempDeckId: string;
}

export default function DeckPreview() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    
    const [previewData, setPreviewData] = useState<PreviewData | null>(null);
    const [deckTitle, setDeckTitle] = useState<string>('');
    const [selectedCards, setSelectedCards] = useState<Set<number>>(new Set());
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const stateData = location.state as PreviewData | null;
        if (!stateData) {
            // No preview data, redirect to home
            navigate('/');
            return;
        }
        setPreviewData(stateData);
        setDeckTitle(stateData.defaultTitle);
        // Initialize all cards as selected
        const allIndices = new Set<number>(stateData.flashcards.map((_, index) => index));
        setSelectedCards(allIndices);
    }, [location.state, navigate]);

    const handleToggleCard = (index: number) => {
        setSelectedCards(prev => {
            const newSet = new Set(prev);
            if (newSet.has(index)) {
                newSet.delete(index);
            } else {
                newSet.add(index);
            }
            return newSet;
        });
    };

    const handleToggleAll = () => {
        if (!previewData) return;
        if (selectedCards.size === previewData.flashcards.length) {
            // Deselect all
            setSelectedCards(new Set());
        } else {
            // Select all
            const allIndices = new Set<number>(previewData.flashcards.map((_, index) => index));
            setSelectedCards(allIndices);
        }
    };

    const handleSaveDeck = async () => {
        if (!user || !previewData) return;
        
        if (!deckTitle.trim()) {
            setError('Please enter a deck title');
            return;
        }

        if (selectedCards.size === 0) {
            setError('Please select at least one card to save.');
            return;
        }
        
        setSaving(true);
        setError(null);
        
        // Get only selected flashcards
        const selectedFlashcards = previewData.flashcards.filter((_, index) => selectedCards.has(index));
        
        try {
            const response = await fetch('http://localhost:8000/api/decks', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: deckTitle.trim(),
                    flashcards: selectedFlashcards,
                    difficulty: previewData.difficulty,
                    source_text: previewData.sourceText,
                    user_id: user.id
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || `Error: ${response.status}`);
            }

            console.log('Deck saved:', data.deck_id);
            
            // Navigate to flashcards view with the saved deck
            navigate(`/flashcards/${data.deck_id}`);
            
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save deck');
            console.error('Error:', err);
        } finally {
            setSaving(false);
        }
    };

    const handleDiscard = () => {
        if (confirm('Are you sure you want to discard this deck? All generated flashcards will be lost.')) {
            navigate('/');
        }
    };

    if (!previewData) {
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
                    <p style={{ color: 'var(--color-text-subdued)' }}>Loading preview...</p>
                </div>
            </div>
        );
    }

    const { difficulty } = previewData;

    return (
        <div className="min-h-screen p-6" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-display mb-4" style={{ color: 'var(--color-text)' }}>
                        Review Your Deck
                    </h1>
                    <p className="text-lg" style={{ color: 'var(--color-text-subdued)' }}>
                        {selectedCards.size} of {previewData.flashcards.length} word{previewData.flashcards.length !== 1 ? 's' : ''} selected • {difficulty}
                    </p>
                </div>

                {/* Deck Title Editor */}
                <div className="mb-6 p-6 rounded" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-light)' }}>
                    <label htmlFor="deck-title" className="block text-lg font-semibold mb-3" style={{ color: 'var(--color-text)' }}>
                        Deck Name
                    </label>
                    <input
                        id="deck-title"
                        type="text"
                        value={deckTitle}
                        onChange={(e) => setDeckTitle(e.target.value)}
                        placeholder="Enter deck name..."
                        className="w-full px-4 py-3 rounded transition-all"
                        style={{
                            backgroundColor: 'var(--color-bg-tertiary)',
                            border: '1px solid var(--color-border)',
                            color: 'var(--color-text)',
                        }}
                        onFocus={(e) => {
                            e.currentTarget.style.borderColor = 'var(--color-primary)';
                        }}
                        onBlur={(e) => {
                            e.currentTarget.style.borderColor = 'var(--color-border)';
                        }}
                    />
                </div>

                {/* Flashcard List */}
                <div className="mb-8 p-6 rounded" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-light)' }}>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold" style={{ color: 'var(--color-text)' }}>
                            Generated Words ({previewData.flashcards.length})
                        </h2>
                        <button
                            onClick={handleToggleAll}
                            className="px-4 py-2 rounded transition-all text-sm"
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
                            {selectedCards.size === previewData.flashcards.length ? 'Deselect All' : 'Select All'}
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {previewData.flashcards.map((card, index) => (
                            <div
                                key={index}
                                className="p-4 rounded transition-all"
                                style={{
                                    backgroundColor: selectedCards.has(index) ? 'var(--color-bg-tertiary)' : 'var(--color-bg-secondary)',
                                    border: selectedCards.has(index) ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                                    opacity: selectedCards.has(index) ? 1 : 0.6,
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--color-primary)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.borderColor = selectedCards.has(index) ? 'var(--color-primary)' : 'var(--color-border)';
                                }}
                            >
                                <div className="flex items-start gap-3 mb-2">
                                    <label 
                                        htmlFor={`card-checkbox-${index}`}
                                        className="sr-only"
                                    >
                                        Include {card.front} in deck
                                    </label>
                                    <input
                                        id={`card-checkbox-${index}`}
                                        type="checkbox"
                                        checked={selectedCards.has(index)}
                                        onChange={() => handleToggleCard(index)}
                                        className="w-5 h-5 rounded checkbox-primary mt-1"
                                    />
                                    <div className="flex-1">
                                        <div className="flex items-start gap-3 mb-2">
                                            <h3 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>
                                                {card.front}
                                            </h3>
                                            <span 
                                                className="px-2 py-1 text-xs rounded" 
                                                style={{ 
                                                    backgroundColor: 'var(--color-info)', 
                                                    color: '#ffffff' 
                                                }}
                                            >
                                                {difficulty}
                                            </span>
                                        </div>
                                        <p className="text-sm" style={{ color: 'var(--color-text-subdued)' }}>
                                            {card.back}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Error Message */}
                {error && (
                    <div 
                        className="mb-6 p-4 rounded-md"
                        style={{
                            backgroundColor: 'var(--color-critical)',
                            color: '#ffffff',
                            border: '1px solid var(--color-critical)',
                        }}
                    >
                        Error: {error}
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex justify-between gap-4">
                    <button
                        onClick={handleDiscard}
                        disabled={saving}
                        className="px-6 py-3 rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                            backgroundColor: 'var(--color-bg-secondary)',
                            border: '1px solid var(--color-border)',
                            color: 'var(--color-text)',
                        }}
                        onMouseEnter={(e) => {
                            if (!e.currentTarget.disabled) {
                                e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)';
                                e.currentTarget.style.borderColor = 'var(--color-primary)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (!e.currentTarget.disabled) {
                                e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)';
                                e.currentTarget.style.borderColor = 'var(--color-border)';
                            }
                        }}
                    >
                        Discard
                    </button>
                    <button
                        onClick={handleSaveDeck}
                        disabled={saving || !deckTitle.trim() || selectedCards.size === 0}
                        className="px-6 py-3 rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                        style={{
                            backgroundColor: saving || !deckTitle.trim() || selectedCards.size === 0 ? 'var(--color-bg-tertiary)' : 'var(--color-primary)',
                            color: '#ffffff',
                        }}
                        onMouseEnter={(e) => {
                            if (!e.currentTarget.disabled) {
                                e.currentTarget.style.opacity = '0.9';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (!e.currentTarget.disabled) {
                                e.currentTarget.style.opacity = '1';
                            }
                        }}
                    >
                        {saving ? 'Saving...' : 'Save Deck'}
                    </button>
                </div>
            </div>
        </div>
    );
}
