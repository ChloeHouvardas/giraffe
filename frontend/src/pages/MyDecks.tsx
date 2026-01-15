import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/useAuth';
import { useNavigate, Link } from 'react-router-dom';

interface Deck {
    id: string;
    title: string;
    card_count: number;
    difficulty: string;
    created_at: string;
}

export default function MyDecks() {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const [decks, setDecks] = useState<Deck[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('created_at');
    const [editingDeck, setEditingDeck] = useState<Deck | null>(null);
    const [editTitle, setEditTitle] = useState('');

    const fetchDecks = useCallback(async () => {
        if (!user) return;
        
        setLoading(true);
        setError(null);
        
        try {
            const params = new URLSearchParams({
                user_id: user.id,
                sort_by: sortBy,
            });
            
            if (searchQuery) {
                params.append('search', searchQuery);
            }
            
            const response = await fetch(`http://localhost:8000/api/my-decks?${params.toString()}`);
            
            if (!response.ok) {
                throw new Error(`Error: ${response.status}`);
            }
            
            const data = await response.json();
            setDecks(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load decks');
        } finally {
            setLoading(false);
        }
    }, [user, sortBy, searchQuery]);

    useEffect(() => {
        if (user) {
            fetchDecks();
        }
    }, [user, fetchDecks]);

    const handleDelete = async (deckId: string, deckTitle: string) => {
        if (!user) return;
        
        if (!confirm(`Are you sure you want to delete "${deckTitle}"? This will also delete all flashcards in this deck.`)) {
            return;
        }
        
        try {
            const response = await fetch(`http://localhost:8000/api/decks/${deckId}?user_id=${user.id}`, {
                method: 'DELETE',
            });
            
            if (!response.ok) {
                throw new Error('Failed to delete deck');
            }
            
            // Refresh the list
            fetchDecks();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete deck');
        }
    };

    const handleEdit = (deck: Deck) => {
        setEditingDeck(deck);
        setEditTitle(deck.title);
    };

    const handleSaveEdit = async () => {
        if (!user || !editingDeck) return;
        
        try {
            const response = await fetch(`http://localhost:8000/api/decks/${editingDeck.id}?user_id=${user.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ title: editTitle }),
            });
            
            if (!response.ok) {
                throw new Error('Failed to update deck');
            }
            
            setEditingDeck(null);
            setEditTitle('');
            fetchDecks();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update deck');
        }
    };

    const handleCancelEdit = () => {
        setEditingDeck(null);
        setEditTitle('');
    };

    const handlePractice = (deckId: string) => {
        navigate(`/flashcards/${deckId}`);
    };

    const handleLogout = async () => {
        await signOut();
        navigate('/login');
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    };

    const getDifficultyColor = (difficulty: string) => {
        switch (difficulty) {
            case 'easy':
                return 'var(--color-success)';
            case 'hard':
                return 'var(--color-warning)';
            default:
                return 'var(--color-info)';
        }
    };

    return (
        <div className="min-h-screen p-6" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
            {/* Header */}
            <div className="max-w-6xl mx-auto mb-6">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-display" style={{ color: 'var(--color-text)' }}>
                        My Decks
                    </h1>
                    <div className="flex gap-3">
                        <Link
                            to="/"
                            className="px-6 py-3 rounded transition-all"
                            style={{
                                backgroundColor: 'var(--color-bg-secondary)',
                                border: '1px solid var(--color-border)',
                                color: 'var(--color-text)',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)';
                                e.currentTarget.style.borderColor = 'var(--color-primary)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)';
                                e.currentTarget.style.borderColor = 'var(--color-border)';
                            }}
                        >
                            + New Deck
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
                                e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)';
                                e.currentTarget.style.borderColor = 'var(--color-primary)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)';
                                e.currentTarget.style.borderColor = 'var(--color-border)';
                            }}
                        >
                            Sign Out
                        </button>
                    </div>
                </div>

                {/* Navigation */}
                <div className="mb-6">
                    <Link
                        to="/"
                        className="px-4 py-2 rounded transition-all mr-2 inline-block"
                        style={{
                            backgroundColor: 'var(--color-bg-secondary)',
                            border: '1px solid var(--color-border)',
                            color: 'var(--color-text)',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)';
                        }}
                    >
                        ← Back to Home
                    </Link>
                </div>

                {/* Search and Sort */}
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                    <input
                        type="text"
                        placeholder="Search decks..."
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                        }}
                        className="flex-1 px-4 py-3 rounded transition-all"
                        style={{
                            backgroundColor: 'var(--color-bg-secondary)',
                            border: '1px solid var(--color-border)',
                            color: 'var(--color-text)',
                        }}
                    />
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="px-4 py-3 rounded transition-all"
                        style={{
                            backgroundColor: 'var(--color-bg-secondary)',
                            border: '1px solid var(--color-border)',
                            color: 'var(--color-text)',
                        }}
                    >
                        <option value="created_at">Recent</option>
                        <option value="title">Name</option>
                        <option value="count">Card Count</option>
                    </select>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-6xl mx-auto">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="text-center">
                            <div
                                className="inline-block w-12 h-12 border-4 rounded-full animate-spin mb-4"
                                style={{
                                    borderColor: 'var(--color-primary)',
                                    borderTopColor: 'transparent'
                                }}
                            />
                            <p style={{ color: 'var(--color-text-subdued)' }}>Loading decks...</p>
                        </div>
                    </div>
                ) : error ? (
                    <div className="p-6 rounded" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-critical)' }}>
                        <p style={{ color: 'var(--color-critical)' }}>Error: {error}</p>
                    </div>
                ) : decks.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-lg mb-4" style={{ color: 'var(--color-text-subdued)' }}>
                            {searchQuery ? 'No decks found matching your search.' : "You haven't saved any decks yet."}
                        </p>
                        {!searchQuery && (
                            <Link
                                to="/"
                                className="px-6 py-3 rounded transition-all inline-block"
                                style={{
                                    backgroundColor: 'var(--color-primary)',
                                    color: '#ffffff',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.opacity = '0.9';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.opacity = '1';
                                }}
                            >
                                Generate Your First Deck
                            </Link>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {decks.map((deck) => (
                            <div
                                key={deck.id}
                                className="p-6 rounded transition-all"
                                style={{
                                    backgroundColor: 'var(--color-bg-secondary)',
                                    border: '1px solid var(--color-border-light)',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--color-border)';
                                    e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--color-border-light)';
                                    e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)';
                                }}
                            >
                                <div className="mb-4">
                                    <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>
                                        {deck.title}
                                    </h3>
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="text-sm" style={{ color: 'var(--color-text-subdued)' }}>
                                            {deck.card_count} card{deck.card_count !== 1 ? 's' : ''}
                                        </span>
                                        <span
                                            className="px-2 py-1 text-xs rounded"
                                            style={{
                                                backgroundColor: getDifficultyColor(deck.difficulty),
                                                color: '#ffffff',
                                            }}
                                        >
                                            {deck.difficulty}
                                        </span>
                                    </div>
                                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                        Created: {formatDate(deck.created_at)}
                                    </p>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <button
                                        onClick={() => handlePractice(deck.id)}
                                        className="w-full px-4 py-2 rounded transition-all font-medium"
                                        style={{
                                            backgroundColor: 'var(--color-primary)',
                                            color: '#ffffff',
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.opacity = '0.9';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.opacity = '1';
                                        }}
                                    >
                                        Practice
                                    </button>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleEdit(deck)}
                                            className="flex-1 px-4 py-2 rounded transition-all text-sm"
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
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleDelete(deck.id, deck.title)}
                                            className="flex-1 px-4 py-2 rounded transition-all text-sm"
                                            style={{
                                                backgroundColor: 'var(--color-bg-tertiary)',
                                                border: '1px solid var(--color-border)',
                                                color: 'var(--color-critical)',
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.backgroundColor = 'var(--color-critical)';
                                                e.currentTarget.style.color = '#ffffff';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)';
                                                e.currentTarget.style.color = 'var(--color-critical)';
                                            }}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Edit Modal */}
            {editingDeck && (
                <div
                    className="fixed inset-0 flex items-center justify-center p-4 z-50"
                    style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
                    onClick={handleCancelEdit}
                >
                    <div
                        className="max-w-md w-full p-6 rounded"
                        style={{
                            backgroundColor: 'var(--color-bg-secondary)',
                            border: '1px solid var(--color-border)',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--color-text)' }}>
                            Edit Deck
                        </h2>
                        <div className="mb-4">
                            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
                                Deck Name
                            </label>
                            <input
                                type="text"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                className="w-full px-4 py-2 rounded"
                                style={{
                                    backgroundColor: 'var(--color-bg-tertiary)',
                                    border: '1px solid var(--color-border)',
                                    color: 'var(--color-text)',
                                }}
                                autoFocus
                            />
                        </div>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={handleCancelEdit}
                                className="px-4 py-2 rounded transition-all"
                                style={{
                                    backgroundColor: 'var(--color-bg-tertiary)',
                                    border: '1px solid var(--color-border)',
                                    color: 'var(--color-text)',
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveEdit}
                                className="px-4 py-2 rounded transition-all"
                                style={{
                                    backgroundColor: 'var(--color-primary)',
                                    color: '#ffffff',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.opacity = '0.9';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.opacity = '1';
                                }}
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
