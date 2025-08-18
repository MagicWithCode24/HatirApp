document.addEventListener("DOMContentLoaded", function () {
    let mediaRecorder;
    let audioChunks = [];
    let selectedFiles = [];
    const micBtn = document.getElementById("micBtn");
    const recordPanel = document.getElementById("recordPanel");
    const startBtn = document.getElementById("startBtn");
    const stopBtn = document.getElementById("stopBtn");
    const submitBtn = document.getElementById("submitBtn");
    const mainForm = document.getElementById("mainForm");
    const uploadProgressBarContainer = document.getElementById("uploadProgressBarContainer");
    const uploadProgressBar = document.getElementById("uploadProgressBar");
    const uploadProgressText = document.getElementById("uploadProgressText");
    const filePreviewProgressBarContainer = document.getElementById("filePreviewProgressBarContainer");
    const filePreviewProgressBar = document.getElementById("filePreviewProgressBar");
    const filePreviewProgressText = document.getElementById("filePreviewProgressText");

    // Chunk upload ayarları
    const CHUNK_SIZE = 1024 * 1024; // 1MB chunks (mobil için optimize)
    const MAX_RETRIES = 3;
    const TIMEOUT_MS = 30000; // 30 saniye timeout

    micBtn.addEventListener("click", (e) => {
        e.preventDefault();
        recordPanel.classList.toggle("active");
    });

    startBtn.addEventListener("click", async (e) => {
        e.preventDefault();

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.start();

            audioChunks = [];

            mediaRecorder.addEventListener("dataavailable", event => {
                audioChunks.push(event.data);
            });

            mediaRecorder.addEventListener("stop", () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                const audioUrl = URL.createObjectURL(audioBlob);

                const formData = new FormData();
                formData.append("audio", audioBlob, "recording.wav");
                formData.append("name", document.querySelector("input[name='name']").value);

                fetch("/upload-audio", {
                    method: "POST",
                    body: formData
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        const previewArea = document.getElementById("audioPreview");
                        previewArea.innerHTML = "";

                        const audio = document.createElement("audio");
                        audio.controls = true;
                        audio.src = audioUrl;

                        const label = document.createElement("p");
                        label.textContent = "Kaydınız:";

                        previewArea.appendChild(label);
                        previewArea.appendChild(audio);
                    } else {
                        alert("Ses kaydınız yüklenemedi.");
                    }
                })
                .catch(error => {
                    console.error("Ses yükleme hatası:", error);
                    alert("Ses kaydı yüklenirken bir hata oluştu.");
                });
            });

            startBtn.disabled = true;
            stopBtn.disabled = false;
        } catch (err) {
            console.error("Mikrofon erişim hatası:", err);
            alert("Mikrofon erişimi reddedildi veya bir hata oluştu.");
        }
    });

    stopBtn.addEventListener("click", () => {
        if (mediaRecorder && mediaRecorder.state === "recording") {
            mediaRecorder.stop();
        }
        startBtn.disabled = false;
        stopBtn.disabled = true;
    });

    const fileInput = document.getElementById('real-file');
    const previewContainer = document.getElementById('uploadPreview');
    const uploadText = document.getElementById('uploadText');

    fileInput.addEventListener('change', () => {
        const newFiles = Array.from(fileInput.files);
        selectedFiles = newFiles;

        previewContainer.innerHTML = '';

        if (selectedFiles.length > 0) {
            uploadText.style.display = "none";
            previewContainer.style.minHeight = "100px";
            filePreviewProgressBarContainer.style.display = 'block';
            filePreviewProgressBar.style.width = '0%';
            filePreviewProgressText.textContent = '0%';
        } else {
            uploadText.style.display = "block";
            previewContainer.style.minHeight = "auto";
            filePreviewProgressBarContainer.style.display = 'none';
        }

        const maxNormalPreview = 2;
        const maxOverlayPreview = 3;

        let allPreviews = [];
        let loadedCount = 0;

        const updateFilePreviewProgress = () => {
            loadedCount++;
            const percentComplete = (loadedCount / selectedFiles.length) * 100;
            filePreviewProgressBar.style.width = percentComplete.toFixed(0) + '%';
            filePreviewProgressText.textContent = percentComplete.toFixed(0) + '%';

            if (loadedCount === selectedFiles.length) {
                filePreviewProgressBar.style.backgroundColor = '#4CAF50';
                filePreviewProgressText.textContent = 'Tamamlandı!';
                setTimeout(() => {
                    filePreviewProgressBarContainer.style.display = 'none';
                    filePreviewProgressBar.style.backgroundColor = '#6a0dad';
                }, 1500);
            }
        };

        selectedFiles.forEach(file => {
            if (file.type.startsWith("image/")) {
                allPreviews.push(new Promise(resolve => {
                    const reader = new FileReader();
                    reader.onload = function (e) {
                        const img = document.createElement("img");
                        img.src = e.target.result;
                        updateFilePreviewProgress();
                        resolve(img);
                    };
                    reader.readAsDataURL(file);
                }));
            } else if (file.type.startsWith("video/")) {
                allPreviews.push(new Promise(resolve => {
                    const video = document.createElement('video');
                    video.preload = 'metadata';
                    video.src = URL.createObjectURL(file);
                    video.onloadeddata = function() {
                        video.currentTime = 0;
                    };
                    video.onseeked = function() {
                        const canvas = document.createElement('canvas');
                        canvas.width = video.videoWidth;
                        canvas.height = video.videoHeight;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                        const img = document.createElement('img');
                        img.src = canvas.toDataURL('image/jpeg');
                        URL.revokeObjectURL(video.src);
                        updateFilePreviewProgress();
                        resolve(img);
                    };
                    video.onerror = function() {
                        console.error("Video yüklenemedi veya işlenemedi:", file.name);
                        const errorDiv = document.createElement('div');
                        errorDiv.textContent = 'Video önizlemesi yüklenemedi.';
                        errorDiv.style.cssText = 'width:80px;height:100px;border:2px dashed #ccc;display:flex;align-items:center;justify-content:center;font-size:10px;text-align:center;color:#888;overflow:hidden;';
                        updateFilePreviewProgress();
                        resolve(errorDiv);
                    };
                }));
            } else {
                updateFilePreviewProgress();
                allPreviews.push(Promise.resolve(null));
            }
        });

        Promise.all(allPreviews).then(results => {
            const validPreviews = results.filter(el => el !== null);

            validPreviews.slice(0, maxNormalPreview).forEach(el => {
                previewContainer.appendChild(el);
            });

            const totalExtraCount = validPreviews.length - maxNormalPreview;

            if (totalExtraCount > 0) {
                const overlayStackContainer = document.createElement("div");
                overlayStackContainer.className = "overlay-stack-container";

                const slideDistance = 3.75;

                validPreviews.slice(maxNormalPreview, maxNormalPreview + maxOverlayPreview).forEach((el, index) => {
                    el.classList.add("overlay");
                    el.style.left = `${index * slideDistance}px`;
                    el.style.zIndex = maxOverlayPreview - index;
                    overlayStackContainer.appendChild(el);
                });

                if (totalExtraCount > 0) {
                    const extra = document.createElement("div");
                    extra.className = "extra-count";
                    extra.textContent = `+${totalExtraCount}`;
                    overlayStackContainer.appendChild(extra);
                }
                previewContainer.appendChild(overlayStackContainer);
            }
        });
    });

    // Chunk upload fonksiyonları
    async function uploadFileInChunks(file, username) {
        return new Promise(async (resolve, reject) => {
            try {
                // 1. Upload başlat
                const startResponse = await fetch('/start-upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        filename: file.name,
                        username: username,
                        fileSize: file.size,
                        contentType: file.type
                    })
                });

                const startData = await startResponse.json();
                if (!startData.success) {
                    throw new Error(startData.error);
                }

                const uploadId = startData.uploadId;
                const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
                let uploadedBytes = 0;

                // 2. Chunk'ları sırayla yükle
                for (let chunkNumber = 1; chunkNumber <= totalChunks; chunkNumber++) {
                    const start = (chunkNumber - 1) * CHUNK_SIZE;
                    const end = Math.min(start + CHUNK_SIZE, file.size);
                    const chunk = file.slice(start, end);

                    let retryCount = 0;
                    let success = false;

                    while (retryCount < MAX_RETRIES && !success) {
                        try {
                            const chunkFormData = new FormData();
                            chunkFormData.append('uploadId', uploadId);
                            chunkFormData.append('chunkNumber', chunkNumber);
                            chunkFormData.append('chunk', chunk);

                            const chunkResponse = await Promise.race([
                                fetch('/upload-chunk', {
                                    method: 'POST',
                                    body: chunkFormData
                                }),
                                new Promise((_, reject) => 
                                    setTimeout(() => reject(new Error('Timeout')), TIMEOUT_MS)
                                )
                            ]);

                            const chunkData = await chunkResponse.json();
                            
                            if (chunkData.success) {
                                success = true;
                                uploadedBytes += chunk.size;
                                
                                // Progress güncelle
                                const progress = (uploadedBytes / file.size) * 100;
                                updateUploadProgress(progress);
                            } else {
                                throw new Error(chunkData.error);
                            }
                        } catch (error) {
                            retryCount++;
                            console.warn(`Chunk ${chunkNumber} yüklenemedi (deneme ${retryCount}):`, error);
                            
                            if (retryCount < MAX_RETRIES) {
                                // Exponential backoff
                                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
                            }
                        }
                    }

                    if (!success) {
                        // Upload'ı iptal et
                        await fetch('/cancel-upload', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ uploadId })
                        });
                        throw new Error(`Chunk ${chunkNumber} ${MAX_RETRIES} denemeden sonra yüklenemedi`);
                    }
                }

                // 3. Upload'ı tamamla
                const completeResponse = await fetch('/complete-upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ uploadId })
                });

                const completeData = await completeResponse.json();
                if (completeData.success) {
                    resolve(completeData.url);
                } else {
                    throw new Error(completeData.error);
                }

            } catch (error) {
                console.error(`${file.name} yükleme hatası:`, error);
                reject(error);
            }
        });
    }

    function updateUploadProgress(percent) {
        uploadProgressBar.style.width = percent.toFixed(0) + '%';
        uploadProgressText.textContent = percent.toFixed(0) + '%';
    }

    mainForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const username = document.querySelector("input[name='name']").value;
        const noteContent = document.querySelector("textarea[name='note']").value;

        if (!username) {
            alert('Lütfen bir isim girin!');
            return;
        }

        if (submitBtn) {
            submitBtn.textContent = 'Yükleniyor...';
            submitBtn.disabled = true;
            uploadProgressBarContainer.style.display = 'block';
            uploadProgressBar.style.width = '0%';
            uploadProgressText.textContent = '0%';
            uploadProgressBar.style.backgroundColor = '#6a0dad';
        }

        try {
            let totalFiles = selectedFiles.length;
            let completedFiles = 0;
            let allUploadUrls = [];

            // Önce notu yükle
            if (noteContent) {
                const noteFormData = new FormData();
                noteFormData.append('name', username);
                noteFormData.append('note', noteContent);

                const noteResponse = await fetch('/son', {
                    method: 'POST',
                    body: noteFormData
                });

                if (!noteResponse.ok) {
                    throw new Error('Not yüklenemedi');
                }
            }

            // Dosyaları chunk upload ile yükle
            if (selectedFiles.length > 0) {
                for (let i = 0; i < selectedFiles.length; i++) {
                    const file = selectedFiles[i];
                    console.log(`${file.name} yükleniyor... (${i + 1}/${totalFiles})`);
                    
                    try {
                        const fileUrl = await uploadFileInChunks(file, username);
                        allUploadUrls.push(fileUrl);
                        completedFiles++;
                        
                        // Genel progress güncelle
                        const overallProgress = (completedFiles / totalFiles) * 100;
                        updateUploadProgress(overallProgress);
                        
                        console.log(`✓ ${file.name} başarıyla yüklendi`);
                    } catch (error) {
                        console.error(`✗ ${file.name} yüklenemedi:`, error);
                        alert(`${file.name} yüklenirken hata oluştu: ${error.message}`);
                    }
                }
            }

            // Tüm işlemler tamamlandı
            uploadProgressBar.style.backgroundColor = '#4CAF50';
            uploadProgressText.textContent = 'Tamamlandı!';
            
            setTimeout(() => {
                window.location.href = '/son';
            }, 1000);

        } catch (error) {
            console.error('Form gönderme hatası:', error);
            alert('Bir hata oluştu: ' + error.message);
            
            if (submitBtn) {
                submitBtn.textContent = 'Gönder';
                submitBtn.disabled = false;
                uploadProgressBarContainer.style.display = 'none';
            }
        }
    });

    // Network durumu kontrolü
    function checkNetworkStatus() {
        if (!navigator.onLine) {
            alert('İnternet bağlantınız kesildi. Lütfen bağlantınızı kontrol edin.');
            return false;
        }
        return true;
    }

    // Network event listeners
    window.addEventListener('online', () => {
        console.log('İnternet bağlantısı geri geldi');
    });

    window.addEventListener('offline', () => {
        console.log('İnternet bağlantısı kesildi');
        alert('İnternet bağlantınız kesildi. Upload işlemi duraklatıldı.');
    });
});
