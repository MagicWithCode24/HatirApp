// Sayfa yüklendiğinde çalışacak ana fonksiyon
document.addEventListener("DOMContentLoaded", function () {
    // Gerekli DOM elementlerini alıyoruz
    let mediaRecorder;
    let audioChunks = [];
    let selectedFiles = []; // Dosyaların saklanacağı dizi
    let isUploading = false; // Yükleme işleminin devam edip etmediğini kontrol etmek için
    
    // UI elementleri
    const micBtn = document.getElementById("micBtn");
    const recordPanel = document.getElementById("recordPanel");
    const startBtn = document.getElementById("startBtn");
    const stopBtn = document.getElementById("stopBtn");
    const submitBtn = document.getElementById("submitBtn");
    const mainForm = document.getElementById("mainForm");
    const fileInput = document.getElementById('real-file');
    const previewContainer = document.getElementById('uploadPreview');
    const uploadText = document.getElementById('uploadText');

    // Yükleme ve önizleme ilerleme çubukları
    const uploadProgressBarContainer = document.getElementById("uploadProgressBarContainer");
    const uploadProgressBar = document.getElementById("uploadProgressBar");
    const uploadProgressText = document.getElementById("uploadProgressText");
    const filePreviewProgressBarContainer = document.getElementById("filePreviewProgressBarContainer");
    const filePreviewProgressBar = document.getElementById("filePreviewProgressBar");
    const filePreviewProgressText = document.getElementById("filePreviewProgressText");

    // Mikrofon düğmesine tıklama olayı
    micBtn.addEventListener("click", (e) => {
        e.preventDefault();
        recordPanel.classList.toggle("active");
    });

    // Ses kaydını başlatma olayı
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
            startBtn.disabled = true;
            stopBtn.disabled = false;
        } catch (err) {
            console.error("Mikrofon erişim hatası:", err);
            alert("Mikrofon erişimi reddedildi veya bir hata oluştu.");
        }
    });

    // Ses kaydını durdurma olayı
    stopBtn.addEventListener("click", () => {
        if (mediaRecorder && mediaRecorder.state === "recording") {
            mediaRecorder.stop();
        }
        startBtn.disabled = false;
        stopBtn.disabled = true;
    });

    // Dosya seçme olayı
    fileInput.addEventListener('change', () => {
        selectedFiles = Array.from(fileInput.files);
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
        // Dosya önizleme mantığı
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

    // Yeni dosya yükleme fonksiyonu: her bir dosya için ön-imzalı URL alıp doğrudan S3'e yükler
    async function uploadFileToS3(file, username, updateProgressCallback) {
        try {
            // Sunucudan ön-imzalı URL'i al
            const response = await fetch('/get-presigned-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: file.name, file_type: file.type, username: username })
            });
            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || 'Ön-imzalı URL alınamadı.');
            }
            const presignedUrl = data.url;

            return new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                
                // XMLHttpRequest progress olay dinleyicisi
                xhr.upload.addEventListener('progress', (event) => {
                    if (event.lengthComputable) {
                        const percentComplete = (event.loaded / event.total);
                        updateProgressCallback(percentComplete);
                    }
                });

                xhr.addEventListener('load', () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        console.log(`Dosya başarıyla S3'e yüklendi: ${data.key}`);
                        resolve({ success: true });
                    } else {
                        console.error(`Dosya yükleme hatası: ${xhr.statusText}`);
                        reject(new Error(`Dosya yükleme hatası: ${xhr.statusText}`));
                    }
                });

                xhr.addEventListener('error', () => {
                    console.error('Ağ hatası veya sunucuya ulaşılamadı.');
                    reject(new Error('Ağ hatası veya sunucuya ulaşılamadı.'));
                });

                xhr.open('PUT', presignedUrl);
                xhr.setRequestHeader('Content-Type', file.type);
                xhr.send(file);
            });

        } catch (error) {
            console.error("Dosya yüklenirken bir hata oluştu:", error);
            return { success: false, error: error.message };
        }
    }

    // Form gönderimini ele alma fonksiyonu
    mainForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        // Eğer bir yükleme devam ediyorsa, tekrar göndermeyi engelle
        if (isUploading) return;

        isUploading = true;
        
        // Yükleme durumu arayüzünü güncelle
        submitBtn.textContent = 'Yükleniyor...';
        submitBtn.disabled = true;
        uploadProgressBarContainer.style.display = 'block';
        uploadProgressBar.style.width = '0%';
        uploadProgressText.textContent = '0%';
        uploadProgressBar.style.backgroundColor = '#4CAF50';
        
        const username = document.querySelector("input[name='name']").value.trim();
        const noteContent = document.querySelector("textarea[name='note']").value.trim();

        if (!username) {
            alert('Lütfen isminizi girin!');
            isUploading = false;
            submitBtn.textContent = 'Gönder';
            submitBtn.disabled = false;
            return;
        }

        const uploadTasks = [];
        const overallProgress = new Map();

        // Notu yükle
        if (noteContent) {
            uploadTasks.push(async () => {
                const response = await fetch('/upload-note', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: username, note: noteContent })
                });
                const data = await response.json();
                if (data.success) {
                    overallProgress.set('note', 1); // Not yüklemesi tamamlandı
                    updateOverallProgress();
                } else {
                    overallProgress.set('note', 0); // Hata durumunda 0
                    console.error("Not yükleme hatası:", data.error);
                }
            });
        }
        
        // Dosyaları ve ses kaydını yükle
        selectedFiles.forEach((file, index) => {
            const taskId = `file-${index}`;
            overallProgress.set(taskId, 0); // Başlangıçta her dosyanın ilerlemesi 0
            uploadTasks.push(async () => {
                const result = await uploadFileToS3(file, username, (progress) => {
                    overallProgress.set(taskId, progress); // Dosyanın ilerlemesini güncelle
                    updateOverallProgress(); // Genel ilerleme çubuğunu güncelle
                });
                if (!result.success) {
                    // Hata durumunda ilerlemeyi 0'a çek
                    overallProgress.set(taskId, 0);
                    updateOverallProgress();
                }
            });
        });

        if (audioChunks.length > 0) {
            const taskId = 'audio';
            overallProgress.set(taskId, 0);
            uploadTasks.push(async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                const result = await uploadFileToS3(audioBlob, username, (progress) => {
                    overallProgress.set(taskId, progress);
                    updateOverallProgress();
                });
                if (!result.success) {
                    overallProgress.set(taskId, 0);
                    updateOverallProgress();
                }
            });
        }
        
        const totalTasks = overallProgress.size;

        // Genel ilerleme çubuğunu güncelle
        function updateOverallProgress() {
            let totalProgress = 0;
            overallProgress.forEach(progress => {
                totalProgress += progress;
            });
            const percentComplete = (totalProgress / totalTasks) * 100;
            uploadProgressBar.style.width = percentComplete.toFixed(0) + '%';
            uploadProgressText.textContent = percentComplete.toFixed(0) + '%';
        }
        
        // Tüm yükleme işlemlerini eş zamanlı olarak başlat
        await Promise.all(uploadTasks.map(task => task()));

        // Yükleme tamamlandığında arayüzü güncelle
        uploadProgressBar.style.width = '100%';
        uploadProgressText.textContent = '100% Tamamlandı!';

        // Sonuç sayfasına yönlendir
        setTimeout(() => {
            window.location.href = '/son';
        }, 700);
    });
});
