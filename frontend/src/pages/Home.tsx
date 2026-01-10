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

                <div className="flex flex-row gap-20 mt-8 max-w-4xl mx-auto items-stretch">
                    <div className="flex-1 flex flex-col">
                        <TextArea
                            label="Enter your text here"
                            placeholder="Type something..."
                            value={textContent}
                            onChange={setTextContent}
                        />
                    </div>

                    <div className="flex flex-col justify-center text-text-subdued">
                        OR
                    </div>

                    <div className="flex-1 flex flex-col">
                        <FileUpload
                            accept="image/png, image/jpeg"
                            label="Upload an image"
                            onFileSelect={setUploadedFile}
                        />
                    </div>
                </div>
                


            </div>
        </div>
        
    )
}
