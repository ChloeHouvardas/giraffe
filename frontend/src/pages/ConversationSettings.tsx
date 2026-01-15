import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

interface DeckData {
    deck_id: string;
    title: string;
    count: number;
    difficulty: string;
}

interface ConversationSettings {
    immersionLevel: number; // 0-100
    focusMode: 'deck-focused' | 'natural';
    topic: string;
    sessionLength: 'quick' | 'standard' | 'extended' | 'unlimited';
    saveForFuture: boolean;
}

export default function ConversationSettings() {
    const { deckId } = useParams<{ deckId: string }>();
    const navigate = useNavigate();
    const [deckData, setDeckData] = useState<DeckData | null>(null);
    const [loading, setLoading] = useState(true);
    const [settings, setSettings] = useState<ConversationSettings>({
        immersionLevel: 50, // Default to Partial
        focusMode: 'deck-focused',
        topic: 'general',
        sessionLength: 'standard',
        saveForFuture: false,
    });

    useEffect(() => {
        if (!deckId) return;

        const fetchDeck = async () => {
            try {
                const response = await fetch(`http://localhost:8000/api/decks/${deckId}`);
                if (!response.ok) throw new Error('Failed to load deck');
                const data = await response.json();
                setDeckData({
                    deck_id: data.deck_id,
                    title: data.title,
                    count: data.count,
                    difficulty: data.difficulty,
                });
                setLoading(false);
            } catch {
                setLoading(false);
            }
        };

        fetchDeck();
    }, [deckId]);

    const getImmersionLabel = (level: number) => {
        if (level <= 33) return 'Minimal';
        if (level <= 66) return 'Partial';
        return 'Complete';
    };

    const getImmersionDescription = (level: number) => {
        if (level <= 33) {
            return 'AI uses mostly English with occasional target language words. Provides translations immediately.';
        }
        if (level <= 66) {
            return 'Mix of English and target language (50/50). AI uses target language for vocab words and common phrases.';
        }
        return 'AI responds entirely in target language. Natural native-level conversation.';
    };

    const handleStart = () => {
        // Save settings to localStorage if requested
        if (settings.saveForFuture) {
            localStorage.setItem('conversationSettings', JSON.stringify(settings));
        }

        // Navigate to conversation with settings in state
        navigate(`/practice/conversation/${deckId}`, { state: { settings } });
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
                    <p style={{ color: 'var(--color-text-subdued)' }}>Loading settings...</p>
                </div>
            </div>
        );
    }

    if (!deckData) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
                <div className="text-center">
                    <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--color-text)' }}>
                        Deck not found
                    </h2>
                    <button
                        onClick={() => navigate('/my-decks')}
                        className="px-6 py-3 rounded transition-all"
                        style={{
                            backgroundColor: 'var(--color-primary)',
                            color: '#ffffff',
                        }}
                    >
                        Back to My Decks
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen p-6" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
            <div className="max-w-2xl mx-auto">
                <h1 className="text-display mb-2" style={{ color: 'var(--color-text)' }}>
                    Conversation Settings
                </h1>
                <p className="mb-6" style={{ color: 'var(--color-text-subdued)' }}>
                    Deck: <strong>{deckData.title}</strong> ({deckData.count} words)
                </p>

                {/* Immersion Level */}
                <div className="mb-8 p-6 rounded" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-light)' }}>
                    <label className="block text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
                        Language Immersion Level
                    </label>
                    <div className="mb-4">
                        <div className="flex justify-between text-sm mb-2" style={{ color: 'var(--color-text-subdued)' }}>
                            <span>Minimal</span>
                            <span>Partial</span>
                            <span>Complete</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={settings.immersionLevel}
                            onChange={(e) => setSettings({ ...settings, immersionLevel: parseInt(e.target.value) })}
                            className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                            aria-label="Language immersion level"
                            title="Language immersion level"
                            style={{
                                background: `linear-gradient(to right, 
                                    var(--color-success) 0%, 
                                    var(--color-success) ${settings.immersionLevel <= 33 ? settings.immersionLevel * 3 : 100}%,
                                    var(--color-info) ${settings.immersionLevel <= 33 ? settings.immersionLevel * 3 : 100}%,
                                    var(--color-info) ${settings.immersionLevel <= 66 ? 100 : (settings.immersionLevel - 33) * 3}%,
                                    var(--color-warning) ${settings.immersionLevel <= 66 ? 100 : (settings.immersionLevel - 33) * 3}%,
                                    var(--color-warning) 100%)`,
                            }}
                        />
                        <div className="mt-2 text-center">
                            <span className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>
                                {getImmersionLabel(settings.immersionLevel)}
                            </span>
                        </div>
                    </div>
                    <p className="text-sm mt-3" style={{ color: 'var(--color-text-subdued)' }}>
                        {getImmersionDescription(settings.immersionLevel)}
                    </p>
                </div>

                {/* Conversation Focus */}
                <div className="mb-8 p-6 rounded" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-light)' }}>
                    <label className="block text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
                        Conversation Focus
                    </label>
                    <div className="space-y-3">
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="radio"
                                name="focusMode"
                                value="deck-focused"
                                checked={settings.focusMode === 'deck-focused'}
                                onChange={(e) => setSettings({ ...settings, focusMode: e.target.value as 'deck-focused' | 'natural' })}
                                className="w-5 h-5"
                                style={{ accentColor: 'var(--color-primary)' }}
                            />
                            <div>
                                <span style={{ color: 'var(--color-text)' }}>Focus on deck words (recommended)</span>
                                <p className="text-sm" style={{ color: 'var(--color-text-subdued)' }}>
                                    AI prioritizes using words from this deck
                                </p>
                            </div>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="radio"
                                name="focusMode"
                                value="natural"
                                checked={settings.focusMode === 'natural'}
                                onChange={(e) => setSettings({ ...settings, focusMode: e.target.value as 'deck-focused' | 'natural' })}
                                className="w-5 h-5"
                                style={{ accentColor: 'var(--color-primary)' }}
                            />
                            <div>
                                <span style={{ color: 'var(--color-text)' }}>Natural conversation</span>
                                <p className="text-sm" style={{ color: 'var(--color-text-subdued)' }}>
                                    More free-flowing discussion with deck words used naturally
                                </p>
                            </div>
                        </label>
                    </div>
                </div>

                {/* Topic Selection */}
                <div className="mb-8 p-6 rounded" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-light)' }}>
                    <label className="block text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
                        Conversation Topic (Optional)
                    </label>
                    <select
                        value={settings.topic}
                        onChange={(e) => setSettings({ ...settings, topic: e.target.value })}
                        className="w-full px-4 py-3 rounded"
                        aria-label="Conversation topic"
                        title="Conversation topic"
                        style={{
                            backgroundColor: 'var(--color-bg-tertiary)',
                            border: '1px solid var(--color-border)',
                            color: 'var(--color-text)',
                        }}
                    >
                        <option value="general">General conversation</option>
                        <option value="travel">Travel & tourism</option>
                        <option value="business">Business & work</option>
                        <option value="daily">Daily life & hobbies</option>
                        <option value="food">Food & dining</option>
                        <option value="news">News & current events</option>
                        <option value="custom">Custom (type your own)</option>
                    </select>
                    {settings.topic === 'custom' && (
                        <input
                            type="text"
                            placeholder="Enter your topic..."
                            className="w-full mt-3 px-4 py-3 rounded"
                            style={{
                                backgroundColor: 'var(--color-bg-tertiary)',
                                border: '1px solid var(--color-border)',
                                color: 'var(--color-text)',
                            }}
                            onChange={(e) => setSettings({ ...settings, topic: e.target.value })}
                        />
                    )}
                </div>

                {/* Session Length */}
                <div className="mb-8 p-6 rounded" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-light)' }}>
                    <label className="block text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
                        Session Length
                    </label>
                    <select
                        value={settings.sessionLength}
                        onChange={(e) => setSettings({ ...settings, sessionLength: e.target.value as 'quick' | 'standard' | 'extended' | 'unlimited' })}
                        className="w-full px-4 py-3 rounded"
                        aria-label="Session length"
                        title="Session length"
                        style={{
                            backgroundColor: 'var(--color-bg-tertiary)',
                            border: '1px solid var(--color-border)',
                            color: 'var(--color-text)',
                        }}
                    >
                        <option value="quick">Quick practice (5 minutes)</option>
                        <option value="standard">Standard (15 minutes)</option>
                        <option value="extended">Extended (30 minutes)</option>
                        <option value="unlimited">Unlimited</option>
                    </select>
                </div>

                {/* Save Settings */}
                <div className="mb-8 p-6 rounded" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-light)' }}>
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={settings.saveForFuture}
                            onChange={(e) => setSettings({ ...settings, saveForFuture: e.target.checked })}
                            className="w-5 h-5"
                            style={{ accentColor: 'var(--color-primary)' }}
                        />
                        <span style={{ color: 'var(--color-text)' }}>
                            Use these settings for all conversations
                        </span>
                    </label>
                </div>

                {/* Actions */}
                <div className="flex justify-between gap-4">
                    <button
                        onClick={() => navigate('/my-decks')}
                        className="px-6 py-3 rounded transition-all"
                        style={{
                            backgroundColor: 'var(--color-bg-secondary)',
                            border: '1px solid var(--color-border)',
                            color: 'var(--color-text)',
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleStart}
                        className="px-6 py-3 rounded transition-all font-medium"
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
                        Start Conversation
                    </button>
                </div>
            </div>
        </div>
    );
}
