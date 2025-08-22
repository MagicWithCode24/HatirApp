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
        const newFiles = Array.from(fileInput.files);
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

        // Sadece ilk 4 dosyanın önizlemesini yükle
        const maxPreviewFiles = 4;
        const filesToPreview = selectedFiles.slice(0, maxPreviewFiles);
        
        filesToPreview.forEach(file => {
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
        
        // Kalan dosyalar için progress'i otomatik olarak tamamla
        for (let i = filesToPreview.length; i < selectedFiles.length; i++) {
            updateFilePreviewProgress();
        }

        Promise.all(allPreviews).then(results => {
            const validPreviews = results.filter(el => el !== null);
            
            // Sadece normal preview'ları göster (max 2 adet)
            validPreviews.slice(0, maxNormalPreview).forEach(el => previewContainer.appendChild(el));
            
            // Toplam dosya sayısına göre extra count'u hesapla
            const totalFilesCount = selectedFiles.length;
            const shownPreviewsCount = Math.min(validPreviews.length, maxNormalPreview);
            const totalExtraCount = totalFilesCount - shownPreviewsCount;
            
            if (totalExtraCount > 0) {
                const overlayStackContainer = document.createElement("div");
                overlayStackContainer.className = "overlay-stack-container";
                const slideDistance = 3.75;
                
                // Kalan preview'ları overlay olarak göster (varsa)
                const overlayPreviews = validPreviews.slice(maxNormalPreview, maxNormalPreview + maxOverlayPreview);
                overlayPreviews.forEach((el, index) => {
                    el.classList.add("overlay");
                    el.style.left = `${index * slideDistance}px`;
                    el.style.zIndex = maxOverlayPreview - index;
                    overlayStackContainer.appendChild(el);
                });
                
                // Extra count'u göster
                const extra = document.createElement("div");
                extra.className = "extra-count";
                extra.textContent = `+${totalExtraCount}`;
                overlayStackContainer.appendChild(extra);
                
                previewContainer.appendChild(overlayStackContainer);
            }
            
            // Android sınırı uyarısı
            if (selectedFiles.length >= 100) {
                alert("📱 Daha fazla foto eklemek için tekrar dosya seçme bölümüne tıklayın");
            }
        });
    });

    mainForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        if (selectedFiles.length === 0) {
            alert("Lütfen yüklenecek bir dosya seçin veya ses kaydı yapın.");
            return;
        }

        // Dosya sayısı ve boyut bilgisi göster
        const totalSize = selectedFiles.reduce((sum, file) => sum + file.size, 0);
        const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);
        console.log(`${selectedFiles.length} dosya yükleniyor, toplam boyut: ${totalSizeMB}MB`);

        if (submitBtn) {
            submitBtn.textContent = `Yükleniyor... (${selectedFiles.length} dosya)`;
            submitBtn.disabled = true;
            uploadProgressBarContainer.style.display = 'block';
            uploadProgressBar.style.width = '0%';
            uploadProgressText.textContent = '0%';
        }

        // Tek büyük FormData oluştur - sınır yok!
        const formData = new FormData();
        
        // İsim verisini ekle
        formData.append("name", document.querySelector("input[name='name']").value);
        
        // Not içeriğini kontrol et ve ekle
        const noteContent = document.querySelector("textarea[name='note']").value;
        if (noteContent.trim() !== "") {
            const noteFile = new File([noteContent], "note.txt", { type: "text/plain" });
            formData.append("files", noteFile);
        }
        
        // TÜM dosyaları tek seferde ekle - 1000 dosya olsa bile!
        selectedFiles.forEach((file, index) => {
            formData.append("files", file);
        });

        // Tek dev XMLHttpRequest ile gönder
        const xhr = new XMLHttpRequest();
        
        // Upload progress - gerçek zamanlı
        xhr.upload.addEventListener('progress', function(event) {
            if (event.lengthComputable) {
                const percentComplete = (event.loaded / event.total) * 100;
                const loadedMB = (event.loaded / (1024 * 1024)).toFixed(2);
                const totalMB = (event.total / (1024 * 1024)).toFixed(2);
                
                uploadProgressBar.style.width = percentComplete.toFixed(0) + '%';
                uploadProgressText.textContent = `${percentComplete.toFixed(0)}% (${loadedMB}/${totalMB}MB)`;
            }
        });
        
        xhr.addEventListener('load', function() {
            if (xhr.status === 200) {
                uploadProgressBar.style.width = '100%';
                uploadProgressText.textContent = `100% - Tamamlandı! (${totalSizeMB}MB)`;
                console.log(`✅ ${selectedFiles.length} dosya başarıyla yüklendi`);
                setTimeout(() => { 
                    window.location.href = mainForm.action; 
                }, 1000);
            } else {
                console.error("Yükleme hatası:", xhr.status, xhr.statusText);
                alert(`Dosyalar yüklenirken hata oluştu (${xhr.status}): ${xhr.statusText}`);
                resetUploadButton();
            }
        });
        
        xhr.addEventListener('error', function() {
            console.error("Network hatası - büyük dosyalar için sunucu ayarlarını kontrol edin");
            alert("Yükleme sırasında network hatası oluştu. Dosyalar çok büyükse sunucu limitlerini kontrol edin.");
            resetUploadButton();
        });

        // Timeout için daha uzun süre - büyük yüklemeler için
        xhr.timeout = 1200000; // 5 dakika
        xhr.addEventListener('timeout', function() {
            console.error("Timeout - yükleme çok uzun sürdü");
            alert("Yükleme zaman aşımına uğradı. Dosyalar çok büyük olabilir.");
            resetUploadButton();
        });

        xhr.open('POST', mainForm.action);
        xhr.send(formData);
    });

    function resetUploadButton() {
        if (submitBtn) {
            submitBtn.textContent = 'Yükle';
            submitBtn.disabled = false;
            uploadProgressBarContainer.style.display = 'none';
        }
    }
});


