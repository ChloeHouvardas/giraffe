import FlashcardGenerator from "../components/FlashCardGenerator";
import { useAuth } from '../auth/useAuth';
import { useNavigate, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';


interface PracticeTypeStats {
    total_minutes: number;
    total_seconds: number;
    session_count: number;
    progress_percentage: number;
    goal_reached: boolean;
}

interface DailyStats {
    flashcard: PracticeTypeStats;
    conversation: PracticeTypeStats;
    combined: {
        total_minutes: number;
        total_seconds: number;
        session_count: number;
        daily_goal_minutes: number;
        progress_percentage: number;
        goal_reached: boolean;
    };
}

export default function Home() {
    const { signOut, user } = useAuth()
    const navigate = useNavigate()
    const [dailyStats, setDailyStats] = useState<DailyStats | null>(null);
    const [loadingStats, setLoadingStats] = useState(true);
    const [showSettings, setShowSettings] = useState(false);
    const [dailyGoal, setDailyGoal] = useState(15);
    const [savingGoal, setSavingGoal] = useState(false);

    useEffect(() => {
        if (!user) return;

        const fetchDailyStats = async () => {
            try {
                const response = await fetch(`http://localhost:8000/api/stats/daily?user_id=${user.id}`);
                if (response.ok) {
                    const data = await response.json();
                    setDailyStats(data);
                    setDailyGoal(data.combined.daily_goal_minutes);
                }
            } catch (err) {
                console.error('Failed to fetch daily stats:', err);
            } finally {
                setLoadingStats(false);
            }
        };

        fetchDailyStats();
        // Refresh stats every 30 seconds
        const interval = setInterval(fetchDailyStats, 30000);
        return () => clearInterval(interval);
    }, [user]);

    const handleSaveGoal = async () => {
        if (!user || savingGoal) return;
        
        setSavingGoal(true);
        try {
            const response = await fetch(`http://localhost:8000/api/user-settings?user_id=${user.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    daily_goal_minutes: dailyGoal
                }),
            });
            
            if (response.ok) {
                setShowSettings(false);
                // Refresh stats
                const statsResponse = await fetch(`http://localhost:8000/api/stats/daily?user_id=${user.id}`);
                if (statsResponse.ok) {
                    const data = await statsResponse.json();
                    setDailyStats(data);
                }
            }
        } catch (err) {
            console.error('Failed to save goal:', err);
        } finally {
            setSavingGoal(false);
        }
    };

    const handleLogout = async () => {
        await signOut()
        navigate('/login')
    }

    return (
        <div className = "min-h-screen flex items-center justify-center p-6">
            <div className="absolute top-6 right-6 flex gap-3">
                <Link
                    to="/my-words"
                    className="px-6 py-3 rounded transition-all"
                    style={{
                        backgroundColor: 'var(--color-bg-secondary)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text)',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)'
                        e.currentTarget.style.borderColor = 'var(--color-primary)'
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)'
                        e.currentTarget.style.borderColor = 'var(--color-border)'
                    }}
                >
                    My Words
                </Link>
                <Link
                    to="/my-decks"
                    className="px-6 py-3 rounded transition-all"
                    style={{
                        backgroundColor: 'var(--color-bg-secondary)',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text)',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)'
                        e.currentTarget.style.borderColor = 'var(--color-primary)'
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)'
                        e.currentTarget.style.borderColor = 'var(--color-border)'
                    }}
                >
                    My Decks
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
                        e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)'
                        e.currentTarget.style.borderColor = 'var(--color-primary)'
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)'
                        e.currentTarget.style.borderColor = 'var(--color-border)'
                    }}
                >
                    Sign Out
                </button>
            </div>

            <div className="text-center w-full max-w-4xl mx-auto px-4">
                <h1 className="text-display mb-4" style={{ color: 'var(--color-text)' }}>
                    Welcome to Giraffe!
                </h1>
                <p className="text-lg mb-8" style={{ color: 'var(--color-text-subdued)' }}>
                    Let's get learning
                </p>

                {/* Daily Goal Progress */}
                {!loadingStats && dailyStats && (
                    <div className="mb-8 space-y-4">
                        {/* Combined Progress */}
                        <div className="p-6 rounded-lg" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-light)' }}>
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="text-xl font-semibold" style={{ color: 'var(--color-text)' }}>
                                    Today's Progress
                                </h2>
                                <div className="flex items-center gap-2">
                                    {dailyStats.combined.goal_reached && (
                                        <span className="text-2xl">🎉</span>
                                    )}
                                    <button
                                        onClick={() => setShowSettings(true)}
                                        className="px-3 py-1 rounded text-sm transition-all"
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
                                        ⚙️ Settings
                                    </button>
                                </div>
                            </div>
                            <div className="mb-3">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-lg font-medium" style={{ color: 'var(--color-text-subdued)' }}>
                                        {dailyStats.combined.total_minutes} / {dailyStats.combined.daily_goal_minutes} minutes
                                    </span>
                                    <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                                        {dailyStats.combined.session_count} session{dailyStats.combined.session_count !== 1 ? 's' : ''}
                                    </span>
                                </div>
                                <div 
                                    className="w-full h-3 rounded-full overflow-hidden"
                                    style={{ backgroundColor: 'var(--color-bg-tertiary)' }}
                                >
                                    <div
                                        className="h-full transition-all duration-500 rounded-full"
                                        style={{
                                            width: `${Math.min(100, dailyStats.combined.progress_percentage)}%`,
                                            backgroundColor: dailyStats.combined.goal_reached ? 'var(--color-success)' : 'var(--color-primary)',
                                        }}
                                    />
                                </div>
                            </div>
                            {dailyStats.combined.goal_reached ? (
                                <p className="text-sm font-medium" style={{ color: 'var(--color-success)' }}>
                                    🎊 Daily goal achieved! Great work!
                                </p>
                            ) : (
                                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                                    {dailyStats.combined.daily_goal_minutes - dailyStats.combined.total_minutes} more minutes to reach your goal
                                </p>
                            )}
                        </div>

                        {/* Breakdown by Type */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Flashcard Progress */}
                            <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-light)' }}>
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
                                        📚 Flashcards
                                    </h3>
                                    {dailyStats.flashcard.goal_reached && (
                                        <span className="text-xl">✓</span>
                                    )}
                                </div>
                                <div className="mb-2">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-sm font-medium" style={{ color: 'var(--color-text-subdued)' }}>
                                            {dailyStats.flashcard.total_minutes} min
                                        </span>
                                        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                            {dailyStats.flashcard.session_count} session{dailyStats.flashcard.session_count !== 1 ? 's' : ''}
                                        </span>
                                    </div>
                                    <div 
                                        className="w-full h-2 rounded-full overflow-hidden"
                                        style={{ backgroundColor: 'var(--color-bg-tertiary)' }}
                                    >
                                        <div
                                            className="h-full transition-all duration-500 rounded-full"
                                            style={{
                                                width: `${Math.min(100, dailyStats.flashcard.progress_percentage)}%`,
                                                backgroundColor: dailyStats.flashcard.goal_reached ? 'var(--color-success)' : 'var(--color-primary)',
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Conversation Progress */}
                            <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-light)' }}>
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
                                        💬 Conversation
                                    </h3>
                                    {dailyStats.conversation.goal_reached && (
                                        <span className="text-xl">✓</span>
                                    )}
                                </div>
                                <div className="mb-2">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-sm font-medium" style={{ color: 'var(--color-text-subdued)' }}>
                                            {dailyStats.conversation.total_minutes} min
                                        </span>
                                        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                            {dailyStats.conversation.session_count} session{dailyStats.conversation.session_count !== 1 ? 's' : ''}
                                        </span>
                                    </div>
                                    <div 
                                        className="w-full h-2 rounded-full overflow-hidden"
                                        style={{ backgroundColor: 'var(--color-bg-tertiary)' }}
                                    >
                                        <div
                                            className="h-full transition-all duration-500 rounded-full"
                                            style={{
                                                width: `${Math.min(100, dailyStats.conversation.progress_percentage)}%`,
                                                backgroundColor: dailyStats.conversation.goal_reached ? 'var(--color-success)' : 'var(--color-info)',
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Breakdown Text */}
                        <p className="text-sm text-center" style={{ color: 'var(--color-text-muted)' }}>
                            {dailyStats.flashcard.total_minutes} min flashcards + {dailyStats.conversation.total_minutes} min conversation = {dailyStats.combined.total_minutes}/{dailyStats.combined.daily_goal_minutes} min goal
                        </p>
                    </div>
                )}

                <FlashcardGenerator />
            </div>

            {/* Settings Modal */}
            {showSettings && (
                <div 
                    className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
                    onClick={() => setShowSettings(false)}
                >
                    <div 
                        className="p-8 rounded-lg shadow-lg w-full max-w-md"
                        style={{ backgroundColor: 'var(--color-bg-primary)' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--color-text)' }}>
                            Daily Goal Settings
                        </h2>
                        <div className="mb-6">
                            <label htmlFor="daily-goal" className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
                                Daily Practice Goal (minutes)
                            </label>
                            <input
                                id="daily-goal"
                                type="number"
                                min="1"
                                max="480"
                                value={dailyGoal}
                                onChange={(e) => setDailyGoal(parseInt(e.target.value) || 15)}
                                className="w-full px-4 py-2 rounded"
                                style={{
                                    backgroundColor: 'var(--color-bg-tertiary)',
                                    border: '1px solid var(--color-border)',
                                    color: 'var(--color-text)',
                                }}
                            />
                            <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
                                Set your daily practice goal (1-480 minutes). Both flashcard and conversation practice count toward this goal.
                            </p>
                        </div>
                        <div className="flex justify-end gap-4">
                            <button
                                onClick={() => setShowSettings(false)}
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
                                onClick={handleSaveGoal}
                                disabled={savingGoal}
                                className="px-6 py-3 rounded transition-all disabled:opacity-50"
                                style={{
                                    backgroundColor: 'var(--color-primary)',
                                    color: '#ffffff',
                                }}
                            >
                                {savingGoal ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
        
    )
}
