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

    // DEBUG: Sayfa yüklendiğinde cihaz bilgisi
    alert("Sayfa yüklendi - Cihaz: " + navigator.userAgent);

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
                
                // DEBUG: Ses kaydı eklendi
                alert("Ses kaydı eklendi! Toplam dosya: " + selectedFiles.length);
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
        // DEBUG: Seçilen dosyalar
        const newFiles = Array.from(fileInput.files);
        alert("FileInput'dan seçilen dosya sayısı: " + newFiles.length + "\nDosya isimleri: " + newFiles.map(f => f.name).join(", "));
        
        selectedFiles = [...selectedFiles, ...newFiles];
        
        // DEBUG: Tüm selectedFiles
        alert("Tüm selectedFiles: " + selectedFiles.length + " dosya\n" + selectedFiles.map(f => f.name + " (" + f.type + ")").join("\n"));

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

    mainForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        if (selectedFiles.length === 0) {
            alert("Lütfen yüklenecek bir dosya seçin veya ses kaydı yapın.");
            return;
        }

        // DEBUG: Gönderilecek dosyalar
        alert("GÖNDERİLECEK DOSYALAR:\n" + selectedFiles.map((f, i) => 
            (i+1) + ". " + f.name + " - " + f.type + " - " + (f.size/1024).toFixed(2) + "KB"
        ).join("\n"));

        if (submitBtn) {
            submitBtn.textContent = 'Yükleniyor...';
            submitBtn.disabled = true;
            uploadProgressBarContainer.style.display = 'block';
        }

        uploadedFilesCount = 0;
        totalFilesToUpload = selectedFiles.length;

        // DEBUG: Yükleme başlıyor
        alert("YÜKLEME BAŞLIYOR! Toplam " + totalFilesToUpload + " dosya yüklenecek.");

        selectedFiles.forEach((file, index) => {
            // DEBUG: Her dosya için bilgi
            alert("Yükleniyor (" + (index+1) + "/" + totalFilesToUpload + "): " + file.name);
            uploadFile(file, index);
        });
    });

    function uploadFile(file, index) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("name", document.querySelector("input[name='name']").value);
        
        // DEBUG: FormData içeriği
        let formDataInfo = "FormData içeriği:\n";
        for (let [key, value] of formData.entries()) {
            if (value instanceof File) {
                formDataInfo += key + ": " + value.name + " (" + value.type + ")\n";
            } else {
                formDataInfo += key + ": " + value + "\n";
            }
        }
        alert("FORM DATA (" + file.name + "):\n" + formDataInfo);

        const noteContent = document.querySelector("textarea[name='note']").value;
        if (noteContent.trim() !== "") {
            const noteFile = new File([noteContent], "note.txt", { type: "text/plain" });
            formData.append("file", noteFile);
            alert("Not dosyası eklendi: note.txt");
        }

        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', function(event) {
            // DEBUG: Upload progress
            console.log(file.name + " yükleniyor: " + ((event.loaded / event.total) * 100).toFixed(0) + "%");
        });
        
        xhr.addEventListener('load', function() {
            uploadedFilesCount++;
            const percentComplete = (uploadedFilesCount / totalFilesToUpload) * 100;
            uploadProgressBar.style.width = percentComplete.toFixed(0) + '%';
            uploadProgressText.textContent = percentComplete.toFixed(0) + '%';
            
            // DEBUG: Başarılı yükleme
            alert("✅ BAŞARILI: " + file.name + " yüklendi! (" + uploadedFilesCount + "/" + totalFilesToUpload + ")");
            
            if (uploadedFilesCount === totalFilesToUpload) {
                // DEBUG: Tüm yüklemeler tamamlandı
                alert("🎉 TÜM DOSYALAR YÜKLENDİ! Toplam: " + totalFilesToUpload + " dosya");
                setTimeout(() => { 
                    window.location.href = mainForm.action; 
                }, 500);
            }
        });
        
        xhr.addEventListener('error', function() {
            // DEBUG: Hata durumu
            alert("❌ HATA: " + file.name + " yüklenemedi!");
            console.error("Dosya yükleme hatası:", file.name);
        });
        
        xhr.addEventListener('abort', function() {
            // DEBUG: İptal durumu
            alert("⏹️ İPTAL: " + file.name + " yüklenmesi iptal edildi!");
        });

        xhr.open('POST', mainForm.action);
        
        // DEBUG: İstek gönderiliyor
        alert("🚀 İSTEK GÖNDERİLİYOR: " + file.name + " -> " + mainForm.action);
        
        xhr.send(formData);
    }
});
