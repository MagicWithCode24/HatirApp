document.addEventListener("DOMContentLoaded", function () {
    let mediaRecorder;
    let audioChunks = [];
    let currentAudioBlob = null;

    const micBtn = document.getElementById("micBtn");
    const recordPanel = document.getElementById("recordPanel");
    const startBtn = document.getElementById("startBtn");
    const stopBtn = document.getElementById("stopBtn"); // Buradaki atama hatası düzeltildi!
    const audioPreviewContainer = document.getElementById("audioPreviewContainer");
    const audioPlayback = document.getElementById("audioPlayback");

    micBtn.addEventListener("click", (e) => {
        e.preventDefault();
        recordPanel.classList.toggle("active");
        // Mikrofon paneli her açıldığında/kapandığında önizlemeyi gizle
        audioPreviewContainer.style.display = 'none';
        audioPlayback.src = ''; // Ses kaynağını temizle
        // Buton durumlarını sıfırla
        startBtn.disabled = false;
        stopBtn.disabled = true;
    });

    startBtn.addEventListener("click", async (e) => {
        e.preventDefault();

        // Yeni kayıt başlatıldığında eski önizlemeyi gizle
        audioPreviewContainer.style.display = 'none';
        audioPlayback.src = '';

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
                currentAudioBlob = audioBlob;

                const audioUrl = URL.createObjectURL(audioBlob);
                audioPlayback.src = audioUrl;
                audioPreviewContainer.style.display = 'block';

                console.log("Ses kaydı tamamlandı, önizleme hazır.");
                stream.getTracks().forEach(track => track.stop());
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
    const uploadProgressBar = document.getElementById('uploadProgressBar');
    const uploadProgressText = document.getElementById('uploadProgressText');
    const uploadProgressContainer = document.querySelector('.upload-progress-container');

    const mainForm = document.querySelector('form');
    const finishBtn = document.querySelector('.finish-btn');

    fileInput.addEventListener('change', async () => {
        const files = Array.from(fileInput.files);
        previewContainer.innerHTML = '';
        uploadProgressBar.style.width = '0%';
        uploadProgressBar.classList.remove('complete');
        uploadProgressText.textContent = '0%';

        if (files.length > 0) {
            uploadText.style.display = "none";
            previewContainer.style.minHeight = "100px";
            uploadProgressContainer.style.display = 'flex';
        } else {
            uploadText.style.display = "block";
            previewContainer.style.minHeight = "auto";
            uploadProgressContainer.style.display = 'none';
            return;
        }

        const maxNormalPreview = 2;
        const maxOverlayPreview = 3;

        let loadedFilesCount = 0;
        const totalFiles = files.length;

        const createPreviewElement = (file) => {
            return new Promise(async resolve => {
                let previewElement = null;
                if (file.type.startsWith("image/")) {
                    previewElement = await new Promise(imgResolve => {
                        const reader = new FileReader();
                        reader.onload = function (e) {
                            const img = document.createElement("img");
                            img.src = e.target.result;
                            imgResolve(img);
                        };
                        reader.readAsDataURL(file);
                    });
                } else if (file.type.startsWith("video/")) {
                    previewElement = await new Promise(videoResolve => {
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
                            videoResolve(img);
                        };
                        video.onerror = function() {
                            console.error("Video yüklenemedi veya işlenemedi:", file.name);
                            const errorDiv = document.createElement('div');
                            errorDiv.textContent = 'Video önizlemesi yüklenemedi.';
                            errorDiv.style.cssText = 'width:80px;height:100px;border:2px dashed #ccc;display:flex;align-items:center;justify-content:center;font-size:10px;text-align:center;color:#888;overflow:hidden;';
                            videoResolve(errorDiv);
                        };
                    });
                }
                
                loadedFilesCount++;
                const previewProgressPercentage = (loadedFilesCount / totalFiles) * 100;
                uploadProgressBar.style.width = `${previewProgressPercentage}%`;
                uploadProgressText.textContent = `${Math.round(previewProgressPercentage)}%`;

                if (previewElement) {
                    if (loadedFilesCount <= maxNormalPreview) {
                        previewContainer.appendChild(previewElement);
                    } else if (loadedFilesCount <= maxNormalPreview + maxOverlayPreview) {
                        let overlayStackContainer = previewContainer.querySelector('.overlay-stack-container');
                        if (!overlayStackContainer) {
                            overlayStackContainer = document.createElement("div");
                            overlayStackContainer.className = "overlay-stack-container";
                            previewContainer.appendChild(overlayStackContainer);
                        }
                        const slideDistance = 3.75;
                        previewElement.classList.add("overlay");
                        const currentOverlayCount = overlayStackContainer.querySelectorAll('.overlay').length;
                        previewElement.style.left = `${currentOverlayCount * slideDistance}px`;
                        previewElement.style.zIndex = maxOverlayPreview - currentOverlayCount;
                        overlayStackContainer.appendChild(previewElement);
                    } else {
                        let extraCountElement = previewContainer.querySelector('.extra-count');
                        if (!extraCountElement) {
                            let overlayStackContainer = previewContainer.querySelector('.overlay-stack-container');
                            if (!overlayStackContainer) {
                                overlayStackContainer = document.createElement("div");
                                overlayStackContainer.className = "overlay-stack-container";
                                previewContainer.appendChild(overlayStackContainer);
                            }
                            extraCountElement = document.createElement("div");
                            extraCountElement.className = "extra-count";
                            overlayStackContainer.appendChild(extraCountElement);
                        }
                        const currentExtraCount = parseInt(extraCountElement.textContent.replace('+', '') || '0');
                        extraCountElement.textContent = `+${currentExtraCount + 1}`;
                    }
                }
                resolve();
            });
        };

        for (let i = 0; i < totalFiles; i++) {
            await createPreviewElement(files[i]);
        }
    });

    mainForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.querySelector("input[name='name']").value;
        const note_content = document.querySelector("textarea[name='note']").value;
        const filesToUpload = Array.from(fileInput.files);

        if (currentAudioBlob) {
            filesToUpload.push(currentAudioBlob);
        }

        if (!username) {
            alert('Lütfen bir kullanıcı adı girin!');
            return;
        }

        if (filesToUpload.length === 0 && !note_content) {
            alert('Lütfen yüklenecek bir dosya, not veya ses kaydı ekleyin!');
            return;
        }
        
        finishBtn.disabled = true;
        finishBtn.textContent = 'Yükleniyor...';

        uploadProgressContainer.style.display = 'flex';
        uploadProgressBar.style.width = '0%';
        uploadProgressBar.classList.remove('complete');
        uploadProgressText.textContent = '0%';

        let uploadedItemsCount = 0;
        const totalItems = filesToUpload.length + (note_content ? 1 : 0);
        let allUploadsSuccessful = true;

        if (note_content) {
            const formData = new FormData();
            formData.append('name', username);
            formData.append('note', note_content);
            try {
                const response = await fetch('/upload_item', {
                    method: 'POST',
                    body: formData
                });
                const data = await response.json();
                if (data.success) {
                    console.log('Not başarıyla yüklendi.');
                } else {
                    console.error('Not yüklenirken hata oluştu:', data.error);
                    allUploadsSuccessful = false;
                }
            } catch (error) {
                console.error('Not yükleme ağ hatası:', error);
                allUploadsSuccessful = false;
            } finally {
                uploadedItemsCount++;
                const progress = (uploadedItemsCount / totalItems) * 100;
                uploadProgressBar.style.width = `${progress}%`;
                uploadProgressText.textContent = `${Math.round(progress)}%`;
            }
        }

        for (const item of filesToUpload) {
            const formData = new FormData();
            formData.append('name', username);

            let fileName = 'unknown_file';

            if (item instanceof Blob) {
                formData.append('file', item, `audio_recording_${Date.now()}.wav`);
                fileName = `audio_recording_${Date.now()}.wav`;
            } else {
                formData.append('file', item);
                fileName = item.name;
            }
            
            try {
                const response = await fetch('/upload_item', {
                    method: 'POST',
                    body: formData
                });
                const data = await response.json();
                if (data.success) {
                    console.log(`'${fileName}' başarıyla yüklendi.`);
                } else {
                    console.error(`'${fileName}' yüklenirken hata oluştu:`, data.error);
                    allUploadsSuccessful = false;
                }
            } catch (error) {
                console.error(`'${fileName}' yüklenirken ağ hatası oluştu:`, error);
                allUploadsSuccessful = false;
            } finally {
                uploadedItemsCount++;
                const progress = (uploadedItemsCount / totalItems) * 100;
                uploadProgressBar.style.width = `${progress}%`;
                uploadProgressText.textContent = `${Math.round(progress)}%`;
            }
        }

        if (uploadedItemsCount === totalItems) {
            uploadProgressBar.classList.add('complete');
            finishBtn.disabled = false;
            finishBtn.textContent = 'Gönder';

            audioPreviewContainer.style.display = 'none';
            audioPlayback.src = '';
            currentAudioBlob = null;

            if (allUploadsSuccessful) {
                window.location.href = '/son'; 
            } else {
                alert('Bazı yüklemeler başarısız oldu. Lütfen konsolu kontrol edin.');
            }
        }
    });
});
