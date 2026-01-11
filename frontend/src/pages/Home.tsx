import FlashcardGenerator from "../components/FlashCardGenerator";

export default function Home() {
    return (
        <div className = "min-h-screen flex items-center justify-center p-6">
            <div className="text-center">
                <h1 className="text-display text-text mb-4">
                    Welcome to Giraffe!
                </h1>
                <p className="text-lg text-text-subdued">
                    Let's get learning
                </p>

                <FlashcardGenerator />
            </div>
        </div>
        
    )
}
