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
        
        // Language selector
        this.languageSelect = document.getElementById('language-select');
        
        // New feature elements
        this.switchCameraBtn = document.getElementById('switch-camera-btn');
        this.uploadBtn = document.getElementById('upload-btn');
        this.fileUpload = document.getElementById('file-upload');
        this.historyBtn = document.getElementById('history-btn');
        this.historyModal = document.getElementById('history-modal');
        this.closeHistoryBtn = document.querySelector('.close-history');
        this.historyList = document.getElementById('history-list');
        this.clearHistoryBtn = document.getElementById('clear-history-btn');
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
        
        // Language selector
        this.languageSelect.addEventListener('change', (e) => {
            this.groqAPI.setLanguage(e.target.value);
            this.showSuccess('Language updated! Your next analysis will be in ' + e.target.options[e.target.selectedIndex].text);
        });
        
        // Switch camera button
        this.switchCameraBtn.addEventListener('click', () => this.switchCamera());
        
        // Upload button
        this.uploadBtn.addEventListener('click', () => this.fileUpload.click());
        this.fileUpload.addEventListener('change', (e) => this.handleFileUpload(e));
        
        // History button
        this.historyBtn.addEventListener('click', () => this.showHistory());
        this.closeHistoryBtn.addEventListener('click', () => this.hideHistory());
        this.historyModal.addEventListener('click', (e) => {
            if (e.target === this.historyModal) this.hideHistory();
        });
        this.clearHistoryBtn.addEventListener('click', () => this.clearHistory());
        
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
        // Set language selector to detected language
        const currentLang = this.groqAPI.getLanguage();
        this.languageSelect.value = currentLang;
        
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

            // Pause camera stream to free resources during analysis
            this.cameraManager.pauseStream();

            // Capture image from camera
            const imageData = this.cameraManager.captureImage();
            if (!imageData) {
                throw new Error('Failed to capture image from camera');
            }

            // Analyze food with Groq Vision
            const analysis = await this.groqAPI.analyzeFood(imageData);
            
            // Try to generate voice description (optional)
            let audioBlob = null;
            try {
                audioBlob = await this.groqAPI.generateVoiceDescription(
                    analysis.foodDetected, 
                    analysis.recipes
                );
            } catch (audioError) {
                console.warn('Voice generation failed, continuing without audio:', audioError);
                // Continue without audio - it's not critical
            }

            // Save to history
            this.saveToHistory(analysis);
            
            // Display results
            this.showResults(analysis, audioBlob);

        } catch (error) {
            console.error('Analysis failed:', error);
            this.showError(`Analysis failed: ${error.message}`);
            this.hideLoading();
            // Resume camera on error
            this.cameraManager.resumeStream();
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
        
        // Resume camera stream when loading is done
        this.cameraManager.resumeStream();
    }

    showResults(analysis, audioBlob) {
        this.hideLoading();
        
        // Show food detected
        this.foodDetectedEl.textContent = analysis.foodDetected;
        
        // Setup audio player if audio is available
        if (audioBlob) {
            const audioUrl = URL.createObjectURL(audioBlob);
            this.audioPlayer.src = audioUrl;
            this.audioPlayer.parentElement.style.display = 'block';
            
            // Auto-play audio (with user gesture requirement handling)
            this.audioPlayer.play().catch(error => {
                console.log('Auto-play prevented, user interaction required:', error);
            });
        } else {
            // Hide audio player if no audio available
            this.audioPlayer.parentElement.style.display = 'none';
        }
        
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
        this.cameraManager.pauseStream();
    }

    resumeCamera() {
        // Resume video stream
        this.cameraManager.resumeStream();
    }

    // Switch camera (front/back)
    async switchCamera() {
        try {
            this.switchCameraBtn.disabled = true;
            this.switchCameraBtn.textContent = '🔄 Switching...';
            
            const success = await this.cameraManager.switchCamera();
            
            if (success) {
                this.showSuccess('Camera switched successfully!');
            } else {
                this.showError('Failed to switch camera');
            }
        } catch (error) {
            console.error('Error switching camera:', error);
            this.showError('Failed to switch camera');
        } finally {
            this.switchCameraBtn.disabled = false;
            this.switchCameraBtn.textContent = '🔄 Switch';
        }
    }

    // Handle file upload from gallery
    async handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            this.showError('Please select a valid image file');
            return;
        }

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            this.showError('Image is too large. Please select an image under 10MB');
            return;
        }

        try {
            this.isAnalyzing = true;
            this.showLoading();

            // Convert file to base64
            const reader = new FileReader();
            const imageData = await new Promise((resolve, reject) => {
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            // Analyze food with Groq Vision
            const analysis = await this.groqAPI.analyzeFood(imageData);
            
            // Try to generate voice description (optional)
            let audioBlob = null;
            try {
                audioBlob = await this.groqAPI.generateVoiceDescription(
                    analysis.foodDetected, 
                    analysis.recipes
                );
            } catch (audioError) {
                console.warn('Voice generation failed, continuing without audio:', audioError);
            }

            // Save to history
            this.saveToHistory(analysis);
            
            // Display results
            this.showResults(analysis, audioBlob);

        } catch (error) {
            console.error('Analysis failed:', error);
            this.showError(`Analysis failed: ${error.message}`);
            this.hideLoading();
        } finally {
            this.isAnalyzing = false;
            // Clear file input
            event.target.value = '';
        }
    }

    // Save analysis to history
    saveToHistory(analysis) {
        try {
            const history = this.getHistory();
            
            const historyItem = {
                id: Date.now(),
                timestamp: new Date().toISOString(),
                foodDetected: analysis.foodDetected,
                recipes: analysis.recipes
            };
            
            // Add to beginning of array
            history.unshift(historyItem);
            
            // Keep only last 10 items
            const trimmedHistory = history.slice(0, 10);
            
            localStorage.setItem('analysis_history', JSON.stringify(trimmedHistory));
        } catch (error) {
            console.warn('Failed to save to history:', error);
        }
    }

    // Get history from localStorage
    getHistory() {
        try {
            const history = localStorage.getItem('analysis_history');
            return history ? JSON.parse(history) : [];
        } catch (error) {
            console.warn('Failed to load history:', error);
            return [];
        }
    }

    // Show history modal
    showHistory() {
        const history = this.getHistory();
        
        if (history.length === 0) {
            this.historyList.innerHTML = `
                <div class="history-empty">
                    <div class="history-empty-icon">📭</div>
                    <p>No analysis history yet</p>
                    <p style="font-size: var(--font-size-sm); margin-top: var(--space-2);">Start analyzing food to build your history!</p>
                </div>
            `;
        } else {
            this.historyList.innerHTML = history.map(item => {
                const date = new Date(item.timestamp);
                const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                
                return `
                    <div class="history-item" data-history-id="${item.id}">
                        <div class="history-item-header">
                            <div class="history-item-food">${item.foodDetected}</div>
                            <div class="history-item-date">${dateStr}</div>
                        </div>
                        <div class="history-item-recipes">
                            ${item.recipes.map(recipe => 
                                `<span class="history-recipe-tag">${recipe.name}</span>`
                            ).join('')}
                        </div>
                    </div>
                `;
            }).join('');
            
            // Add click handlers to history items
            document.querySelectorAll('.history-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    const id = parseInt(e.currentTarget.dataset.historyId);
                    this.loadHistoryItem(id);
                });
            });
        }
        
        this.historyModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    // Hide history modal
    hideHistory() {
        this.historyModal.classList.add('hidden');
        document.body.style.overflow = '';
    }

    // Load a history item
    loadHistoryItem(id) {
        const history = this.getHistory();
        const item = history.find(h => h.id === id);
        
        if (item) {
            this.groqAPI.recipes = item.recipes;
            this.hideHistory();
            
            // Display without audio (loading from history)
            this.foodDetectedEl.textContent = item.foodDetected;
            this.audioPlayer.parentElement.style.display = 'none';
            
            this.recipeButtons.forEach((btn, index) => {
                if (item.recipes[index]) {
                    btn.textContent = item.recipes[index].name;
                    btn.disabled = false;
                } else {
                    btn.style.display = 'none';
                }
            });
            
            this.resultsSection.classList.remove('hidden');
            this.showSuccess('Loaded from history!');
        }
    }

    // Clear all history
    clearHistory() {
        if (confirm('Are you sure you want to clear all analysis history? This cannot be undone.')) {
            try {
                localStorage.removeItem('analysis_history');
                this.hideHistory();
                this.showSuccess('History cleared successfully!');
            } catch (error) {
                this.showError('Failed to clear history');
            }
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
