
        let selectedFiles = [];
        let convertedFiles = [];

        const fileInput = document.getElementById('fileInput');
        const uploadArea = document.getElementById('uploadArea');
        const filesContainer = document.getElementById('filesContainer');
        const filesList = document.getElementById('filesList');
        const filesCount = document.getElementById('filesCount');
        const convertBtn = document.getElementById('convertBtn');
        const downloadAllBtn = document.getElementById('downloadAllBtn');
        const downloadZipBtn = document.getElementById('downloadZipBtn');

        // Initialize
        document.addEventListener('DOMContentLoaded', () => {
            initializeEventListeners();
            updateQualityPreview();
        });

        function initializeEventListeners() {
            // Upload events
            uploadArea.addEventListener('click', () => fileInput.click());
            uploadArea.addEventListener('dragover', handleDragOver);
            uploadArea.addEventListener('dragleave', handleDragLeave);
            uploadArea.addEventListener('drop', handleDrop);
            fileInput.addEventListener('change', (e) => handleFiles(Array.from(e.target.files)));

            // Quality preview update
            document.getElementById('quality').addEventListener('change', updateQualityPreview);

            // Prevent default drag behaviors
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                document.addEventListener(eventName, preventDefaults, false);
            });
        }

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        function handleDragOver(e) {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        }

        function handleDragLeave() {
            uploadArea.classList.remove('dragover');
        }

        function handleDrop(e) {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const files = Array.from(e.dataTransfer.files).filter(file => 
                file.type === 'image/png' && file.size <= 50 * 1024 * 1024 // 50MB limit
            );
            
            if (files.length === 0) {
                showToast('Please select valid PNG files under 50MB', 'error');
                return;
            }
            
            handleFiles(files);
        }

        function handleFiles(files) {
            const validFiles = files.filter(file => {
                const isDuplicate = selectedFiles.find(f => 
                    f.name === file.name && f.size === file.size && f.lastModified === file.lastModified
                );
                return !isDuplicate && file.size <= 50 * 1024 * 1024;
            });

            if (validFiles.length === 0) {
                showToast('No new valid files to add', 'warning');
                return;
            }

            validFiles.forEach(file => {
                const fileObj = {
                    file,
                    id: Date.now() + Math.random(),
                    converted: false,
                    progress: 0,
                    convertedBlob: null
                };
                selectedFiles.push(fileObj);
                addFileToList(fileObj);
            });

            updateUI();
            showToast(`Added ${validFiles.length} file(s) successfully`, 'success');
        }

        function addFileToList(fileObj) {
            if (selectedFiles.length === 1) {
                filesContainer.style.display = 'block';
            }

            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.dataset.id = fileObj.id;

            fileItem.innerHTML = `
                <img src="#" alt="Preview" class="file-preview" id="preview-${fileObj.id}">
                <div class="file-info">
                    <div class="file-name">${fileObj.file.name}</div>
                    <div class="file-meta">
                        <span><i class="fas fa-weight"></i> ${formatFileSize(fileObj.file.size)}</span>
                        <span id="dimensions-${fileObj.id}"><i class="fas fa-image"></i> Loading...</span>
                        <span><i class="fas fa-calendar"></i> ${new Date(fileObj.file.lastModified).toLocaleDateString()}</span>
                    </div>
                </div>
                <div class="file-actions">
                    <button class="btn-icon" onclick="convertSingle('${fileObj.id}')" id="convert-${fileObj.id}" title="Convert file">
                        <i class="fas fa-magic"></i>
                    </button>
                    <button class="btn-icon" onclick="downloadSingle('${fileObj.id}')" id="download-${fileObj.id}" style="display: none;" title="Download converted file">
                        <i class="fas fa-download"></i>
                    </button>
                    <button class="btn-icon" onclick="removeFile('${fileObj.id}')" title="Remove file">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                <div class="progress-bar" id="progress-${fileObj.id}" style="display: none;">
                    <div class="progress-fill"></div>
                </div>
            `;

            filesList.appendChild(fileItem);
            loadFilePreview(fileObj);
        }

        function loadFilePreview(fileObj) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const preview = document.getElementById(`preview-${fileObj.id}`);
                    const dimensions = document.getElementById(`dimensions-${fileObj.id}`);
                    if (preview) preview.src = e.target.result;
                    if (dimensions) dimensions.innerHTML = `<i class="fas fa-image"></i> ${img.width}×${img.height}px`;
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(fileObj.file);
        }

        function formatFileSize(bytes) {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
        }

        function updateUI() {
            filesCount.textContent = selectedFiles.length;
            convertBtn.disabled = selectedFiles.length === 0 || selectedFiles.every(f => f.converted);
            downloadAllBtn.disabled = !selectedFiles.some(f => f.converted);
            downloadZipBtn.disabled = !selectedFiles.some(f => f.converted);
        }

        function updateQualityPreview() {
            const quality = document.getElementById('quality').value;
            const qualityValue = document.getElementById('qualityValue');
            const qualityLabels = {
                '1': 'Lossless',
                '0.95': 'Excellent',
                '0.9': 'High Quality',
                '0.8': 'Good Balance',
                '0.7': 'Medium',
                '0.6': 'High Compression'
            };
            qualityValue.textContent = qualityLabels[quality] || 'Custom';
        }

        async function convertSingle(fileId, triggerAutoDownload = true) {
            const fileObj = selectedFiles.find(f => f.id == fileId);
            if (!fileObj || fileObj.converted) return;

            const convertBtn = document.getElementById(`convert-${fileId}`);
            const downloadBtn = document.getElementById(`download-${fileId}`);
            const progressBar = document.getElementById(`progress-${fileId}`);
            
            convertBtn.innerHTML = '<div class="spinner"></div>';
            convertBtn.classList.add('loading');
            convertBtn.disabled = true;
            progressBar.style.display = 'block';

            try {
                const webpBlob = await convertToWebP(fileObj.file, (progress) => {
                    fileObj.progress = progress;
                    progressBar.querySelector('.progress-fill').style.width = `${progress}%`;
                });

                fileObj.converted = true;
                fileObj.convertedBlob = webpBlob;
                
                const originalSize = fileObj.file.size;
                const newSize = webpBlob.size;
                const reduction = ((originalSize - newSize) / originalSize * 100).toFixed(1);

                convertBtn.innerHTML = '<i class="fas fa-check"></i>';
                convertBtn.classList.remove('loading');
                convertBtn.classList.add('success');
                downloadBtn.style.display = 'block';

                // Auto-download if enabled
                if (triggerAutoDownload && document.getElementById('autoDownload').checked) {
                    downloadFile(webpBlob, fileObj.file.name.replace('.png', '.webp'));
                }

                updateUI();
                showToast(`Converted ${fileObj.file.name} (${reduction}% size reduction)`, 'success');

            } catch (error) {
                console.error('Conversion error:', error);
                convertBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
                convertBtn.classList.remove('loading');
                convertBtn.classList.add('error');
                showToast(`Failed to convert ${fileObj.file.name}: ${error.message}`, 'error');
            }
        }

        async function convertAll() {
            const unconvertedFiles = selectedFiles.filter(f => !f.converted);
            if (unconvertedFiles.length === 0) {
                showToast('All files are already converted', 'warning');
                return;
            }

            convertBtn.innerHTML = '<div class="spinner"></div> Converting...';
            convertBtn.disabled = true;

            let successCount = 0;
            let errorCount = 0;

            for (const fileObj of unconvertedFiles) {
                try {
                    await convertSingle(fileObj.id, false);
                    successCount++;
                } catch (error) {
                    errorCount++;
                }
                // Small delay to prevent UI blocking
                await new Promise(r => setTimeout(r, 100));
            }

            convertBtn.innerHTML = '<i class="fas fa-magic"></i> Convert All';
            convertBtn.disabled = true;

            if (errorCount === 0) {
                showToast(`Successfully converted all ${successCount} files!`, 'success');
            } else {
                showToast(`Converted ${successCount} files with ${errorCount} errors`, 'warning');
            }
        }

        function downloadSingle(fileId) {
            const fileObj = selectedFiles.find(f => f.id == fileId);
            if (!fileObj || !fileObj.convertedBlob) return;

            downloadFile(fileObj.convertedBlob, fileObj.file.name.replace('.png', '.webp'));
        }

        async function downloadAll() {
            const convertedFiles = selectedFiles.filter(f => f.converted && f.convertedBlob);
            if (convertedFiles.length === 0) {
                showToast('No converted files to download', 'warning');
                return;
            }

            if (convertedFiles.length === 1) {
                downloadSingle(convertedFiles[0].id);
                return;
            }

            // For multiple files, download individually with small delays
            for (const fileObj of convertedFiles) {
                downloadFile(fileObj.convertedBlob, fileObj.file.name.replace('.png', '.webp'));
                await new Promise(r => setTimeout(r, 200));
            }

            showToast(`Downloaded ${convertedFiles.length} files`, 'success');
        }

        function removeFile(fileId) {
            const index = selectedFiles.findIndex(f => f.id == fileId);
            if (index === -1) return;

            selectedFiles.splice(index, 1);
            const fileItem = document.querySelector(`[data-id="${fileId}"]`);
            if (fileItem) {
                fileItem.remove();
            }

            if (selectedFiles.length === 0) {
                filesContainer.style.display = 'none';
            }

            updateUI();
            showToast('File removed', 'success');
        }

        function clearAll() {
            if (selectedFiles.length === 0) return;
            
            if (confirm(`Clear all ${selectedFiles.length} files? This action cannot be undone.`)) {
                selectedFiles = [];
                convertedFiles = [];
                filesList.innerHTML = '';
                filesContainer.style.display = 'none';
                updateUI();
                showToast('All files cleared', 'success');
            }
        }

        async function convertToWebP(file, progressCallback) {
            return new Promise((resolve, reject) => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const img = new Image();
                
                img.onload = () => {
                    try {
                        progressCallback(20);
                        
                        // Get settings
                        const targetWidth = parseInt(document.getElementById('width').value) || img.width;
                        const targetHeight = parseInt(document.getElementById('height').value) || img.height;
                        const quality = parseFloat(document.getElementById('quality').value);
                        const resizeMode = document.getElementById('resizeMode').value;

                        let finalWidth = targetWidth;
                        let finalHeight = targetHeight;

                        // Handle resize modes
                        if (resizeMode === 'maintain') {
                            const aspectRatio = img.width / img.height;
                            if (document.getElementById('width').value && !document.getElementById('height').value) {
                                finalHeight = Math.round(targetWidth / aspectRatio);
                            } else if (document.getElementById('height').value && !document.getElementById('width').value) {
                                finalWidth = Math.round(targetHeight * aspectRatio);
                            } else if (!document.getElementById('width').value && !document.getElementById('height').value) {
                                finalWidth = img.width;
                                finalHeight = img.height;
                            }
                        }

                        canvas.width = finalWidth;
                        canvas.height = finalHeight;
                        
                        progressCallback(50);

                        // Apply resize mode
                        if (resizeMode === 'crop') {
                            const sourceAspect = img.width / img.height;
                            const targetAspect = finalWidth / finalHeight;
                            
                            let sourceX = 0, sourceY = 0, sourceWidth = img.width, sourceHeight = img.height;
                            
                            if (sourceAspect > targetAspect) {
                                sourceWidth = img.height * targetAspect;
                                sourceX = (img.width - sourceWidth) / 2;
                            } else {
                                sourceHeight = img.width / targetAspect;
                                sourceY = (img.height - sourceHeight) / 2;
                            }
                            
                            ctx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, finalWidth, finalHeight);
                        } else {
                            ctx.drawImage(img, 0, 0, finalWidth, finalHeight);
                        }
                        
                        progressCallback(80);
                        
                        // Convert to WebP
                        canvas.toBlob((blob) => {
                            if (blob) {
                                progressCallback(100);
                                resolve(blob);
                            } else {
                                reject(new Error('Failed to create WebP blob'));
                            }
                        }, 'image/webp', quality);
                        
                    } catch (error) {
                        reject(error);
                    }
                };
                
                img.onerror = () => reject(new Error('Failed to load image'));
                img.src = URL.createObjectURL(file);
                
                progressCallback(10);
            });
        }

        function downloadFile(blob, filename) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
        async function downloadAllAsZip() {
    const convertedFiles = selectedFiles.filter(f => f.converted && f.convertedBlob);
    if (convertedFiles.length === 0) {
        showToast('No converted files to download', 'warning');
        return;
    }

    showToast('Creating ZIP file, please wait...', 'info');
    downloadZipBtn.innerHTML = '<div class="spinner"></div> Zipping...';
    downloadZipBtn.disabled = true;

    try {
        // 1. Initialize JSZip
        const zip = new JSZip();

        // 2. Add each converted file to the zip
        convertedFiles.forEach(fileObj => {
            const filename = fileObj.file.name.replace(/\.png$/i, '.webp');
            zip.file(filename, fileObj.convertedBlob);
        });

        // 3. Generate the ZIP file as a blob
        const zipBlob = await zip.generateAsync({
            type: "blob",
            compression: "DEFLATE",
            compressionOptions: {
                level: 9 // Max compression
            }
        });

        // 4. Trigger the download
        downloadFile(zipBlob, 'converted-images.zip');
        showToast(`Downloaded ${convertedFiles.length} files as a ZIP`, 'success');

    } catch (error) {
        console.error('Zipping error:', error);
        showToast('Failed to create ZIP file.', 'error');
    } finally {
        // Reset the button state
        downloadZipBtn.innerHTML = '<i class="fas fa-file-archive"></i> Download .ZIP';
        downloadZipBtn.disabled = false;
    }
}

        function showToast(message, type) {
            // Remove existing toasts
            document.querySelectorAll('.toast').forEach(toast => toast.remove());
            
            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            
            const icon = type === 'success' ? 'fas fa-check-circle' : 
                        type === 'error' ? 'fas fa-exclamation-circle' : 
                        'fas fa-info-circle';
            
            toast.innerHTML = `
                <i class="${icon}"></i>
                <span>${message}</span>
            `;
            
            document.body.appendChild(toast);
            
            // Show toast
            setTimeout(() => toast.classList.add('show'), 100);
            
            // Hide toast
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 300);
            }, 4000);
        }

        // Handle page visibility changes for performance
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                console.log('Tab hidden, optimizing performance');
            }
        });

        // Global error handling
        window.addEventListener('error', (e) => {
            console.error('Global error:', e.error);
            showToast('An unexpected error occurred', 'error');
        });
