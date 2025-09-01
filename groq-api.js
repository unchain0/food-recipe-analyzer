class GroqAPI {
    constructor() {
        this.apiKey = null;
        this.baseUrl = 'https://api.groq.com/openai/v1';
        this.visionModel = 'meta-llama/llama-4-scout-17b-16e-instruct';
        this.ttsModel = 'playai-tts';
        this.voice = 'Fritz-PlayAI';
        this.recipes = [];
    }

    setApiKey(apiKey) {
        this.apiKey = apiKey;
        // Store in localStorage for persistence across all devices and browsers
        try {
            localStorage.setItem('groq_api_key', apiKey);
            // Also store with timestamp for potential expiration management
            localStorage.setItem('groq_api_key_timestamp', Date.now().toString());
        } catch (error) {
            console.warn('Failed to save API key to localStorage:', error);
            // Fallback to sessionStorage if localStorage is not available
            try {
                sessionStorage.setItem('groq_api_key', apiKey);
                sessionStorage.setItem('groq_api_key_timestamp', Date.now().toString());
            } catch (sessionError) {
                console.error('Failed to save API key to any storage:', sessionError);
            }
        }
    }

    getApiKey() {
        if (!this.apiKey) {
            try {
                // Try localStorage first
                this.apiKey = localStorage.getItem('groq_api_key');
                // Fallback to sessionStorage if localStorage fails
                if (!this.apiKey) {
                    this.apiKey = sessionStorage.getItem('groq_api_key');
                }
            } catch (error) {
                console.warn('Failed to retrieve API key from storage:', error);
                this.apiKey = null;
            }
        }
        return this.apiKey;
    }

    isConfigured() {
        const apiKey = this.getApiKey();
        return !!(apiKey && apiKey.trim().length > 0);
    }

    async analyzeFood(imageData) {
        if (!this.isConfigured()) {
            throw new Error('API key not configured');
        }

        try {
            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.getApiKey()}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: this.visionModel,
                    messages: [
                        {
                            role: 'user',
                            content: [
                                {
                                    type: 'text',
                                    text: `Analyze this image and identify what food items you can see. Then provide exactly 3 different recipe suggestions that can be made with these ingredients. 

Format your response as JSON with this exact structure:
{
  "foodDetected": "Brief description of the food items you see",
  "recipes": [
    {
      "name": "Recipe Name 1",
      "description": "Brief description of the recipe",
      "ingredients": ["ingredient1", "ingredient2", "ingredient3"],
      "instructions": ["step1", "step2", "step3"],
      "cookingTime": "X minutes",
      "difficulty": "Easy/Medium/Hard"
    },
    {
      "name": "Recipe Name 2", 
      "description": "Brief description of the recipe",
      "ingredients": ["ingredient1", "ingredient2", "ingredient3"],
      "instructions": ["step1", "step2", "step3"],
      "cookingTime": "X minutes",
      "difficulty": "Easy/Medium/Hard"
    },
    {
      "name": "Recipe Name 3",
      "description": "Brief description of the recipe", 
      "ingredients": ["ingredient1", "ingredient2", "ingredient3"],
      "instructions": ["step1", "step2", "step3"],
      "cookingTime": "X minutes",
      "difficulty": "Easy/Medium/Hard"
    }
  ]
}`
                                },
                                {
                                    type: 'image_url',
                                    image_url: {
                                        url: imageData
                                    }
                                }
                            ]
                        }
                    ],
                    temperature: 0.7,
                    max_completion_tokens: 2000,
                    top_p: 1,
                    stream: false
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`Vision API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
            }

            const data = await response.json();
            const content = data.choices[0].message.content;
            
            // Parse JSON response
            const analysisResult = JSON.parse(content);
            this.recipes = analysisResult.recipes;
            
            return analysisResult;
        } catch (error) {
            console.error('Error analyzing food:', error);
            throw error;
        }
    }

    async generateVoiceDescription(foodDetected, recipes) {
        if (!this.isConfigured()) {
            throw new Error('API key not configured');
        }

        try {
            // Create a natural description of the food and recipes
            const description = `I can see ${foodDetected}. Here are three delicious recipes you can make: 
            
            First, ${recipes[0].name} - ${recipes[0].description}. This is a ${recipes[0].difficulty.toLowerCase()} recipe that takes about ${recipes[0].cookingTime}.
            
            Second, ${recipes[1].name} - ${recipes[1].description}. This ${recipes[1].difficulty.toLowerCase()} dish takes ${recipes[1].cookingTime} to prepare.
            
            Finally, ${recipes[2].name} - ${recipes[2].description}. This ${recipes[2].difficulty.toLowerCase()} recipe can be ready in ${recipes[2].cookingTime}.
            
            Choose any recipe button below to see the full instructions!`;

            const response = await fetch(`${this.baseUrl}/audio/speech`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.getApiKey()}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: this.ttsModel,
                    voice: this.voice,
                    input: description,
                    response_format: 'wav'
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`TTS API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
            }

            // Return the audio blob
            const audioBlob = await response.blob();
            return audioBlob;
        } catch (error) {
            console.error('Error generating voice:', error);
            throw error;
        }
    }

    getRecipe(index) {
        if (index >= 0 && index < this.recipes.length) {
            return this.recipes[index];
        }
        return null;
    }

    // Format recipe for display
    formatRecipeForDisplay(recipe) {
        if (!recipe) return '';

        return `
            <h3>${recipe.name}</h3>
            <p><strong>Description:</strong> ${recipe.description}</p>
            <p><strong>Difficulty:</strong> ${recipe.difficulty}</p>
            <p><strong>Cooking Time:</strong> ${recipe.cookingTime}</p>
            
            <h4>Ingredients:</h4>
            <ul>
                ${recipe.ingredients.map(ingredient => `<li>${ingredient}</li>`).join('')}
            </ul>
            
            <h4>Instructions:</h4>
            <ol>
                ${recipe.instructions.map(instruction => `<li>${instruction}</li>`).join('')}
            </ol>
        `;
    }

    // Test API connection
    async testConnection() {
        if (!this.isConfigured()) {
            throw new Error('API key not configured');
        }

        try {
            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.getApiKey()}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: this.visionModel,
                    messages: [
                        {
                            role: 'user',
                            content: 'Hello, this is a test message.'
                        }
                    ],
                    max_completion_tokens: 10
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`API test failed: ${response.status} - ${errorData.error?.message || 'Invalid API key'}`);
            }

            return true;
        } catch (error) {
            console.error('API connection test failed:', error);
            throw error;
        }
    }

    // Clear stored API key
    clearApiKey() {
        this.apiKey = null;
        localStorage.removeItem('groq_api_key');
    }
}

// Export for use in other modules
window.GroqAPI = GroqAPI;
