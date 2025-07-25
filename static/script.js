document.addEventListener("DOMContentLoaded", function () {
    let mediaRecorder;
    let audioChunks = [];

    const micBtn = document.getElementById("micBtn");
    const recordPanel = document.getElementById("recordPanel");
    const startBtn = document.getElementById("startBtn");
    const stopBtn = document.getElementById("stopBtn");
    const submitBtn = document.getElementById("submitBtn"); 
    const mainForm = document.getElementById("mainForm"); 

    // Yükleme çubuğu elementleri (Ana Gönderim için)
    const uploadProgressBarContainer = document.getElementById("uploadProgressBarContainer");
    const uploadProgressBar = document.getElementById("uploadProgressBar");
    const uploadProgressText = document.getElementById("uploadProgressText");

    // Dosya Önizleme Yükleme Çubuğu elementleri
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
        const files = Array.from(fileInput.files);
        previewContainer.innerHTML = '';

        if (files.length > 0) {
            uploadText.style.display = "none";
            previewContainer.style.minHeight = "100px";
            // Dosya seçildiğinde önizleme ilerleme çubuğunu göster
            filePreviewProgressBarContainer.style.display = 'block';
            filePreviewProgressBar.style.width = '0%';
            filePreviewProgressText.textContent = '0%';
        } else {
            uploadText.style.display = "block";
            previewContainer.style.minHeight = "auto";
            filePreviewProgressBarContainer.style.display = 'none'; // Dosya yoksa gizle
        }

        const maxNormalPreview = 2;
        const maxOverlayPreview = 3;

        let allPreviews = [];
        let loadedCount = 0; // Yüklenen dosya/önizleme sayısı

        // Yükleme ilerlemesini güncelleyen yardımcı fonksiyon
        const updateFilePreviewProgress = () => {
            loadedCount++;
            const percentComplete = (loadedCount / files.length) * 100;
            filePreviewProgressBar.style.width = percentComplete.toFixed(0) + '%';
            filePreviewProgressText.textContent = percentComplete.toFixed(0) + '%';

            if (loadedCount === files.length) {
                // Tüm önizlemeler yüklendiğinde çubuğu yeşile çevir ve metni "Tamamlandı" yap
                filePreviewProgressBar.style.backgroundColor = '#4CAF50'; 
                filePreviewProgressText.textContent = 'Tamamlandı!';
                setTimeout(() => {
                    filePreviewProgressBarContainer.style.display = 'none'; // Bir süre sonra gizle
                    filePreviewProgressBar.style.backgroundColor = '#6a0dad'; // Renki sıfırla
                }, 1500); // 1.5 saniye sonra gizle
            }
        };


        files.forEach(file => {
            if (file.type.startsWith("image/")) {
                allPreviews.push(new Promise(resolve => {
                    const reader = new FileReader();
                    reader.onload = function (e) {
                        const img = document.createElement("img");
                        img.src = e.target.result;
                        updateFilePreviewProgress(); // Her dosya yüklendiğinde ilerlemeyi güncelle
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
                        updateFilePreviewProgress(); // Her dosya yüklendiğinde ilerlemeyi güncelle
                        resolve(img);
                    };
                    video.onerror = function() {
                        console.error("Video yüklenemedi veya işlenemedi:", file.name);
                        const errorDiv = document.createElement('div');
                        errorDiv.textContent = 'Video önizlemesi yüklenemedi.';
                        errorDiv.style.cssText = 'width:80px;height:100px;border:2px dashed #ccc;display:flex;align-items:center;justify-content:center;font-size:10px;text-align:center;color:#888;overflow:hidden;';
                        updateFilePreviewProgress(); // Hata olsa bile ilerlemeyi güncelle
                        resolve(errorDiv);
                    };
                }));
            } else {
                // Diğer dosya türleri için de ilerlemeyi güncelle
                updateFilePreviewProgress(); 
                allPreviews.push(Promise.resolve(null)); // null döndürerek ilerlemenin etkilenmesini sağla
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
            // Tüm önizlemeler işlendikten sonra çubuk tam görünmelidir, bu yüzden buraya taşıdık.
            // Zaten updateFilePreviewProgress içinde handle ediliyor.
        });
    });

    // Form gönderildiğinde buton metnini değiştirme ve yüklemeyi yönetme
    mainForm.addEventListener('submit', function(e) {
        e.preventDefault(); // Formun normal gönderimini engelle

        if (submitBtn) {
            submitBtn.textContent = 'Yükleniyor...';
            submitBtn.disabled = true; 
            // Ana yükleme çubuğunu göster ve sıfırla
            uploadProgressBarContainer.style.display = 'block';
            uploadProgressBar.style.width = '0%';
            uploadProgressText.textContent = '0%';
            uploadProgressBar.style.backgroundColor = '#4CAF50'; // Renk sıfırlama
        }

        const formData = new FormData(mainForm); 

        const xhr = new XMLHttpRequest();

        // Yükleme ilerlemesini dinle
        xhr.upload.addEventListener('progress', function(event) {
            if (event.lengthComputable) {
                const percentComplete = (event.loaded / event.total) * 100;
                uploadProgressBar.style.width = percentComplete.toFixed(0) + '%';
                uploadProgressText.textContent = percentComplete.toFixed(0) + '%';
            }
        });

        // Yükleme tamamlandığında veya hata oluştuğunda
        xhr.addEventListener('load', function() {
            // Sunucudan gelen yanıtı işle (şu an JSON değil, redirect bekliyoruz)
            // Flask'taki flash mesajları ve redirect hala çalışacak
            if (xhr.status === 200 || xhr.status === 302) { 
                uploadProgressBar.style.width = '100%';
                uploadProgressBar.style.backgroundColor = '#4CAF50'; // Yükleme tamamlandığında yeşil yap
                uploadProgressText.textContent = '100% Tamamlandı!';

                // Kısa bir gecikme sonrası son sayfaya yönlendir
                setTimeout(() => {
                    window.location.href = mainForm.action; 
                }, 700); // 0.7 saniye sonra yönlendir
                
            } else {
                alert('Dosyalar yüklenirken bir hata oluştu. Lütfen tekrar deneyin.');
                console.error('Sunucu yanıtı:', xhr.responseText);
                submitBtn.textContent = 'Gönder';
                submitBtn.disabled = false;
                uploadProgressBarContainer.style.display = 'none';
            }
        });

        xhr.addEventListener('error', function() {
            alert('Ağ hatası veya sunucuya ulaşılamadı. Lütfen internet bağlantınızı kontrol edin.');
            submitBtn.textContent = 'Gönder';
            submitBtn.disabled = false;
            uploadProgressBarContainer.style.display = 'none';
        });

        xhr.open('POST', mainForm.action); 
        xhr.send(formData); 
    });
});
