import { useState } from "react";
import TextArea from "./TextArea";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";  

export default function FlashcardGenerator() {
    const [textContent, setTextContent] = useState<string>('');
    const [difficulty, setDifficulty] = useState<string>('medium');
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const navigate = useNavigate();
    const { user } = useAuth(); 

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!textContent.trim()) {
            setError('Please provide text to generate flashcards');
            return;
        }
        
        if (!user) {
            setError('You must be logged in to generate flashcards');
            return;
        }
        
        setLoading(true);
        setError(null);
        
        try {
            const response = await fetch('http://localhost:8000/api/generate-flashcards', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: textContent,
                    difficulty: difficulty,
                    user_id: user.id  
                }),
            });

            // Get the response data first
            const data = await response.json();

            // Then check if it was successful
            if (!response.ok) {
                throw new Error(data.detail || `Error: ${response.status}`);
            }

            console.log('Generated flashcards:', data.flashcards);
            console.log('Default title:', data.default_title);
            
            // Navigate to preview page with generated data
            navigate('/deck-preview', {
                state: {
                    flashcards: data.flashcards,
                    difficulty: data.difficulty,
                    sourceText: data.source_text,
                    defaultTitle: data.default_title,
                    tempDeckId: data.deck_id
                }
            });
            
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
            console.error('Error:', err);
        } finally {
            setLoading(false);
        }
    };
    return (
        <div className="w-full max-w-2xl mx-auto">
            <form onSubmit={handleSubmit} className="space-y-6">
                        <TextArea
                            label="Enter your text here"
                            placeholder="Paste your article or notes here..."
                            value={textContent}
                            onChange={setTextContent}
                    rows={12}
                        />
                    
                <div className="flex items-center gap-4">
                    <label 
                        htmlFor="difficulty-select"
                        className="text-sm font-medium whitespace-nowrap"
                        style={{ color: 'var(--color-text-subdued)' }}
                    >
                        Difficulty:
                    </label>
                    <select 
                        id="difficulty-select"
                        value={difficulty}
                        onChange={(e) => setDifficulty(e.target.value)}
                        className="flex-1 max-w-xs p-3 rounded-md transition-all"
                        disabled={loading}
                        style={{
                            backgroundColor: 'var(--color-bg-tertiary)',
                            border: '1px solid var(--color-border)',
                            color: 'var(--color-text)',
                        }}
                    >
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                    </select>
                </div>

                <button 
                    type="submit"
                    disabled={loading || !textContent.trim()}
                    className="w-full px-6 py-4 font-medium rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                        backgroundColor: loading || !textContent.trim() ? 'var(--color-bg-tertiary)' : 'var(--color-primary)',
                        color: '#ffffff',
                    }}
                    onMouseEnter={(e) => {
                        if (!loading && textContent.trim()) {
                            e.currentTarget.style.opacity = '0.9';
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (!loading && textContent.trim()) {
                            e.currentTarget.style.opacity = '1';
                        }
                    }}
                >
                    {loading ? 'Generating Preview...' : 'Generate Preview'}
                </button>
            </form>

            {error && (
                <div 
                    className="mt-6 p-4 rounded-md"
                    style={{
                        backgroundColor: 'var(--color-critical)',
                        color: '#ffffff',
                        border: '1px solid var(--color-critical)',
                    }}
                >
                    Error: {error}
                </div>
            )}
        </div>
    );
}