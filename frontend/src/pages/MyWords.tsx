import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/useAuth';
import { useNavigate } from 'react-router-dom';

interface Word {
    id: string;
    word: string;
    definition: string;
    example: string | null;
    pronunciation: string | null;
    status: string;
    created_at: string;
    updated_at: string | null;
}

export default function MyWords() {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const [words, setWords] = useState<Word[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize] = useState(20);
    const [editingWord, setEditingWord] = useState<Word | null>(null);
    const [editForm, setEditForm] = useState({
        word: '',
        definition: '',
        example: '',
        pronunciation: ''
    });

    const fetchWords = useCallback(async () => {
        if (!user) return;
        
        setLoading(true);
        setError(null);
        
        try {
            const params = new URLSearchParams({
                user_id: user.id,
                page: currentPage.toString(),
                page_size: pageSize.toString(),
            });
            
            if (searchQuery) {
                params.append('search', searchQuery);
            }
            
            const response = await fetch(`http://localhost:8000/api/my-words?${params.toString()}`);
            
            if (!response.ok) {
                throw new Error(`Error: ${response.status}`);
            }
            
            const data = await response.json();
            setWords(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load words');
        } finally {
            setLoading(false);
        }
    }, [user, currentPage, searchQuery, pageSize]);

    useEffect(() => {
        if (user) {
            fetchWords();
        }
    }, [user, fetchWords]);

    const handleDelete = async (wordId: string) => {
        if (!user) return;
        
        if (!confirm('Are you sure you want to delete this word?')) {
            return;
        }
        
        try {
            const response = await fetch(`http://localhost:8000/api/words/${wordId}?user_id=${user.id}`, {
                method: 'DELETE',
            });
            
            if (!response.ok) {
                throw new Error('Failed to delete word');
            }
            
            // Refresh the list
            fetchWords();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete word');
        }
    };

    const handleEdit = (word: Word) => {
        setEditingWord(word);
        setEditForm({
            word: word.word,
            definition: word.definition,
            example: word.example || '',
            pronunciation: word.pronunciation || ''
        });
    };

    const handleSaveEdit = async () => {
        if (!user || !editingWord) return;
        
        try {
            const response = await fetch(`http://localhost:8000/api/words/${editingWord.id}?user_id=${user.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(editForm),
            });
            
            if (!response.ok) {
                throw new Error('Failed to update word');
            }
            
            setEditingWord(null);
            fetchWords();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update word');
        }
    };

    const handleCancelEdit = () => {
        setEditingWord(null);
        setEditForm({ word: '', definition: '', example: '', pronunciation: '' });
    };

    const handleLogout = async () => {
        await signOut();
        navigate('/login');
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'approved':
                return 'var(--color-success)';
            case 'rejected':
                return 'var(--color-critical)';
            default:
                return 'var(--color-warning)';
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    };

    return (
        <div className="min-h-screen p-6" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
            {/* Header */}
            <div className="max-w-6xl mx-auto mb-6">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-display" style={{ color: 'var(--color-text)' }}>
                        My Words
                    </h1>
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

                {/* Navigation */}
                <div className="mb-6">
                    <button
                        onClick={() => navigate('/')}
                        className="px-4 py-2 rounded transition-all mr-2"
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
                    </button>
                </div>

                {/* Search */}
                <div className="mb-6">
                    <input
                        type="text"
                        placeholder="Search words, definitions, or examples..."
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setCurrentPage(1); // Reset to first page on search
                        }}
                        className="w-full px-4 py-3 rounded transition-all"
                        style={{
                            backgroundColor: 'var(--color-bg-secondary)',
                            border: '1px solid var(--color-border)',
                            color: 'var(--color-text)',
                        }}
                    />
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
                            <p style={{ color: 'var(--color-text-subdued)' }}>Loading words...</p>
                        </div>
                    </div>
                ) : error ? (
                    <div className="p-6 rounded" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-critical)' }}>
                        <p style={{ color: 'var(--color-critical)' }}>Error: {error}</p>
                    </div>
                ) : words.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-lg mb-4" style={{ color: 'var(--color-text-subdued)' }}>
                            {searchQuery ? 'No words found matching your search.' : "You haven't submitted any words yet."}
                        </p>
                        {!searchQuery && (
                            <button
                                onClick={() => navigate('/')}
                                className="px-6 py-3 rounded transition-all"
                                style={{
                                    backgroundColor: 'var(--color-primary)',
                                    color: 'var(--color-text)',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.opacity = '0.9';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.opacity = '1';
                                }}
                            >
                                Get Started
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        {/* Words List */}
                        <div className="space-y-4 mb-6">
                            {words.map((word) => (
                                <div
                                    key={word.id}
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
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                <h3 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
                                                    {word.word}
                                                </h3>
                                                {word.pronunciation && (
                                                    <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                                                        /{word.pronunciation}/
                                                    </span>
                                                )}
                                                <span
                                                    className="px-2 py-1 text-xs rounded"
                                                    style={{
                                                        backgroundColor: getStatusColor(word.status),
                                                        color: 'var(--color-text)',
                                                    }}
                                                >
                                                    {word.status}
                                                </span>
                                            </div>
                                            <p className="mb-2" style={{ color: 'var(--color-text-subdued)' }}>
                                                {word.definition}
                                            </p>
                                            {word.example && (
                                                <p className="text-sm italic mb-2" style={{ color: 'var(--color-text-muted)' }}>
                                                    Example: "{word.example}"
                                                </p>
                                            )}
                                            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                                Submitted: {formatDate(word.created_at)}
                                                {word.updated_at && ` • Updated: ${formatDate(word.updated_at)}`}
                                            </p>
                                        </div>
                                        <div className="flex gap-2 ml-4">
                                            <button
                                                onClick={() => handleEdit(word)}
                                                className="px-4 py-2 rounded text-sm transition-all"
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
                                                onClick={() => handleDelete(word.id)}
                                                className="px-4 py-2 rounded text-sm transition-all"
                                                style={{
                                                    backgroundColor: 'var(--color-bg-tertiary)',
                                                    border: '1px solid var(--color-border)',
                                                    color: 'var(--color-critical)',
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.backgroundColor = 'var(--color-critical)';
                                                    e.currentTarget.style.color = 'var(--color-text)';
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

                        {/* Pagination */}
                        <div className="flex justify-center items-center gap-4">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                className="px-4 py-2 rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{
                                    backgroundColor: currentPage === 1 ? 'var(--color-bg-secondary)' : 'var(--color-bg-tertiary)',
                                    border: '1px solid var(--color-border)',
                                    color: 'var(--color-text)',
                                }}
                            >
                                Previous
                            </button>
                            <span style={{ color: 'var(--color-text-subdued)' }}>
                                Page {currentPage}
                            </span>
                            <button
                                onClick={() => setCurrentPage(prev => prev + 1)}
                                disabled={words.length < pageSize}
                                className="px-4 py-2 rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{
                                    backgroundColor: words.length < pageSize ? 'var(--color-bg-secondary)' : 'var(--color-bg-tertiary)',
                                    border: '1px solid var(--color-border)',
                                    color: 'var(--color-text)',
                                }}
                            >
                                Next
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* Edit Modal */}
            {editingWord && (
                <div
                    className="fixed inset-0 flex items-center justify-center p-4 z-50"
                    style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
                    onClick={handleCancelEdit}
                >
                    <div
                        className="max-w-2xl w-full p-6 rounded"
                        style={{
                            backgroundColor: 'var(--color-bg-secondary)',
                            border: '1px solid var(--color-border)',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--color-text)' }}>
                            Edit Word
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
                                    Word
                                </label>
                                <input
                                    type="text"
                                    value={editForm.word}
                                    onChange={(e) => setEditForm({ ...editForm, word: e.target.value })}
                                    className="w-full px-4 py-2 rounded"
                                    style={{
                                        backgroundColor: 'var(--color-bg-tertiary)',
                                        border: '1px solid var(--color-border)',
                                        color: 'var(--color-text)',
                                    }}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
                                    Definition
                                </label>
                                <textarea
                                    value={editForm.definition}
                                    onChange={(e) => setEditForm({ ...editForm, definition: e.target.value })}
                                    rows={3}
                                    className="w-full px-4 py-2 rounded"
                                    style={{
                                        backgroundColor: 'var(--color-bg-tertiary)',
                                        border: '1px solid var(--color-border)',
                                        color: 'var(--color-text)',
                                    }}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
                                    Example Usage
                                </label>
                                <textarea
                                    value={editForm.example}
                                    onChange={(e) => setEditForm({ ...editForm, example: e.target.value })}
                                    rows={2}
                                    className="w-full px-4 py-2 rounded"
                                    style={{
                                        backgroundColor: 'var(--color-bg-tertiary)',
                                        border: '1px solid var(--color-border)',
                                        color: 'var(--color-text)',
                                    }}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
                                    Pronunciation
                                </label>
                                <input
                                    type="text"
                                    value={editForm.pronunciation}
                                    onChange={(e) => setEditForm({ ...editForm, pronunciation: e.target.value })}
                                    placeholder="e.g., /wɜrd/"
                                    className="w-full px-4 py-2 rounded"
                                    style={{
                                        backgroundColor: 'var(--color-bg-tertiary)',
                                        border: '1px solid var(--color-border)',
                                        color: 'var(--color-text)',
                                    }}
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
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
                                    color: 'var(--color-text)',
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
