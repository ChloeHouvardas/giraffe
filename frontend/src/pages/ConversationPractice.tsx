import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';

interface Message {
    role: 'user' | 'assistant';
    content: string;
    wordsUsed?: string[];
    timestamp: Date;
}

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

export default function ConversationPractice() {
    const { deckId } = useParams<{ deckId: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [deckData, setDeckData] = useState<DeckData | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [allWordsUsed, setAllWordsUsed] = useState<Set<string>>(new Set());
    const [startTime] = useState<Date>(new Date());
    const [showSummary, setShowSummary] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Fetch deck data
    useEffect(() => {
        if (!deckId) return;

        const fetchDeck = async () => {
            try {
                const response = await fetch(`http://localhost:8000/api/decks/${deckId}`);
                if (!response.ok) throw new Error('Failed to load deck');
                const data = await response.json();
                setDeckData(data);
                setLoading(false);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load deck');
                setLoading(false);
            }
        };

        fetchDeck();
    }, [deckId]);

    // Start conversation with AI greeting
    useEffect(() => {
        if (!loading && deckData && messages.length === 0 && user) {
            const startConv = async () => {
                setSending(true);
                try {
                    // Add initial user message to start the conversation
                    const initialUserMessage = {
                        role: 'user',
                        content: "Hello! I'm ready to practice my vocabulary."
                    };

                    console.log("Starting conversation with initial message:", initialUserMessage);
                    
                    const response = await fetch('http://localhost:8000/api/practice/conversation', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            deck_id: deckId,
                            user_id: user.id,
                            messages: [initialUserMessage],
                            is_first_message: true
                        })
                    });

                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        throw new Error(errorData.detail || 'Failed to start conversation');
                    }

                    const data = await response.json();
                    console.log("AI response received:", { messageLength: data.message?.length, wordsUsed: data.words_used });
                    
                    const userMessage: Message = {
                        role: 'user',
                        content: initialUserMessage.content,
                        timestamp: new Date()
                    };
                    
                    const aiMessage: Message = {
                        role: 'assistant',
                        content: data.message,
                        wordsUsed: data.words_used || [],
                        timestamp: new Date()
                    };

                    setMessages([userMessage, aiMessage]);
                    updateWordsUsed(data.words_used || []);
                } catch (err) {
                    console.error("Error starting conversation:", err);
                    setError(err instanceof Error ? err.message : 'Failed to start conversation');
                } finally {
                    setSending(false);
                }
            };
            startConv();
        }
    }, [loading, deckData, user, deckId]);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Focus input on mount
    useEffect(() => {
        inputRef.current?.focus();
    }, []);


    const sendMessage = async () => {
        if (!inputValue.trim() || !user || !deckData || sending) return;

        const userMessage: Message = {
            role: 'user',
            content: inputValue.trim(),
            timestamp: new Date()
        };

        const newMessages = [...messages, userMessage];
        setMessages(newMessages);
        setInputValue('');
        setSending(true);
        setError(null);

        try {
            // Prepare messages for API (ensure we have at least one)
            const apiMessages = newMessages.map(m => ({
                role: m.role,
                content: m.content
            }));

            console.log("Sending message, total messages:", apiMessages.length);
            
            if (apiMessages.length === 0) {
                throw new Error('Cannot send empty message array');
            }

            const response = await fetch('http://localhost:8000/api/practice/conversation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    deck_id: deckId,
                    user_id: user.id,
                    messages: apiMessages,
                    is_first_message: false
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || 'Failed to send message');
            }

            const data = await response.json();
            console.log("AI response received:", { messageLength: data.message?.length, wordsUsed: data.words_used });
            
            const aiMessage: Message = {
                role: 'assistant',
                content: data.message,
                wordsUsed: data.words_used || [],
                timestamp: new Date()
            };

            setMessages([...newMessages, aiMessage]);
            updateWordsUsed(data.words_used || []);
        } catch (err) {
            console.error("Error sending message:", err);
            setError(err instanceof Error ? err.message : 'Failed to send message');
        } finally {
            setSending(false);
            inputRef.current?.focus();
        }
    };

    const updateWordsUsed = (words: string[]) => {
        setAllWordsUsed(prev => {
            const newSet = new Set(prev);
            words.forEach(word => newSet.add(word));
            return newSet;
        });
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const handleEndPractice = () => {
        setShowSummary(true);
    };

    const highlightWords = (text: string, words: string[] = []): React.ReactNode[] => {
        if (!deckData || words.length === 0) return [text];

        const parts: React.ReactNode[] = [];
        let lastIndex = 0;
        const textLower = text.toLowerCase();
        const wordsLower = words.map(w => w.toLowerCase());

        // Find all word positions
        const matches: Array<{ word: string; start: number; end: number }> = [];
        wordsLower.forEach((wordLower, idx) => {
            let searchIndex = 0;
            while (true) {
                const index = textLower.indexOf(wordLower, searchIndex);
                if (index === -1) break;
                matches.push({
                    word: words[idx],
                    start: index,
                    end: index + wordLower.length
                });
                searchIndex = index + 1;
            }
        });

        // Sort matches by position
        matches.sort((a, b) => a.start - b.start);

        // Build highlighted text
        matches.forEach((match, idx) => {
            // Add text before match
            if (match.start > lastIndex) {
                parts.push(text.substring(lastIndex, match.start));
            }

            // Add highlighted word
            const wordDef = deckData.flashcards.find(f => f.front.toLowerCase() === match.word.toLowerCase());
            parts.push(
                <span
                    key={`word-${idx}`}
                    className="highlighted-word"
                    style={{
                        backgroundColor: 'rgba(139, 64, 73, 0.2)',
                        padding: '2px 4px',
                        borderRadius: '4px',
                        cursor: 'help',
                        borderBottom: '1px dotted var(--color-primary)',
                    }}
                    title={wordDef ? wordDef.back : match.word}
                >
                    {text.substring(match.start, match.end)}
                </span>
            );

            lastIndex = match.end;
        });

        // Add remaining text
        if (lastIndex < text.length) {
            parts.push(text.substring(lastIndex));
        }

        return parts.length > 0 ? parts : [text];
    };

    const getElapsedTime = () => {
        const elapsed = Math.floor((new Date().getTime() - startTime.getTime()) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const getWordsNotUsed = () => {
        if (!deckData) return [];
        return deckData.flashcards
            .filter(f => !allWordsUsed.has(f.front))
            .map(f => f.front);
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
                    <p style={{ color: 'var(--color-text-subdued)' }}>Loading conversation...</p>
                </div>
            </div>
        );
    }

    if (error && !deckData) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
                <div className="text-center">
                    <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--color-text)' }}>
                        {error}
                    </h2>
                    <Link
                        to="/my-decks"
                        className="px-6 py-3 rounded transition-all inline-block"
                        style={{
                            backgroundColor: 'var(--color-primary)',
                            color: '#ffffff',
                        }}
                    >
                        Back to My Decks
                    </Link>
                </div>
            </div>
        );
    }

    if (showSummary) {
        const wordsNotUsed = getWordsNotUsed();
        return (
            <div className="min-h-screen p-6" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-display mb-6" style={{ color: 'var(--color-text)' }}>
                        Practice Session Summary
                    </h1>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="p-6 rounded" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
                            <p className="text-sm mb-2" style={{ color: 'var(--color-text-subdued)' }}>Words Practiced</p>
                            <p className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>{allWordsUsed.size}</p>
                            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>of {deckData?.count || 0} total</p>
                        </div>
                        <div className="p-6 rounded" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
                            <p className="text-sm mb-2" style={{ color: 'var(--color-text-subdued)' }}>Messages</p>
                            <p className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>{messages.length}</p>
                            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>exchanges</p>
                        </div>
                        <div className="p-6 rounded" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
                            <p className="text-sm mb-2" style={{ color: 'var(--color-text-subdued)' }}>Time</p>
                            <p className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>{getElapsedTime()}</p>
                        </div>
                    </div>

                    {wordsNotUsed.length > 0 && (
                        <div className="mb-6 p-6 rounded" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
                            <h2 className="text-xl font-semibold mb-3" style={{ color: 'var(--color-text)' }}>
                                Words to Practice More ({wordsNotUsed.length})
                            </h2>
                            <div className="flex flex-wrap gap-2">
                                {wordsNotUsed.map(word => (
                                    <span
                                        key={word}
                                        className="px-3 py-1 rounded text-sm"
                                        style={{
                                            backgroundColor: 'var(--color-bg-tertiary)',
                                            color: 'var(--color-text)',
                                        }}
                                    >
                                        {word}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex gap-4">
                        <button
                            onClick={() => {
                                window.location.reload();
                            }}
                            className="px-6 py-3 rounded transition-all"
                            style={{
                                backgroundColor: 'var(--color-primary)',
                                color: '#ffffff',
                            }}
                        >
                            Practice Again
                        </button>
                        <Link
                            to="/my-decks"
                            className="px-6 py-3 rounded transition-all inline-block"
                            style={{
                                backgroundColor: 'var(--color-bg-secondary)',
                                border: '1px solid var(--color-border)',
                                color: 'var(--color-text)',
                            }}
                        >
                            Back to My Decks
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
            {/* Header */}
            <div className="sticky top-0 z-50 px-4 py-4 border-b" style={{ backgroundColor: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' }}>
                <div className="max-w-4xl mx-auto flex justify-between items-center">
                    <div>
                        <h1 className="text-xl font-bold mb-1" style={{ color: 'var(--color-text)' }}>
                            Practice Conversation
                        </h1>
                        <p className="text-sm" style={{ color: 'var(--color-text-subdued)' }}>
                            {deckData?.title} • {allWordsUsed.size}/{deckData?.count || 0} words • {getElapsedTime()}
                        </p>
                    </div>
                    <button
                        onClick={handleEndPractice}
                        className="px-4 py-2 rounded transition-all"
                        style={{
                            backgroundColor: 'var(--color-bg-tertiary)',
                            border: '1px solid var(--color-border)',
                            color: 'var(--color-text)',
                        }}
                    >
                        End Practice
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-6">
                <div className="max-w-4xl mx-auto space-y-4">
                    {messages.map((message, idx) => (
                        <div
                            key={idx}
                            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-[80%] rounded-lg p-4 ${
                                    message.role === 'user'
                                        ? 'rounded-br-none'
                                        : 'rounded-bl-none'
                                }`}
                                style={{
                                    backgroundColor: message.role === 'user'
                                        ? 'var(--color-primary)'
                                        : 'var(--color-bg-secondary)',
                                    color: message.role === 'user' ? '#ffffff' : 'var(--color-text)',
                                    border: message.role === 'assistant' ? '1px solid var(--color-border)' : 'none',
                                }}
                            >
                                <div style={{ wordBreak: 'break-word' }}>
                                    {message.role === 'assistant' && message.wordsUsed
                                        ? highlightWords(message.content, message.wordsUsed)
                                        : message.content}
                                </div>
                                {message.role === 'assistant' && message.wordsUsed && message.wordsUsed.length > 0 && (
                                    <p className="text-xs mt-2 opacity-70">
                                        Words used: {message.wordsUsed.join(', ')}
                                    </p>
                                )}
                            </div>
                        </div>
                    ))}

                    {sending && (
                        <div className="flex justify-start">
                            <div
                                className="rounded-lg rounded-bl-none p-4"
                                style={{
                                    backgroundColor: 'var(--color-bg-secondary)',
                                    border: '1px solid var(--color-border)',
                                }}
                            >
                                <div className="flex gap-1">
                                    <div className="w-2 h-2 rounded-full bg-current animate-pulse" style={{ color: 'var(--color-text-subdued)' }} />
                                    <div className="w-2 h-2 rounded-full bg-current animate-pulse" style={{ color: 'var(--color-text-subdued)', animationDelay: '0.2s' }} />
                                    <div className="w-2 h-2 rounded-full bg-current animate-pulse" style={{ color: 'var(--color-text-subdued)', animationDelay: '0.4s' }} />
                                </div>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="p-4 rounded" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-critical)' }}>
                            <p style={{ color: 'var(--color-critical)' }}>Error: {error}</p>
                            <button
                                onClick={sendMessage}
                                className="mt-2 px-4 py-2 rounded text-sm"
                                style={{
                                    backgroundColor: 'var(--color-primary)',
                                    color: '#ffffff',
                                }}
                            >
                                Retry
                            </button>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Input */}
            <div className="sticky bottom-0 px-4 py-4 border-t" style={{ backgroundColor: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' }}>
                <div className="max-w-4xl mx-auto flex gap-3">
                    <input
                        ref={inputRef}
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Type your message..."
                        disabled={sending}
                        className="flex-1 px-4 py-3 rounded transition-all"
                        style={{
                            backgroundColor: 'var(--color-bg-tertiary)',
                            border: '1px solid var(--color-border)',
                            color: 'var(--color-text)',
                        }}
                    />
                    <button
                        onClick={sendMessage}
                        disabled={!inputValue.trim() || sending}
                        className="px-6 py-3 rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                            backgroundColor: 'var(--color-primary)',
                            color: '#ffffff',
                        }}
                    >
                        Send
                    </button>
                </div>
            </div>
        </div>
    );
}
