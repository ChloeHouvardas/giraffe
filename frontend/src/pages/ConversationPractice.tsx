import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import VocabWord from '../components/VocabWord';
import { getApiUrl } from '../config/api';

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

interface SpeechRecognitionEvent {
    resultIndex: number;
    results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
    length: number;
    [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
    isFinal: boolean;
    [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
    transcript: string;
    confidence: number;
}

interface SpeechRecognitionErrorEvent {
    error: string;
    message?: string;
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
    const [showSummary, setShowSummary] = useState(false);
    const [sessionSeconds, setSessionSeconds] = useState(0);
    const [finalSessionSeconds, setFinalSessionSeconds] = useState<number | null>(null); // Store final duration for summary
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const startTimeRef = useRef<number>(Date.now());
    const pausedTimeRef = useRef<number>(0);
    const [settings, setSettings] = useState<ConversationSettings | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    
    // Speech recognition state
    const [isListening, setIsListening] = useState(false);
    const [speechSupported, setSpeechSupported] = useState(false);
    const [speechError, setSpeechError] = useState<string | null>(null);
    interface SpeechRecognitionInstance {
        continuous: boolean;
        interimResults: boolean;
        lang: string;
        onstart: (() => void) | null;
        onresult: ((event: SpeechRecognitionEvent) => void) | null;
        onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
        onend: (() => void) | null;
        start: () => void;
        stop: () => void;
    }
    
    const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
    const speechBaseValueRef = useRef<string>(''); // Store input value when speech starts
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const isFirefoxRef = useRef(false);
    const streamRef = useRef<MediaStream | null>(null);
    const [targetLanguage, setTargetLanguage] = useState<string>('fr-FR'); // Default to French
    const conversationStartedRef = useRef<boolean>(false); // Prevent duplicate API calls

    // Detect target language from deck or settings
    useEffect(() => {
        // Try to detect language from deck title or flashcards
        // For now, default to French (fr-FR) - can be made configurable
        // You could also detect from deck title, flashcards, or user settings
        if (deckData?.title) {
            // Simple heuristic: if title contains French words or is in French, use fr-FR
            // Otherwise, you could add a language field to the deck
            const title = deckData.title.toLowerCase();
            if (title.includes('français') || title.includes('french')) {
                setTargetLanguage('fr-FR');
            } else {
                // Default to French for this app
                setTargetLanguage('fr-FR');
            }
        }
    }, [deckData]);

    // Check browser support for speech recognition
    useEffect(() => {
        // Detect Firefox
        const isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
        isFirefoxRef.current = isFirefox;
        
        interface WindowWithSpeechRecognition extends Window {
            SpeechRecognition?: new () => SpeechRecognitionInstance;
            webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
        }
        
        const SpeechRecognition = (window as WindowWithSpeechRecognition).SpeechRecognition || (window as WindowWithSpeechRecognition).webkitSpeechRecognition;
        
        if (SpeechRecognition) {
            // Chrome/Edge/Safari - use Web Speech API
            setSpeechSupported(true);
            const recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = true;
            // Set language - default to French for this app
            recognition.lang = targetLanguage || 'fr-FR';
            
            recognition.onstart = () => {
                setIsListening(true);
                setSpeechError(null);
                speechBaseValueRef.current = inputRef.current?.value || '';
            };
            
            recognition.onresult = (event: SpeechRecognitionEvent) => {
                let interimTranscript = '';
                let finalTranscript = '';
                
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        finalTranscript += transcript + ' ';
                    } else {
                        interimTranscript += transcript;
                    }
                }
                
                const base = speechBaseValueRef.current;
                if (finalTranscript) {
                    setInputValue(base + finalTranscript.trim() + (interimTranscript ? ' ' + interimTranscript : ''));
                    speechBaseValueRef.current = base + finalTranscript.trim() + ' ';
                } else if (interimTranscript) {
                    setInputValue(base + interimTranscript);
                }
            };
            
            recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
                console.error('Speech recognition error:', event.error);
                setIsListening(false);
                
                if (event.error === 'no-speech') {
                    setSpeechError('No speech detected. Try again.');
                } else if (event.error === 'audio-capture') {
                    setSpeechError('No microphone found. Please check your microphone.');
                } else if (event.error === 'not-allowed') {
                    setSpeechError('Microphone permission denied. Please enable microphone access.');
                } else {
                    setSpeechError(`Speech recognition error: ${event.error}`);
                }
                
                setTimeout(() => setSpeechError(null), 3000);
            };
            
            recognition.onend = () => {
                setIsListening(false);
            };
            
            recognitionRef.current = recognition;
        } else if (isFirefox && navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
            // Firefox - check if it has experimental Web Speech API support
            // If not, we'll use MediaRecorder as fallback (requires backend)
            // Some Firefox versions have experimental support via about:config
            setSpeechSupported(true);
        } else {
            setSpeechSupported(false);
        }
    }, [targetLanguage]); // Re-initialize when language changes

    // Get settings from location state or localStorage
    useEffect(() => {
        // Try to get settings from location state
        interface LocationState {
            settings?: ConversationSettings;
        }
        const state = location.state as LocationState | null;
        if (state?.settings) {
            setSettings(state.settings);
        } else {
            // Try to load from localStorage
            const saved = localStorage.getItem('conversationSettings');
            if (saved) {
                try {
                    setSettings(JSON.parse(saved));
                } catch {
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
                const response = await fetch(getApiUrl(`/api/decks/${deckId}`));
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

    // Session timer logic
    useEffect(() => {
        if (!user || loading || !deckData || !settings) return;

        // Start timer
        startTimeRef.current = Date.now();

        // Handle tab visibility (pause when tab is inactive)
        const handleVisibilityChange = () => {
            if (document.hidden) {
                // Tab is hidden, pause timer
                if (intervalRef.current) {
                    clearInterval(intervalRef.current);
                    intervalRef.current = null;
                }
                pausedTimeRef.current += Date.now() - startTimeRef.current;
            } else {
                // Tab is visible, resume timer
                startTimeRef.current = Date.now();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Update timer every second (only if summary not shown)
        intervalRef.current = setInterval(() => {
            if (!document.hidden && !showSummary) {
                const elapsed = Math.floor((Date.now() - startTimeRef.current + pausedTimeRef.current) / 1000);
                setSessionSeconds(elapsed);
            }
        }, 1000);

        // Save session when component unmounts
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }

            // Save session
            // IMPORTANT: Calculate duration in SECONDS
            const totalSeconds = Math.floor((Date.now() - startTimeRef.current + pausedTimeRef.current) / 1000);
            if (totalSeconds > 0 && user && !showSummary) {
                // Save session asynchronously (don't block unmount)
                // IMPORTANT: duration_seconds must be in SECONDS, not minutes
                console.log(`Auto-saving conversation session: ${totalSeconds} seconds (${(totalSeconds / 60).toFixed(2)} minutes)`);
                fetch(getApiUrl('/api/sessions'), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        user_id: user.id,
                        deck_id: deckId || null,
                        practice_type: 'conversation',
                        duration_seconds: totalSeconds  // SECONDS, not minutes
                    }),
                }).catch(err => {
                    console.error('Failed to save session:', err);
                });
            }
        };
    }, [user, loading, deckData, settings, deckId, showSummary]); // showSummary dependency ensures timer stops when summary is shown

    // Stop timer when summary is shown (additional safeguard)
    useEffect(() => {
        if (showSummary && intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }, [showSummary]);

    // Reset conversation started flag when deckId changes
    useEffect(() => {
        conversationStartedRef.current = false;
    }, [deckId]);

    // Start conversation with AI greeting
    useEffect(() => {
        // Prevent duplicate calls - check if conversation already started
        if (conversationStartedRef.current) {
            return;
        }
        
        // Only start if all required data is loaded and no messages exist
        if (!loading && deckData && messages.length === 0 && user && settings) {
            // Mark as started immediately to prevent duplicate calls
            conversationStartedRef.current = true;
            
            const startConv = async () => {
                setSending(true);
                try {
                    // Add initial user message to start the conversation
                    const initialUserMessage = {
                        role: 'user',
                        content: "Hello! I'm ready to practice my vocabulary."
                    };

                    console.log("Starting conversation with settings:", settings);
                    
                    const response = await fetch(getApiUrl('/api/practice/conversation'), {
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
                    // Reset the ref on error so user can retry
                    conversationStartedRef.current = false;
                } finally {
                    setSending(false);
                }
            };
            startConv();
        }
    }, [loading, deckData, user, deckId, settings, messages.length]);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Focus input on mount (but not when listening)
    useEffect(() => {
        if (!isListening) {
            inputRef.current?.focus();
        }
    }, [isListening]);
    
    // Cleanup speech recognition on unmount
    useEffect(() => {
        return () => {
            if (recognitionRef.current && isListening) {
                recognitionRef.current.stop();
            }
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
            }
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, [isListening]);


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

            const response = await fetch(getApiUrl('/api/practice/conversation'), {
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

    const startFirefoxRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
            streamRef.current = stream;
            
            // Try to use Web Speech API if available (some Firefox versions have experimental support)
            interface WindowWithSpeechRecognition extends Window {
            SpeechRecognition?: new () => SpeechRecognitionInstance;
            webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
        }
        
        const SpeechRecognition = (window as WindowWithSpeechRecognition).SpeechRecognition || (window as WindowWithSpeechRecognition).webkitSpeechRecognition;
            
            if (SpeechRecognition) {
                // Firefox with experimental Web Speech API support
                const recognition = new SpeechRecognition();
                recognition.continuous = false;
                recognition.interimResults = true;
                // Set language - default to French for this app
                recognition.lang = targetLanguage || 'fr-FR';
                
                recognition.onstart = () => {
                    setIsListening(true);
                    setSpeechError(null);
                    speechBaseValueRef.current = inputRef.current?.value || '';
                };
                
                recognition.onresult = (event: SpeechRecognitionEvent) => {
                    let interimTranscript = '';
                    let finalTranscript = '';
                    
                    for (let i = event.resultIndex; i < event.results.length; i++) {
                        const transcript = event.results[i][0].transcript;
                        if (event.results[i].isFinal) {
                            finalTranscript += transcript + ' ';
                        } else {
                            interimTranscript += transcript;
                        }
                    }
                    
                    const base = speechBaseValueRef.current;
                    if (finalTranscript) {
                        setInputValue(base + finalTranscript.trim() + (interimTranscript ? ' ' + interimTranscript : ''));
                        speechBaseValueRef.current = base + finalTranscript.trim() + ' ';
                    } else if (interimTranscript) {
                        setInputValue(base + interimTranscript);
                    }
                };
                
                recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
                    console.error('Speech recognition error:', event.error);
                    setIsListening(false);
                    stream.getTracks().forEach(track => track.stop());
                    
                    if (event.error === 'not-allowed') {
                        setSpeechError('Microphone permission denied. Please enable microphone access.');
                    } else {
                        setSpeechError(`Speech recognition error: ${event.error}`);
                    }
                    setTimeout(() => setSpeechError(null), 3000);
                };
                
                recognition.onend = () => {
                    setIsListening(false);
                    stream.getTracks().forEach(track => track.stop());
                };
                
                recognitionRef.current = recognition;
                recognition.start();
            } else {
                // Fallback: Use MediaRecorder and send to backend
                const mediaRecorder = new MediaRecorder(stream, {
                    mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg'
                });
                mediaRecorderRef.current = mediaRecorder;
                audioChunksRef.current = [];
                
                mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        audioChunksRef.current.push(event.data);
                    }
                };
                
                mediaRecorder.onstop = async () => {
                    const audioBlob = new Blob(audioChunksRef.current, { 
                        type: mediaRecorder.mimeType 
                    });
                    
                    // Send audio to backend for transcription
                    try {
                        const formData = new FormData();
                        formData.append('audio', audioBlob, `recording.${mediaRecorder.mimeType.includes('webm') ? 'webm' : 'ogg'}`);
                        
                        const response = await fetch(getApiUrl('/api/speech-to-text'), {
                            method: 'POST',
                            body: formData,
                        });
                        
                        if (response.ok) {
                            const data = await response.json();
                            const base = speechBaseValueRef.current;
                            setInputValue(base + (base ? ' ' : '') + data.transcript);
                        } else if (response.status === 501) {
                            // Service not configured - show less intrusive message
                            setSpeechError('Firefox voice input requires backend configuration. Please use Chrome or Edge for native voice input, or type your message.');
                            setTimeout(() => setSpeechError(null), 4000);
                        } else {
                            throw new Error('Transcription failed');
                        }
                    } catch (err) {
                        console.error('Error transcribing audio:', err);
                        setSpeechError('Voice input unavailable in Firefox. Please use Chrome/Edge for voice input or type your message.');
                        setTimeout(() => setSpeechError(null), 4000);
                    }
                    
                    // Stop all tracks
                    stream.getTracks().forEach(track => track.stop());
                };
                
                mediaRecorder.start();
                setIsListening(true);
                setSpeechError(null);
                speechBaseValueRef.current = inputRef.current?.value || '';
            }
        } catch (err) {
            console.error('Error accessing microphone:', err);
            setIsListening(false);
            const error = err as DOMException;
            if (error.name === 'NotAllowedError') {
                setSpeechError('Microphone permission denied. Please enable microphone access.');
            } else if (error.name === 'NotFoundError') {
                setSpeechError('No microphone found. Please check your microphone.');
            } else {
                setSpeechError('Failed to access microphone. Please try again.');
            }
            setTimeout(() => setSpeechError(null), 3000);
        }
    };
    
    const stopFirefoxRecording = () => {
        if (recognitionRef.current && isListening) {
            // If using Web Speech API
            recognitionRef.current.stop();
        } else if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            // If using MediaRecorder
            mediaRecorderRef.current.stop();
        }
        
        // Stop any active stream
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        
        setIsListening(false);
    };
    
    const toggleListening = () => {
        if (isFirefoxRef.current) {
            // Firefox path
            if (isListening) {
                stopFirefoxRecording();
            } else {
                startFirefoxRecording();
            }
        } else {
            // Chrome/Edge/Safari path
            if (!recognitionRef.current) return;
            
            if (isListening) {
                recognitionRef.current.stop();
                setIsListening(false);
            } else {
                try {
                    setSpeechError(null);
                    recognitionRef.current.start();
                } catch (err) {
                    console.error('Error starting speech recognition:', err);
                    setSpeechError('Failed to start microphone. Please try again.');
                    setTimeout(() => setSpeechError(null), 3000);
                }
            }
        }
    };

    const handleEndPractice = async () => {
        // Stop the timer immediately
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        
        // Calculate final duration in SECONDS
        // IMPORTANT: This is in SECONDS, not minutes
        const finalDurationSeconds = Math.floor((Date.now() - startTimeRef.current + pausedTimeRef.current) / 1000);
        
        // Save final duration for summary display
        setFinalSessionSeconds(finalDurationSeconds);
        setSessionSeconds(finalDurationSeconds); // Also update current for consistency
        
        // Save session before showing summary
        // IMPORTANT: duration_seconds must be in SECONDS
        if (user && finalDurationSeconds > 0) {
            try {
                console.log(`Saving conversation session: ${finalDurationSeconds} seconds (${(finalDurationSeconds / 60).toFixed(2)} minutes)`);
                await fetch(getApiUrl('/api/sessions'), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        user_id: user.id,
                        deck_id: deckId || null,
                        practice_type: 'conversation',
                        duration_seconds: finalDurationSeconds  // SECONDS, not minutes
                    }),
                });
            } catch (err) {
                console.error('Failed to save session:', err);
            }
        }
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

        // Tooltip handling removed - not currently used
        
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

            const response = await fetch(getApiUrl('/api/practice/conversation'), {
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
        // Use final session seconds if available (summary mode), otherwise use current sessionSeconds
        const elapsed = finalSessionSeconds !== null ? finalSessionSeconds : sessionSeconds;
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
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                                <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                                    ⏱️
                                </span>
                                <span className="text-sm font-medium" style={{ color: 'var(--color-text-subdued)' }}>
                                    {Math.floor(sessionSeconds / 60)}:{(sessionSeconds % 60).toString().padStart(2, '0')}
                                </span>
                            </div>
                            <p className="text-sm" style={{ color: 'var(--color-text-subdued)' }}>
                                {deckData?.title} • {allWordsUsed.size}/{deckData?.count || 0} words
                                {settings && (
                                    <> • {settings.focusMode === 'deck-focused' ? 'Deck focused' : 'Natural'} • {
                                        settings.immersionLevel <= 33 ? 'Minimal' :
                                        settings.immersionLevel <= 66 ? 'Partial' : 'Complete'
                                    } immersion</>
                                )}
                            </p>
                        </div>
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
                <div className="max-w-4xl mx-auto">
                    {/* Speech Error Message */}
                    {speechError && (
                        <div className="mb-2 p-2 rounded text-sm text-center" style={{ backgroundColor: 'var(--color-critical)', color: '#ffffff' }}>
                            {speechError}
                        </div>
                    )}
                    
                    {/* Listening Indicator */}
                    {isListening && (
                        <div className="mb-2 flex items-center justify-center gap-2">
                            <div className="flex items-center gap-2 px-3 py-1 rounded" style={{ backgroundColor: 'var(--color-critical)', color: '#ffffff' }}>
                                <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#ffffff' }}></div>
                                <span className="text-sm font-medium">Listening...</span>
                            </div>
                        </div>
                    )}
                    
                    <div className="flex gap-3">
                        <div className="flex-1 relative">
                            <input
                                ref={inputRef}
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder={isListening ? "Speak now..." : "Type your message..."}
                                disabled={sending || isListening}
                                className="w-full px-4 py-3 rounded transition-all pr-12"
                                style={{
                                    backgroundColor: 'var(--color-bg-tertiary)',
                                    border: isListening ? '2px solid var(--color-critical)' : '1px solid var(--color-border)',
                                    color: 'var(--color-text)',
                                }}
                            />
                            {/* Microphone Button */}
                            {speechSupported && (
                                <button
                                    onClick={toggleListening}
                                    disabled={sending}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded transition-all disabled:opacity-50"
                                    style={{
                                        backgroundColor: isListening ? 'var(--color-critical)' : 'transparent',
                                        color: isListening ? '#ffffff' : 'var(--color-text-subdued)',
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!isListening && !e.currentTarget.disabled) {
                                            e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!isListening && !e.currentTarget.disabled) {
                                            e.currentTarget.style.backgroundColor = 'transparent';
                                        }
                                    }}
                                    title={isListening ? "Stop recording" : "Start voice input"}
                                >
                                    <svg 
                                        xmlns="http://www.w3.org/2000/svg" 
                                        fill="none" 
                                        viewBox="0 0 24 24" 
                                        strokeWidth={2} 
                                        stroke="currentColor" 
                                        className={`w-5 h-5 ${isListening ? 'animate-pulse' : ''}`}
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3Z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                        <line x1="12" y1="19" x2="12" y2="23" />
                                        <line x1="8" y1="23" x2="16" y2="23" />
                                    </svg>
                                </button>
                            )}
                        </div>
                        <button
                            onClick={sendMessage}
                            disabled={!inputValue.trim() || sending || isListening}
                            className="px-6 py-3 rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{
                                backgroundColor: 'var(--color-primary)',
                                color: '#ffffff',
                            }}
                        >
                            Send
                        </button>
                    </div>
                    
                    {/* Browser Support Message */}
                    {!speechSupported && (
                        <p className="text-xs mt-2 text-center" style={{ color: 'var(--color-text-muted)' }}>
                            Voice input not supported in this browser. Please use Chrome, Edge, or Firefox for voice features.
                        </p>
                    )}
                    {speechSupported && isFirefoxRef.current && (
                        <p className="text-xs mt-2 text-center" style={{ color: 'var(--color-text-subdued)' }}>
                            Firefox: Click microphone to start, click again to stop and transcribe.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
