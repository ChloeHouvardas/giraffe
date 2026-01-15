interface TextAreaProps {
    label: string
    placeholder: string
    value: string
    onChange: (value: string) => void
    rows?: number
}

export default function TextArea({
    label,
    placeholder,
    value,
    onChange,
    rows = 6
}: TextAreaProps) {
    return (
        <div className="w-full">
            <label className="block text-sm font-medium mb-3" style={{ color: 'var(--color-text-subdued)' }}>
                {label}
            </label>
            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                rows={rows}
                className="w-full px-4 py-3 rounded-md resize-none transition-all"
                style={{
                    backgroundColor: 'var(--color-bg-secondary)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text)',
                    fontFamily: 'var(--font-body)',
                }}
                onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-primary)';
                    e.currentTarget.style.boxShadow = '0 0 0 2px rgba(139, 64, 73, 0.2)';
                }}
                onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-border)';
                    e.currentTarget.style.boxShadow = 'none';
                }}
            />
        </div>
    )
}
