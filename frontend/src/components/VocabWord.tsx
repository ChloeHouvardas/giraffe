import { useState, useRef, useEffect } from 'react';

interface VocabWordProps {
    word: string;
    definition: string;
    type: 'vocab' | 'unknown';
    onExplain: (word: string) => void;
}

export default function VocabWord({ word, definition, type, onExplain }: VocabWordProps) {
    const [tooltipVisible, setTooltipVisible] = useState(false);
    const [isHovering, setIsHovering] = useState(false);
    const timeoutRef = useRef<number | null>(null);
    const containerRef = useRef<HTMLSpanElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);

    const handleMouseEnter = () => {
        // Clear any existing timeout
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        setIsHovering(true);
        // Show tooltip immediately when hovering over word
        setTooltipVisible(true);
    };

    const handleMouseLeave = () => {
        setIsHovering(false);
        
        // Add delay before hiding tooltip to give user time to move to tooltip
        timeoutRef.current = setTimeout(() => {
            if (!isHovering) {
                setTooltipVisible(false);
            }
        }, 200); // 200ms delay
    };

    const handleTooltipEnter = () => {
        // Clear timeout when hovering over tooltip
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        setIsHovering(true);
        setTooltipVisible(true);
    };

    const handleTooltipLeave = () => {
        setIsHovering(false);
        // Hide tooltip when leaving tooltip area
        setTooltipVisible(false);
    };

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    // Calculate tooltip position
    useEffect(() => {
        if (tooltipVisible && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            if (tooltipRef.current) {
                tooltipRef.current.style.left = `${rect.left + rect.width / 2}px`;
                tooltipRef.current.style.top = `${rect.top - 10}px`;
            }
        }
    }, [tooltipVisible]);

    const vocabStyle: React.CSSProperties = {
        backgroundColor: type === 'vocab' ? 'rgba(254, 243, 199, 0.8)' : 'rgba(219, 234, 254, 0.8)',
        padding: '2px 4px',
        borderRadius: '4px',
        cursor: 'pointer',
        borderBottom: `2px dotted ${type === 'vocab' ? '#FBBF24' : '#3B82F6'}`,
        fontWeight: 600,
        color: type === 'vocab' ? '#92400E' : '#1E40AF',
        position: 'relative',
        display: 'inline',
    };

    const tooltipStyle: React.CSSProperties = {
        position: 'fixed',
        transform: 'translate(-50%, -100%)',
        backgroundColor: '#ffffff',
        border: '1px solid #E5E7EB',
        borderRadius: '8px',
        padding: '12px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        zIndex: 1000,
        minWidth: '200px',
        maxWidth: '300px',
        marginBottom: '8px',
        pointerEvents: 'auto', // CRITICAL: Keep tooltip interactive
    };

    // Invisible bridge area to prevent hover break
    const bridgeStyle: React.CSSProperties = {
        position: 'absolute',
        top: '100%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        height: '8px',
        background: 'transparent',
        pointerEvents: 'auto',
    };

    return (
        <span
            ref={containerRef}
            style={{ position: 'relative', display: 'inline-block' }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <span style={vocabStyle}>
                {word}
            </span>
            
            {tooltipVisible && (
                <>
                    {/* Invisible bridge area between word and tooltip */}
                    <div style={bridgeStyle} onMouseEnter={handleTooltipEnter} />
                    
                    <div
                        ref={tooltipRef}
                        style={tooltipStyle}
                        onMouseEnter={handleTooltipEnter}
                        onMouseLeave={handleTooltipLeave}
                    >
                        <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '4px', color: '#111827' }}>
                            {word}
                        </div>
                        <div style={{ color: '#6B7280', fontSize: '0.9rem', marginBottom: '6px' }}>
                            {definition}
                        </div>
                        <button
                            onClick={() => {
                                onExplain(word);
                                setTooltipVisible(false);
                            }}
                            style={{
                                marginTop: '8px',
                                width: '100%',
                                padding: '6px 12px',
                                backgroundColor: 'var(--color-primary)',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'background-color 0.2s',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--color-primary-light)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--color-primary)';
                            }}
                        >
                            💬 Explain this word in chat
                        </button>
                        {/* Arrow pointing down */}
                        <div
                            style={{
                                position: 'absolute',
                                top: '100%',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                border: '6px solid transparent',
                                borderTopColor: '#ffffff',
                            }}
                        />
                    </div>
                </>
            )}
        </span>
    );
}
