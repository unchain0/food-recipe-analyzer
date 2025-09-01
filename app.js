class FoodAnalyzerApp {
    constructor() {
        this.cameraManager = new CameraManager();
        this.groqAPI = new GroqAPI();
        this.isAnalyzing = false;
        
        this.initializeElements();
        this.setupEventListeners();
        this.checkApiKeyAndInitialize();
    }

    initializeElements() {
        // Main UI elements
        this.analyzeBtn = document.getElementById('analyze-btn');
        this.loadingSection = document.getElementById('loading');
        this.resultsSection = document.getElementById('results');
        this.apiSetupSection = document.getElementById('api-setup');
        
        // Results elements
        this.foodDetectedEl = document.getElementById('food-detected');
        this.audioPlayer = document.getElementById('audio-player');
        this.recipeButtons = document.querySelectorAll('.recipe-btn');
        
        // Modal elements
        this.modal = document.getElementById('recipe-modal');
        this.modalContent = document.getElementById('recipe-detail');
        this.closeModal = document.querySelector('.close');
        
        // API setup elements
        this.apiKeyInput = document.getElementById('groq-api-key');
        this.saveApiKeyBtn = document.getElementById('save-api-key');
    }

    setupEventListeners() {
        // Analyze button
        this.analyzeBtn.addEventListener('click', () => this.analyzeFood());
        
        // Recipe buttons
        this.recipeButtons.forEach((btn, index) => {
            btn.addEventListener('click', () => this.showRecipe(index));
        });
        
        // Modal close
        this.closeModal.addEventListener('click', () => this.hideModal());
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.hideModal();
        });
        
        // API key setup
        this.saveApiKeyBtn.addEventListener('click', () => this.saveApiKey());
        this.apiKeyInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.saveApiKey();
        });
        
        // Handle page visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                // Pause camera when page is hidden
                this.pauseCamera();
            } else {
                // Resume camera when page is visible
                this.resumeCamera();
            }
        });
    }

    async checkApiKeyAndInitialize() {
        if (this.groqAPI.isConfigured()) {
            this.hideApiSetup();
            await this.initializeCamera();
        } else {
            this.showApiSetup();
        }
    }

    showApiSetup() {
        this.apiSetupSection.classList.remove('hidden');
        this.analyzeBtn.disabled = true;
        this.analyzeBtn.textContent = '🔑 Enter API Key First';
    }

    hideApiSetup() {
        this.apiSetupSection.classList.add('hidden');
        this.analyzeBtn.disabled = false;
        this.analyzeBtn.textContent = '📸 Analyze Food';
    }

    async saveApiKey() {
        const apiKey = this.apiKeyInput.value.trim();
        if (!apiKey) {
            this.showError('Please enter a valid API key');
            return;
        }

        try {
            // Show loading state
            this.saveApiKeyBtn.textContent = 'Testing...';
            this.saveApiKeyBtn.disabled = true;

            // Set and test the API key
            this.groqAPI.setApiKey(apiKey);
            await this.groqAPI.testConnection();

            // Success
            this.showSuccess('API key saved successfully!');
            this.hideApiSetup();
            await this.initializeCamera();
            
        } catch (error) {
            this.showError(`API key test failed: ${error.message}`);
            this.groqAPI.clearApiKey();
        } finally {
            this.saveApiKeyBtn.textContent = 'Save';
            this.saveApiKeyBtn.disabled = false;
        }
    }

    async initializeCamera() {
        if (!CameraManager.isSupported()) {
            this.showError('Camera not supported in this browser');
            return;
        }

        try {
            const success = await this.cameraManager.initialize();
            if (success) {
                this.analyzeBtn.disabled = false;
                console.log('App initialized successfully');
            }
        } catch (error) {
            console.error('Failed to initialize camera:', error);
        }
    }

    async analyzeFood() {
        if (this.isAnalyzing) return;

        try {
            this.isAnalyzing = true;
            this.showLoading();

            // Capture image from camera
            const imageData = this.cameraManager.captureImage();
            if (!imageData) {
                throw new Error('Failed to capture image from camera');
            }

            // Analyze food with Groq Vision
            const analysis = await this.groqAPI.analyzeFood(imageData);
            
            // Generate voice description
            const audioBlob = await this.groqAPI.generateVoiceDescription(
                analysis.foodDetected, 
                analysis.recipes
            );

            // Display results
            this.showResults(analysis, audioBlob);

        } catch (error) {
            console.error('Analysis failed:', error);
            this.showError(`Analysis failed: ${error.message}`);
            this.hideLoading();
        } finally {
            this.isAnalyzing = false;
        }
    }

    showLoading() {
        this.loadingSection.classList.remove('hidden');
        this.resultsSection.classList.add('hidden');
        this.analyzeBtn.disabled = true;
        this.analyzeBtn.textContent = '🔄 Analyzing...';
    }

    hideLoading() {
        this.loadingSection.classList.add('hidden');
        this.analyzeBtn.disabled = false;
        this.analyzeBtn.textContent = '📸 Analyze Food';
    }

    showResults(analysis, audioBlob) {
        this.hideLoading();
        
        // Show food detected
        this.foodDetectedEl.textContent = analysis.foodDetected;
        
        // Setup audio player
        const audioUrl = URL.createObjectURL(audioBlob);
        this.audioPlayer.src = audioUrl;
        
        // Update recipe button labels
        this.recipeButtons.forEach((btn, index) => {
            if (analysis.recipes[index]) {
                btn.textContent = analysis.recipes[index].name;
                btn.disabled = false;
            } else {
                btn.style.display = 'none';
            }
        });
        
        // Show results section
        this.resultsSection.classList.remove('hidden');
        
        // Auto-play audio (with user gesture requirement handling)
        this.audioPlayer.play().catch(error => {
            console.log('Auto-play prevented, user interaction required:', error);
        });
    }

    showRecipe(index) {
        const recipe = this.groqAPI.getRecipe(index);
        if (!recipe) return;

        this.modalContent.innerHTML = this.groqAPI.formatRecipeForDisplay(recipe);
        this.modal.classList.remove('hidden');
        
        // Prevent body scroll when modal is open
        document.body.style.overflow = 'hidden';
    }

    hideModal() {
        this.modal.classList.add('hidden');
        document.body.style.overflow = '';
    }

    showError(message) {
        // Create or update error message
        let errorEl = document.getElementById('error-message');
        if (!errorEl) {
            errorEl = document.createElement('div');
            errorEl.id = 'error-message';
            errorEl.style.cssText = `
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: #f44336;
                color: white;
                padding: 15px 20px;
                border-radius: 10px;
                z-index: 1001;
                max-width: 90%;
                text-align: center;
                box-shadow: 0 4px 12px rgba(244, 67, 54, 0.3);
            `;
            document.body.appendChild(errorEl);
        }
        
        errorEl.textContent = message;
        errorEl.style.display = 'block';
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            if (errorEl) {
                errorEl.style.display = 'none';
            }
        }, 5000);
    }

    showSuccess(message) {
        // Create or update success message
        let successEl = document.getElementById('success-message');
        if (!successEl) {
            successEl = document.createElement('div');
            successEl.id = 'success-message';
            successEl.style.cssText = `
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: #4caf50;
                color: white;
                padding: 15px 20px;
                border-radius: 10px;
                z-index: 1001;
                max-width: 90%;
                text-align: center;
                box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
            `;
            document.body.appendChild(successEl);
        }
        
        successEl.textContent = message;
        successEl.style.display = 'block';
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            if (successEl) {
                successEl.style.display = 'none';
            }
        }, 3000);
    }

    pauseCamera() {
        // Pause video stream to save resources
        if (this.cameraManager.stream) {
            this.cameraManager.stream.getVideoTracks().forEach(track => {
                track.enabled = false;
            });
        }
    }

    resumeCamera() {
        // Resume video stream
        if (this.cameraManager.stream) {
            this.cameraManager.stream.getVideoTracks().forEach(track => {
                track.enabled = true;
            });
        }
    }

    // Clean up resources when page unloads
    destroy() {
        this.cameraManager.destroy();
        
        // Revoke any object URLs to free memory
        if (this.audioPlayer.src) {
            URL.revokeObjectURL(this.audioPlayer.src);
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new FoodAnalyzerApp();
});

// Clean up when page unloads
window.addEventListener('beforeunload', () => {
    if (window.app) {
        window.app.destroy();
    }
});
