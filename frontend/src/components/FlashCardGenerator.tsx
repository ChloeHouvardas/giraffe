import { useState } from "react";
import TextArea from "./TextArea";
// import FileUpload from "./FileUpload";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { getApiUrl } from "../config/api";  

// interface Flashcard {
//     front: string;
//     back: string;
// }

export default function FlashcardGenerator() {
    const [textContent, setTextContent] = useState<string>('');
    // const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [difficulty, setDifficulty] = useState<string>('medium');
    // const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const navigate = useNavigate();
    const { user } = useAuth(); 

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // && !uploadedFile
        if (!textContent.trim() ) {
            setError('Please provide text or upload a file');
            return;
        }
        
        if (!user) {
            setError('You must be logged in to generate flashcards');
            return;
        }
        
        setLoading(true);
        setError(null);
        
        try {
            const response = await fetch(getApiUrl('/api/generate-flashcards'), {
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

            console.log('Generated deck:', data.deck_id);
            console.log('Flashcards:', data.flashcards);
            
            // Navigate to preview screen instead of directly to flashcards
            navigate(`/preview/${data.deck_id}`);
            
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
            console.error('Error:', err);
        } finally {
            setLoading(false);
        }
    };
    return (
        <div className="w-full max-w-4xl mx-auto">
            <form onSubmit={handleSubmit}>
                <div className="flex flex-row gap-20 mb-6 items-stretch">
                    <div className="flex-1 flex flex-col">
                        <TextArea
                            label="Enter your text here"
                            placeholder="Paste your article or notes here..."
                            value={textContent}
                            onChange={setTextContent}
                            rows={8}
                        />
                    </div>
                    
                    {/* <div className="flex flex-col justify-center text-text-subdued">
                        OR
                    </div>
                    
                    <div className="flex-1 flex flex-col">
                        <FileUpload
                            accept="image/png, image/jpeg"
                            label="Upload an image"
                            onFileSelect={setUploadedFile}
                        />
                    </div> */}
                </div>

                <div className="mb-6">
                    <label 
                        htmlFor="difficulty-select"
                        className="block text-sm font-medium text-text-subdued mb-2"
                    >
                        Difficulty:
                    </label>
                    <select 
                        id="difficulty-select"
                        value={difficulty}
                        onChange={(e) => setDifficulty(e.target.value)}
                        className="bg-bg-tertiary p-2 border border-border-default rounded-md"
                        disabled={loading}
                    >
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>t
                    </select>
                </div>

                <button 
                    type="submit"
                    disabled={loading || (!textContent.trim())} //  && !uploadedFile
                    className="w-full px-6 py-3 bg-primary text-white font-medium rounded-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? 'Generating...' : 'Generate Flashcards'}
                </button>
            </form>

            {error && (
                <div className="mt-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-md">
                    Error: {error}
                </div>
            )}
            {/* {flashcards.length > 0 && (
                <div className="mt-8">
                    <h2 className="text-2xl font-bold text-text mb-4">
                        Generated Flashcards ({flashcards.length})
                    </h2>
                    <div className="space-y-4">
                        {flashcards.map((card, index) => (
                            <div 
                                key={index} 
                                className="p-4 border border-border-default rounded-md bg-white shadow-sm"
                            >
                                <p className="font-bold text-lg mb-2 text-text">
                                    Q: {card.front}
                                </p>
                                <p className="text-text-subdued">
                                    A: {card.back}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )} */}
        </div>
    );
}