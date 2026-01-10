import TextArea from "../components/TextArea";

export default function Home() {
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
                        value=""
                        onChange={(value) => console.log(value)}
                    />
                </div>
            </div>
        </div>
        
    )
}
