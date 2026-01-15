import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import VocabWord from '../components/VocabWord';

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

interface ConversationSettings {
    immersionLevel: number;
    focusMode: 'deck-focused' | 'natural';
    topic: string;
    sessionLength: string;
}

export default function ConversationPractice() {
    const { deckId } = useParams<{ deckId: string }>();
    const navigate = useNavigate();
    const location = useLocation();
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
    const [settings, setSettings] = useState<ConversationSettings | null>(null);
    const [tooltip, setTooltip] = useState<{ word: string; definition: string; x: number; y: number } | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Get settings from location state or localStorage
    useEffect(() => {
        // Try to get settings from location state
        const state = location.state as any;
        if (state?.settings) {
            setSettings(state.settings);
        } else {
            // Try to load from localStorage
            const saved = localStorage.getItem('conversationSettings');
            if (saved) {
                try {
                    setSettings(JSON.parse(saved));
                } catch (e) {
                    // Invalid saved settings, redirect to settings
                    navigate(`/practice/conversation/${deckId}/settings`, { replace: true });
                    return;
                }
            } else {
                // No settings, redirect to settings page
                navigate(`/practice/conversation/${deckId}/settings`, { replace: true });
                return;
            }
        }
    }, [deckId, navigate, location]);

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
        if (!loading && deckData && messages.length === 0 && user && settings) {
            const startConv = async () => {
                setSending(true);
                try {
                    // Add initial user message to start the conversation
                    const initialUserMessage = {
                        role: 'user',
                        content: "Hello! I'm ready to practice my vocabulary."
                    };

                    console.log("Starting conversation with settings:", settings);
                    
                    const response = await fetch('http://localhost:8000/api/practice/conversation', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            deck_id: deckId,
                            user_id: user.id,
                            messages: [initialUserMessage],
                            is_first_message: true,
                            settings: settings
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
    }, [loading, deckData, user, deckId, settings]);

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
                    is_first_message: false,
                    settings: settings
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

    const parseMessageWithTags = (text: string): React.ReactNode[] => {
        if (!deckData) return [text];

        const parts: React.ReactNode[] = [];
        let lastIndex = 0;

        // Regex to find <vocab>word</vocab> and <unknown>word</unknown> tags
        const vocabRegex = /<vocab>(.*?)<\/vocab>/gi;
        const unknownRegex = /<unknown>(.*?)<\/unknown>/gi;

        const matches: Array<{ type: 'vocab' | 'unknown'; word: string; start: number; end: number }> = [];

        // Find vocab tags
        let match;
        while ((match = vocabRegex.exec(text)) !== null) {
            matches.push({
                type: 'vocab',
                word: match[1],
                start: match.index,
                end: match.index + match[0].length
            });
        }

        // Find unknown tags
        while ((match = unknownRegex.exec(text)) !== null) {
            matches.push({
                type: 'unknown',
                word: match[1],
                start: match.index,
                end: match.index + match[0].length
            });
        }

        // Sort by position
        matches.sort((a, b) => a.start - b.start);

        // Build parts
        matches.forEach((match, idx) => {
            // Add text before match
            if (match.start > lastIndex) {
                parts.push(text.substring(lastIndex, match.start));
            }

            // Find word definition
            const wordDef = deckData.flashcards.find(f => f.front.toLowerCase() === match.word.toLowerCase());

            // Add highlighted word
            parts.push(
                <VocabWord
                    key={`word-${idx}`}
                    word={match.word}
                    definition={wordDef?.back || match.word}
                    type={match.type}
                    onExplain={(word) => askForExplanation(word)}
                />
            );

            lastIndex = match.end;
        });

        // Add remaining text
        if (lastIndex < text.length) {
            parts.push(text.substring(lastIndex));
        }

        return parts.length > 0 ? parts : [text];
    };

    const askForExplanation = async (word: string) => {
        if (!user || !deckData) return;

        setTooltip(null);
        
        const wordDef = deckData.flashcards.find(f => f.front.toLowerCase() === word.toLowerCase());
        const explanationMessage = `Can you explain the word "${word}" in more detail? How would I use it in different contexts?${wordDef ? ` (Definition: ${wordDef.back})` : ''}`;

        const userMessage: Message = {
            role: 'user',
            content: explanationMessage,
            timestamp: new Date()
        };

        const newMessages = [...messages, userMessage];
        setMessages(newMessages);
        setInputValue('');
        setSending(true);
        setError(null);

        try {
            const apiMessages = newMessages.map(m => ({
                role: m.role,
                content: m.content
            }));

            const response = await fetch('http://localhost:8000/api/practice/conversation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    deck_id: deckId,
                    user_id: user.id,
                    messages: apiMessages,
                    is_first_message: false,
                    settings: settings
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || 'Failed to send message');
            }

            const data = await response.json();
            const aiMessage: Message = {
                role: 'assistant',
                content: data.message,
                wordsUsed: data.words_used || [],
                timestamp: new Date()
            };

            setMessages([...newMessages, aiMessage]);
            updateWordsUsed(data.words_used || []);
        } catch (err) {
            console.error("Error asking for explanation:", err);
            setError(err instanceof Error ? err.message : 'Failed to send message');
        } finally {
            setSending(false);
            inputRef.current?.focus();
        }
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
                            {settings && (
                                <> • {settings.focusMode === 'deck-focused' ? 'Deck focused' : 'Natural'} • {
                                    settings.immersionLevel <= 33 ? 'Minimal' :
                                    settings.immersionLevel <= 66 ? 'Partial' : 'Complete'
                                } immersion</>
                            )}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => navigate(`/practice/conversation/${deckId}/settings`)}
                            className="px-4 py-2 rounded transition-all text-sm"
                            style={{
                                backgroundColor: 'var(--color-bg-tertiary)',
                                border: '1px solid var(--color-border)',
                                color: 'var(--color-text)',
                            }}
                        >
                            ⚙️ Settings
                        </button>
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
                                    {message.role === 'assistant'
                                        ? parseMessageWithTags(message.content)
                                        : message.content}
                                </div>
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
