class CameraManager {
    constructor() {
        this.video = document.getElementById('camera');
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.stream = null;
        this.isInitialized = false;
    }

    async initialize() {
        try {
            // Request camera access with mobile-optimized constraints
            const constraints = {
                video: {
                    facingMode: { ideal: 'environment' }, // Prefer back camera on mobile
                    width: { ideal: 1280, max: 1920 },
                    height: { ideal: 720, max: 1080 }
                },
                audio: false
            };

            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = this.stream;
            
            // Wait for video to load
            await new Promise((resolve) => {
                this.video.onloadedmetadata = () => {
                    resolve();
                };
            });

            this.isInitialized = true;
            console.log('Camera initialized successfully');
            return true;
        } catch (error) {
            console.error('Error accessing camera:', error);
            this.handleCameraError(error);
            return false;
        }
    }

    handleCameraError(error) {
        let errorMessage = 'Camera access failed. ';
        
        switch (error.name) {
            case 'NotAllowedError':
                errorMessage += 'Please allow camera access and refresh the page.';
                break;
            case 'NotFoundError':
                errorMessage += 'No camera found on this device.';
                break;
            case 'NotSupportedError':
                errorMessage += 'Camera not supported in this browser.';
                break;
            default:
                errorMessage += 'Please check your camera and try again.';
        }

        // Show error in the video element area
        this.video.style.display = 'none';
        const errorDiv = document.createElement('div');
        errorDiv.className = 'camera-error';
        errorDiv.innerHTML = `
            <div style="
                background: #ffebee;
                color: #c62828;
                padding: 20px;
                border-radius: 10px;
                text-align: center;
                border: 2px solid #ffcdd2;
            ">
                <h3>📷 Camera Error</h3>
                <p>${errorMessage}</p>
                <button onclick="location.reload()" style="
                    background: #c62828;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 5px;
                    margin-top: 10px;
                    cursor: pointer;
                ">Try Again</button>
            </div>
        `;
        this.video.parentNode.insertBefore(errorDiv, this.video);
    }

    captureImage() {
        if (!this.isInitialized) {
            console.error('Camera not initialized');
            return null;
        }

        try {
            // Optimize canvas size for performance
            const maxWidth = 1024; // Max width for analysis
            const maxHeight = 768; // Max height for analysis
            
            let width = this.video.videoWidth;
            let height = this.video.videoHeight;
            
            // Scale down if needed to reduce image size
            if (width > maxWidth || height > maxHeight) {
                const aspectRatio = width / height;
                if (width > height) {
                    width = maxWidth;
                    height = maxWidth / aspectRatio;
                } else {
                    height = maxHeight;
                    width = maxHeight * aspectRatio;
                }
            }
            
            // Set optimized canvas dimensions
            this.canvas.width = width;
            this.canvas.height = height;

            // Draw current video frame to canvas with optimized size
            this.ctx.drawImage(this.video, 0, 0, width, height);

            // Convert to base64 with reduced quality for faster upload
            const imageData = this.canvas.toDataURL('image/jpeg', 0.7);
            console.log('Image captured successfully', `${width}x${height}`);
            return imageData;
        } catch (error) {
            console.error('Error capturing image:', error);
            return null;
        }
    }

    // Pause video stream to save resources
    pauseStream() {
        if (this.stream) {
            this.stream.getVideoTracks().forEach(track => {
                track.enabled = false;
            });
            this.video.style.opacity = '0.5';
        }
    }

    // Resume video stream
    resumeStream() {
        if (this.stream) {
            this.stream.getVideoTracks().forEach(track => {
                track.enabled = true;
            });
            this.video.style.opacity = '1';
        }
    }

    // Switch between front and back camera (if available)
    async switchCamera() {
        if (!this.isInitialized) return false;

        try {
            // Stop current stream
            this.stream.getTracks().forEach(track => track.stop());

            // Get current facing mode
            const currentTrack = this.stream.getVideoTracks()[0];
            const settings = currentTrack.getSettings();
            const currentFacingMode = settings.facingMode;

            // Switch to opposite camera
            const newFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';

            const constraints = {
                video: {
                    facingMode: { exact: newFacingMode },
                    width: { ideal: 1280, max: 1920 },
                    height: { ideal: 720, max: 1080 }
                },
                audio: false
            };

            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = this.stream;

            return true;
        } catch (error) {
            console.error('Error switching camera:', error);
            // Fallback to original camera
            await this.initialize();
            return false;
        }
    }

    // Clean up resources
    destroy() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        this.isInitialized = false;
    }

    // Check if camera is supported
    static isSupported() {
        return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    }

    // Get available cameras
    static async getAvailableCameras() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            return devices.filter(device => device.kind === 'videoinput');
        } catch (error) {
            console.error('Error getting available cameras:', error);
            return [];
        }
    }
}

// Export for use in other modules
window.CameraManager = CameraManager;
