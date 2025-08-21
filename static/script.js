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

                selectedFiles.push(new File([audioBlob], "recording.wav", { type: 'audio/wav' }));
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
    // Her yeni dosya seçiminde selectedFiles'ı sıfırla.
        selectedFiles = Array.from(fileInput.files);
    
        previewContainer.innerHTML = '';
        
        // Yükleme metni ve ilerleme çubuğu görünürlüğünü güncelle.
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
    
        let allPreviews = [];
        let loadedCount = 0;
    
        const updateFilePreviewProgress = () => {
            loadedCount++;
            const percentComplete = (loadedCount / selectedFiles.length) * 100;
            filePreviewProgressBar.style.width = percentComplete.toFixed(0) + '%';
            filePreviewProgressText.textContent = percentComplete.toFixed(0) + '%';
            if (loadedCount === selectedFiles.length) {
                // Son yükleme tamamlandığında ilerleme çubuğunu gizle
                setTimeout(() => {
                    filePreviewProgressBarContainer.style.display = 'none';
                }, 500);
            }
        };
    
        selectedFiles.forEach(file => {
            if (file.type.startsWith("image/")) {
                const reader = new FileReader();
                reader.onload = function (e) {
                    const img = document.createElement("img");
                    img.src = e.target.result;
                    previewContainer.appendChild(img);
                    updateFilePreviewProgress();
                };
                reader.onerror = function(err) {
                    console.error("Resim önizlemesi yüklenirken hata:", err);
                    updateFilePreviewProgress(); // Hata durumunda da ilerlemeyi güncelle
                };
                reader.readAsDataURL(file);
            } else if (file.type.startsWith("video/")) {
                // ... (video önizleme mantığı, aynı şekilde onerror ekleyebilirsiniz)
                // Bu kısım karmaşık olduğu için direkt "video önizlemesi yüklenemedi" metni göstermek daha iyi olabilir.
                const video = document.createElement('video');
                video.src = URL.createObjectURL(file);
                video.preload = 'metadata';
                video.onloadeddata = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    const img = document.createElement('img');
                    img.src = canvas.toDataURL('image/jpeg');
                    previewContainer.appendChild(img);
                    URL.revokeObjectURL(video.src);
                    updateFilePreviewProgress();
                };
                video.onerror = () => {
                    console.error("Video önizlemesi yüklenirken hata:", file.name);
                    const errorDiv = document.createElement('div');
                    errorDiv.textContent = 'Video önizlemesi yüklenemedi.';
                    // CSS stilleri
                    previewContainer.appendChild(errorDiv);
                    updateFilePreviewProgress();
                };
            } else {
                // Görsel veya video olmayan dosyalar için
                const textDiv = document.createElement('div');
                textDiv.textContent = `${file.name} (Desteklenmiyor)`;
                // CSS stilleri
                previewContainer.appendChild(textDiv);
                updateFilePreviewProgress();
            }
        });
    
        // Promise.all yerine, her bir dosyayı ayrı ayrı işle.
        // Bu, hata durumunda tüm sürecin durmasını engeller.
        // Ancak, şu anki mantıkta zaten her bir dosyayı ayrı ayrı işlemek daha doğru.
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

    mainForm.addEventListener('submit', function(e) {
        e.preventDefault();
    
        if (selectedFiles.length === 0) {
            alert("Lütfen yüklenecek bir dosya seçin veya ses kaydı yapın.");
            return;
        }
    
        if (submitBtn) {
            submitBtn.textContent = 'Yükleniyor...';
            submitBtn.disabled = true;
            uploadProgressBarContainer.style.display = 'block';
        }
    
        // Tek bir FormData nesnesi oluştur.
        const formData = new FormData();
        formData.append("name", document.querySelector("input[name='name']").value);
        
        // Tüm dosyaları aynı "file" anahtarı altında FormData'ya ekle.
        selectedFiles.forEach(file => {
            formData.append("file", file);
        });
    
        const xhr = new XMLHttpRequest();
    
        xhr.upload.addEventListener('progress', function(event) {
            if (event.lengthComputable) {
                const percentComplete = (event.loaded / event.total) * 100;
                uploadProgressBar.style.width = percentComplete.toFixed(0) + '%';
                uploadProgressText.textContent = percentComplete.toFixed(0) + '%';
            }
        });
    
        xhr.addEventListener('load', function() {
            // Yükleme tamamlandığında sayfayı yönlendir.
            // Hata kontrolü eklemek istersen, burada xhr.status'ü kontrol edebilirsin.
            setTimeout(() => { 
                window.location.href = mainForm.action; 
            }, 500);
        });
    
        xhr.addEventListener('error', function() {
            console.error("Dosya yükleme hatası.");
            alert("Dosya yükleme sırasında bir hata oluştu.");
            // Hata durumunda butonu tekrar aktif hale getir.
            if (submitBtn) {
                submitBtn.textContent = 'Gönder';
                submitBtn.disabled = false;
            }
        });
    
        xhr.open('POST', mainForm.action);
        xhr.send(formData);
    });

