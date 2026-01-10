interface TextAreaProps {
    label: string
    placeholder: string
    value: string
    onChange: (value: string) => void
    rows?: number
}

// For now only accept images
// TODO maybe add videos and other file types down the road 
export default function TextArea({
    label,
    placeholder,
    value,
    onChange,
    rows = 6
}: TextAreaProps) {
    return (
        <div className="w-full">
            <label className="block text-sm font-medium text-text-subdued mb-2">
                {label}
            </label>
            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                rows={rows}
                className="w-full px-3 py-2 border border-border-default rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary resize-none"
            />
        </div>
    )
}
