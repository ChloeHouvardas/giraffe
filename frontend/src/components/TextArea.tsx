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
    // function handleSubmit(e: React.FormEvent) {
    //     // Prevents browser from reloading the page
    //     // TODO see if I need this later
    //     e.preventDefault();

    //     const form = e.target as HTMLFormElement;
    //     const formData = new FormData(form);

    //     fetch('http://localhost:8000/api/generate-flashcards', { method: form.method, body: formData });
    // }
    


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
                {/* <button type="submit" className="mt-3 px-4 py-2 bg-primary text-white font-medium rounded-md hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 transition-colors">Generate Cards</button> */}
            
        </div>
    )
}
