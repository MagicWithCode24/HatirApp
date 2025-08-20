document.addEventListener("DOMContentLoaded", function () {
    let mediaRecorder;
    let audioChunks = [];
    let selectedFiles = []; // Dosyaların saklanacağı dizi
    let uploadedFilesCount = 0; // Arka planda yüklenen dosyalar
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

    // ---------- Mikrofon Kaydı ---------- //
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
                        // Mesaj kutusu kullan
                        const msgBox = document.createElement('div');
                        msgBox.textContent = 'Ses kaydınız yüklenemedi.';
                        msgBox.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%, -50%);background:white;padding:20px;border:1px solid #ccc;z-index:1000;';
                        document.body.appendChild(msgBox);
                        setTimeout(() => msgBox.remove(), 3000);
                    }
                })
                .catch(error => {
                    console.error("Ses yükleme hatası:", error);
                    // Mesaj kutusu kullan
                    const msgBox = document.createElement('div');
                    msgBox.textContent = 'Ses kaydı yüklenirken bir hata oluştu.';
                    msgBox.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%, -50%);background:white;padding:20px;border:1px solid #ccc;z-index:1000;';
                    document.body.appendChild(msgBox);
                    setTimeout(() => msgBox.remove(), 3000);
                });
            });

            startBtn.disabled = true;
            stopBtn.disabled = false;
        } catch (err) {
            console.error("Mikrofon erişim hatası:", err);
            // Mesaj kutusu kullan
            const msgBox = document.createElement('div');
            msgBox.textContent = 'Mikrofon erişimi reddedildi veya bir hata oluştu.';
            msgBox.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%, -50%);background:white;padding:20px;border:1px solid #ccc;z-index:1000;';
            document.body.appendChild(msgBox);
            setTimeout(() => msgBox.remove(), 3000);
        }
    });

    stopBtn.addEventListener("click", () => {
        if (mediaRecorder && mediaRecorder.state === "recording") {
            mediaRecorder.stop();
        }
        startBtn.disabled = false;
        stopBtn.disabled = true;
    });

    // ---------- Dosya Seçimi ve Önizleme ---------- //
    const fileInput = document.getElementById('real-file');
    const previewContainer = document.getElementById('uploadPreview');
    const uploadText = document.getElementById('uploadText');

    fileInput.addEventListener('change', () => {
        const newFiles = Array.from(fileInput.files);
        selectedFiles = [...selectedFiles, ...newFiles];
        totalFilesToUpload = selectedFiles.length;

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
                    video.onloadeddata = function() { video.currentTime = 0; };
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

        // ---------- Arka planda S3 Yükleme ---------- //
        selectedFiles.forEach(file => uploadFileToS3(file));
    });

    function uploadFileToS3(file) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("name", document.querySelector("input[name='name']").value);

        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener('progress', function(event) {
            // Burada toplam yükleme ilerlemesini ayrı gösterebiliriz
        });
        xhr.addEventListener('load', function() {
            uploadedFilesCount++;
            const percentComplete = (uploadedFilesCount / totalFilesToUpload) * 100;
            uploadProgressBar.style.width = percentComplete.toFixed(0) + '%';
            uploadProgressText.textContent = percentComplete.toFixed(0) + '%';
            
            // OTOMATIK YÖNLENDİRME KALDIRILDI - Sadece progress bar güncellemesi yapılıyor
            console.log(`Dosya yüklendi: ${uploadedFilesCount}/${totalFilesToUpload}`);
        });
        xhr.addEventListener('error', function() {
            console.error("Dosya yükleme hatası:", file.name);
        });
        xhr.open('POST', mainForm.action);
        xhr.send(formData);
    }

    // ---------- Gönder Butonu ---------- //
    mainForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        if (submitBtn) {
            submitBtn.textContent = 'Yükleniyor...';
            submitBtn.disabled = true;
            uploadProgressBarContainer.style.display = 'block';
        }
        
        // SADECE GÖNDER BUTONUNA BASILDIĞINDA YÖNLENDİRME YAPILACAK
        // Kullanıcının buton basmasını bekle, sonra yönlendir
        setTimeout(() => { 
            window.location.href = mainForm.action; 
        }, 500);
    });
});
