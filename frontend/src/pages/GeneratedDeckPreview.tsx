import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';

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

interface Toast {
    id: number;
    message: string;
    type: 'success' | 'error';
}

export default function GeneratedDeckPreview() {
    const { deckId } = useParams<{ deckId: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    
    const [deckData, setDeckData] = useState<DeckData | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saveAllWords, setSaveAllWords] = useState(false);
    const [saveDeck, setSaveDeck] = useState(false);
    const [selectedWords, setSelectedWords] = useState<Set<number>>(new Set());
    const [toasts, setToasts] = useState<Toast[]>([]);

    useEffect(() => {
        if (deckId) {
            fetchDeck();
        }
    }, [deckId]);

    const fetchDeck = async () => {
        if (!deckId) return;
        
        setLoading(true);
        setError(null);
        
        try {
            const response = await fetch(`http://localhost:8000/api/decks/${deckId}`);
            
            if (!response.ok) {
                throw new Error('Failed to load deck');
            }
            
            const data = await response.json();
            setDeckData(data);
            
            // Initialize selected words to all words
            const allIndices = new Set<number>(data.flashcards.map((_flashcard: Flashcard, index: number) => index));
            setSelectedWords(allIndices);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load deck');
        } finally {
            setLoading(false);
        }
    };

    const addToast = (message: string, type: 'success' | 'error') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(toast => toast.id !== id));
        }, 3000);
    };

    const toggleWordSelection = (index: number) => {
        setSelectedWords(prev => {
            const newSet = new Set(prev);
            if (newSet.has(index)) {
                newSet.delete(index);
            } else {
                newSet.add(index);
            }
            return newSet;
        });
    };

    const handleSelectAll = () => {
        if (!deckData) return;
        if (selectedWords.size === deckData.flashcards.length) {
            setSelectedWords(new Set());
        } else {
            setSelectedWords(new Set(deckData.flashcards.map((_, index) => index)));
        }
    };

    const saveWords = async () => {
        if (!user || !deckData) return;
        
        const wordsToSave = deckData.flashcards
            .filter((_, index) => selectedWords.has(index))
            .map(card => ({
                word: card.front,
                definition: card.back,
                example: '',
                pronunciation: '',
                user_id: user.id
            }));

        if (wordsToSave.length === 0) {
            addToast('No words selected to save', 'error');
            return { success: false };
        }

        try {
            // Use batch endpoint for better performance
            const response = await fetch('http://localhost:8000/api/words/batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    words: wordsToSave,
                    user_id: user.id
                })
            });

            if (!response.ok) {
                throw new Error('Failed to save words');
            }

            const result = await response.json();
            
            if (result.saved > 0) {
                addToast(`Successfully saved ${result.saved} word${result.saved > 1 ? 's' : ''}`, 'success');
            }
            if (result.skipped > 0) {
                addToast(`${result.skipped} word${result.skipped > 1 ? 's' : ''} already exist${result.skipped > 1 ? '' : 's'}`, 'error');
            }
            if (result.errors && result.errors.length > 0) {
                addToast(`Some errors occurred: ${result.errors.length}`, 'error');
            }

            return { success: result.saved > 0 };
        } catch {
            addToast('Error saving words', 'error');
            return { success: false };
        }
    };

    const handleStartStudying = async () => {
        if (!deckData) return;
        
        setSaving(true);
        setError(null);

        try {
            // Save words if option is selected
            if (saveAllWords && selectedWords.size > 0) {
                await saveWords();
                // Continue even if some words failed to save
            }

            // Deck is already saved, so we just navigate
            // If saveDeck was needed, it's already done during generation
            
            // Small delay to show success message
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Navigate to flashcards
            navigate(`/flashcards/${deckId}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to proceed');
            setSaving(false);
        }
    };

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
                    <p style={{ color: 'var(--color-text-subdued)' }}>Loading generated deck...</p>
                </div>
            </div>
        );
    }

    if (error || !deckData) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
                <div className="text-center">
                    <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--color-text)' }}>
                        {error || 'Deck not found'}
                    </h2>
                    <button
                        onClick={() => navigate('/')}
                        className="px-6 py-3 rounded transition-all"
                        style={{
                            backgroundColor: 'var(--color-primary)',
                            color: 'var(--color-text)',
                        }}
                    >
                        Back to Home
                    </button>
                </div>
            </div>
        );
    }

    const { flashcards, difficulty, count } = deckData;

    return (
        <div className="min-h-screen p-6" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
            {/* Toast Notifications */}
            <div className="fixed top-6 right-6 z-50 space-y-2">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className="px-6 py-3 rounded shadow-lg transition-all"
                        style={{
                            backgroundColor: toast.type === 'success' ? 'var(--color-success)' : 'var(--color-critical)',
                            color: 'var(--color-text)',
                        }}
                    >
                        {toast.message}
                    </div>
                ))}
            </div>

            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-display mb-2" style={{ color: 'var(--color-text)' }}>
                        Generated Deck Preview
                    </h1>
                    <p className="text-lg" style={{ color: 'var(--color-text-subdued)' }}>
                        {count} word{count !== 1 ? 's' : ''} generated • {difficulty}
                    </p>
                </div>

                {/* Action Options */}
                <div className="mb-6 p-6 rounded" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-light)' }}>
                    <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
                        Save Options
                    </h2>
                    <div className="space-y-3">
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={saveAllWords}
                                onChange={(e) => setSaveAllWords(e.target.checked)}
                                className="w-5 h-5 rounded"
                                style={{
                                    accentColor: 'var(--color-primary)',
                                }}
                            />
                            <span style={{ color: 'var(--color-text)' }}>
                                Save all new words to My Words collection
                            </span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={saveDeck}
                                onChange={(e) => setSaveDeck(e.target.checked)}
                                disabled
                                className="w-5 h-5 rounded opacity-50"
                                style={{
                                    accentColor: 'var(--color-primary)',
                                }}
                            />
                            <span style={{ color: 'var(--color-text-muted)' }}>
                                Save deck (already saved)
                            </span>
                        </label>
                    </div>
                </div>

                {/* Word Selection */}
                {saveAllWords && (
                    <div className="mb-6 p-4 rounded" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-light)' }}>
                        <div className="flex justify-between items-center mb-3">
                            <span style={{ color: 'var(--color-text)' }}>
                                Select words to save ({selectedWords.size} of {flashcards.length} selected)
                            </span>
                            <button
                                onClick={handleSelectAll}
                                className="px-4 py-2 rounded text-sm transition-all"
                                style={{
                                    backgroundColor: 'var(--color-bg-tertiary)',
                                    border: '1px solid var(--color-border)',
                                    color: 'var(--color-text)',
                                }}
                            >
                                {selectedWords.size === flashcards.length ? 'Deselect All' : 'Select All'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Words List */}
                <div className="mb-6">
                    <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
                        Generated Words
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {flashcards.map((card, index) => (
                            <div
                                key={index}
                                className="p-4 rounded transition-all"
                                style={{
                                    backgroundColor: 'var(--color-bg-secondary)',
                                    border: '1px solid var(--color-border-light)',
                                    borderColor: selectedWords.has(index) && saveAllWords 
                                        ? 'var(--color-primary)' 
                                        : 'var(--color-border-light)',
                                }}
                                onMouseEnter={(e) => {
                                    if (saveAllWords) {
                                        e.currentTarget.style.borderColor = 'var(--color-primary)';
                                        e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (saveAllWords) {
                                        e.currentTarget.style.borderColor = selectedWords.has(index) 
                                            ? 'var(--color-primary)' 
                                            : 'var(--color-border-light)';
                                        e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)';
                                    }
                                }}
                            >
                                {saveAllWords && (
                                    <div className="mb-2">
                                        <label htmlFor={`word-checkbox-${index}`} className="sr-only">
                                            Select word {index + 1}
                                        </label>
                                        <input
                                            id={`word-checkbox-${index}`}
                                            type="checkbox"
                                            checked={selectedWords.has(index)}
                                            onChange={() => toggleWordSelection(index)}
                                            className="w-4 h-4 rounded checkbox-primary"
                                        />
                                    </div>
                                )}
                                <div className="flex items-start gap-3 mb-2">
                                    <h3 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>
                                        {card.front}
                                    </h3>
                                </div>
                                <p className="mb-2" style={{ color: 'var(--color-text-subdued)' }}>
                                    {card.back}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Navigation Buttons */}
                <div className="flex justify-between gap-4">
                    <button
                        onClick={() => navigate('/')}
                        disabled={saving}
                        className="px-6 py-3 rounded transition-all disabled:opacity-50"
                        style={{
                            backgroundColor: 'var(--color-bg-secondary)',
                            border: '1px solid var(--color-border)',
                            color: 'var(--color-text)',
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleStartStudying}
                        disabled={saving}
                        className="px-6 py-3 rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                            backgroundColor: 'var(--color-primary)',
                            color: 'var(--color-text)',
                        }}
                        onMouseEnter={(e) => {
                            if (!saving) {
                                e.currentTarget.style.opacity = '0.9';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (!saving) {
                                e.currentTarget.style.opacity = '1';
                            }
                        }}
                    >
                        {saving ? (
                            <span className="flex items-center gap-2">
                                <div
                                    className="w-4 h-4 border-2 rounded-full animate-spin"
                                    style={{
                                        borderColor: 'var(--color-text)',
                                        borderTopColor: 'transparent'
                                    }}
                                />
                                Saving...
                            </span>
                        ) : (
                            'Start Studying'
                        )}
                    </button>
                </div>

                {error && (
                    <div className="mt-4 p-4 rounded" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-critical)' }}>
                        <p style={{ color: 'var(--color-critical)' }}>Error: {error}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
