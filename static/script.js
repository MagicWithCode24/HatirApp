document.addEventListener("DOMContentLoaded", function () {
    let mediaRecorder;
    let audioChunks = [];
    let selectedFiles = [];
    let uploadedFilesCount = 0;
    let totalFilesToUpload = 0;
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

                const previewArea = document.getElementById("audioPreview");
                previewArea.innerHTML = "";
                const audio = document.createElement("audio");
                audio.controls = true;
                audio.src = audioUrl;
                const label = document.createElement("p");
                label.textContent = "Kaydınız:";
                previewArea.appendChild(label);
                previewArea.appendChild(audio);

                // Ses dosyasını benzersiz isimle ekle
                const timestamp = Date.now();
                selectedFiles.push(new File([audioBlob], `recording_${timestamp}.wav`, { type: 'audio/wav' }));
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
        // DÜZELTME: Dosyaları doğru şekilde birleştir
        selectedFiles = selectedFiles.filter(file => file.name.startsWith('recording_') || file.name === 'note.txt');
        selectedFiles = [...selectedFiles, ...newFiles];

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
                setTimeout(() => {
                    filePreviewProgressBarContainer.style.display = 'none';
                }, 500);
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
                    video.onloadeddata = function () { video.currentTime = 0; };
                    video.onseeked = function () {
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
                    video.onerror = function () {
                        console.error("Video yüklenemedi:", file.name);
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
            validPreviews.slice(0, maxNormalPreview).forEach(el => previewContainer.appendChild(el));
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

    mainForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Not içeriğini kontrol et
        const noteContent = document.querySelector("textarea[name='note']").value;
        
        if (selectedFiles.length === 0 && noteContent.trim() === "") {
            alert("Lütfen yüklenecek bir dosya seçin, ses kaydı yapın veya not yazın.");
            return;
        }

        if (submitBtn) {
            submitBtn.textContent = 'Yükleniyor...';
            submitBtn.disabled = true;
            uploadProgressBarContainer.style.display = 'block';
        }

        uploadedFilesCount = 0;
        totalFilesToUpload = selectedFiles.length;

        console.log('Yüklenecek dosyalar:', selectedFiles.map(f => f.name));

        // Form verilerini hazırla ve gönder
        try {
            await uploadAllFiles();
        } catch (error) {
            console.error('Upload hatası:', error);
            alert('Dosya yükleme hatası oluştu: ' + error.message);
            if (submitBtn) {
                submitBtn.textContent = 'Gönder';
                submitBtn.disabled = false;
                uploadProgressBarContainer.style.display = 'none';
            }
        }
    });

    // DÜZELTME: Form verilerini doğru şekilde gönder
    async function uploadAllFiles() {
        const formData = new FormData();
        const userName = document.querySelector("input[name='name']").value;
        const noteContent = document.querySelector("textarea[name='note']").value;
        
        // Kullanıcı adını ekle
        formData.append("name", userName);
        
        // Not içeriğini ekle (eğer varsa)
        if (noteContent.trim() !== "") {
            formData.append("note", noteContent);
        }
        
        // Tüm dosyaları FormData'ya ekle - BACKEND'DEKİ 'file' parametresine uygun olarak
        selectedFiles.forEach((file, index) => {
            formData.append("file", file);  // Backend 'file' parametresini bekliyor
        });

        console.log('FormData içeriği:');
        for (let pair of formData.entries()) {
            if (pair[1] instanceof File) {
                console.log(pair[0] + ': ' + pair[1].name + ' (' + pair[1].type + ')');
            } else {
                console.log(pair[0] + ': ' + pair[1]);
            }
        }

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            
            xhr.upload.addEventListener('progress', function(event) {
                if (event.lengthComputable) {
                    const percentComplete = (event.loaded / event.total) * 100;
                    uploadProgressBar.style.width = percentComplete.toFixed(0) + '%';
                    uploadProgressText.textContent = percentComplete.toFixed(0) + '%';
                }
            });
            
            xhr.addEventListener('load', function() {
                console.log('XHR Response status:', xhr.status);
                console.log('XHR Response text:', xhr.responseText);
                
                if (xhr.status >= 200 && xhr.status < 400) {
                    uploadProgressBar.style.width = '100%';
                    uploadProgressText.textContent = '100%';
                    setTimeout(() => { 
                        window.location.href = '/son';  // Backend'deki redirect URL'e uygun
                    }, 500);
                    resolve();
                } else {
                    console.error('Server error:', xhr.status, xhr.responseText);
                    reject(new Error('Upload başarısız: ' + xhr.status + ' - ' + xhr.responseText));
                }
            });
            
            xhr.addEventListener('error', function() {
                console.error('Network error during upload');
                reject(new Error('Network hatası'));
            });

            xhr.addEventListener('timeout', function() {
                console.error('Upload timeout');
                reject(new Error('Upload zaman aşımı'));
            });

            xhr.open('POST', mainForm.action);
            xhr.timeout = 60000;  // 60 saniye timeout
            xhr.send(formData);
        });
    }
