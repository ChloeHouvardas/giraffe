import { useState } from 'react'

interface FileUploadProps {
    accept: string
    label: string
    onFileSelect: (file: File) => void
}

export default function FileUpload({accept, label, onFileSelect}: FileUploadProps) {
    const [fileName, setFileName] = useState<string>('')

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            setFileName(file.name)
            onFileSelect(file)
        }
    }

    return (
        <div className = "w-full">
            <label className="block text-sm font-medium text-text-subdued mb-2">
                {label}
            </label>

            <div className="relative">
                <input
                    type="file"
                    accept={accept}
                    onChange={handleFileChange}
                    className="hidden"
                    id={`file-upload-${label}`}
                />
                <label
                    htmlFor={`file-upload-${label}`}
                    className="flex items-center justify-center w-full px-4 py-3 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary hover:bg-tertiary transition-all"
                    >
                        <div className="text-center">
                            <p className="text-sm text-text-subdued">
                                {fileName || 'Click to upload or drag and drop'}
                            </p>
                        </div>
                </label>
            </div>
        </div>
    )
}

