import TextArea from "../components/TextArea";
import FileUpload from "../components/FileUpload";
import {useState} from "react";

export default function Home() {
    const [textContent, setTextContent] = useState<string>('');
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    return (
        <div className = "min-h-screen flex items-center justify-center">
            <div className="text-center">
                <h1 className="text-display text-text mb-4">
                    Welcome to Giraffe!
                </h1>
                <p className="text-lg text-text-subdued">
                    Let's get learning
                </p>
                <div className="mt-8 max-w-md mx-auto">
                    <TextArea
                        label="Enter your text here"
                        placeholder="Type something..."
                        value={textContent}
                        onChange={setTextContent}
                    />
                    <FileUpload
                        accept="image/png, image/jpeg"
                        label="Upload an image"
                        onFileSelect={setUploadedFile}
                    />
                </div>
            </div>
        </div>
        
    )
}
