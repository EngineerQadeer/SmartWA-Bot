const { GoogleGenerativeAI } = require("@google/generative-ai");
const setting = require("./key.json");

async function listModels() {
    const genAI = new GoogleGenerativeAI(setting.keygemini);
    try {
        // There isn't a direct listModels method in the high-level SDK easily accessible 
        // without looking at the docs deeply, but we can try a standard model 
        // or use the model.getGenerativeModel to test.
        // Actually, the error message suggested: "Call ListModels to see the list"
        // The SDK might not expose it directly on the client instance in this version.

        // Let's try to just test a few common ones and see which one doesn't throw 404 immediately
        const models = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-pro", "gemini-1.0-pro", "gemini-1.5-flash-001", "gemini-1.5-pro-001"];

        console.log("Testing models...");
        for (const modelName of models) {
            try {
                const model = genAI.getGenerativeModel({ model: modelName });
                const result = await model.generateContent("Hello");
                console.log(`✅ ${modelName} is WORKING`);
                break; // Found one!
            } catch (error) {
                if (error.message.includes("404")) {
                    console.log(`❌ ${modelName} not found`);
                } else {
                    console.log(`⚠️ ${modelName} error: ${error.message}`);
                }
            }
        }
    } catch (error) {
        console.error("Error:", error);
    }
}

listModels();
