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

    // Mobil cihaz kontrolü
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
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

    // Mobil optimizasyon: Image resize fonksiyonu
    function resizeImageForMobile(file, maxWidth = 1200, quality = 0.85) {
        return new Promise((resolve) => {
            if (!file.type.startsWith('image/')) {
                resolve(file);
                return;
            }

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            img.onload = function() {
                // Orijinal boyutlar
                let { width, height } = img;
                
                // Mobilde daha agresif küçültme
                const mobileMaxWidth = isMobile ? 800 : maxWidth;
                
                if (width > mobileMaxWidth || height > mobileMaxWidth) {
                    const ratio = Math.min(mobileMaxWidth / width, mobileMaxWidth / height);
                    width *= ratio;
                    height *= ratio;
                }

                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                
                canvas.toBlob((blob) => {
                    const resizedFile = new File([blob], file.name, {
                        type: file.type,
                        lastModified: Date.now()
                    });
                    console.log(`${file.name}: ${(file.size/1024/1024).toFixed(2)}MB -> ${(resizedFile.size/1024/1024).toFixed(2)}MB`);
                    resolve(resizedFile);
                }, file.type, quality);
                
                // Memory temizleme
                URL.revokeObjectURL(img.src);
            };

            img.src = URL.createObjectURL(file);
        });
    }

    // Dosya boyutu ve sayı kontrolü
    function validateFiles(files) {
        const maxFileSize = isMobile ? 5 * 1024 * 1024 : 15 * 1024 * 1024; // Mobil: 5MB, Desktop: 15MB
        const maxFileCount = isMobile ? 6 : 10; // Mobil: 6 dosya, Desktop: 10 dosya
        
        if (files.length > maxFileCount) {
            alert(`${isMobile ? 'Mobil cihazlarda' : 'Bu cihazda'} en fazla ${maxFileCount} dosya seçebilirsiniz.`);
            return false;
        }

        const oversizedFiles = [];
        for (let file of files) {
            if (file.size > maxFileSize) {
                oversizedFiles.push(`${file.name} (${(file.size/1024/1024).toFixed(1)}MB)`);
            }
        }
        
        if (oversizedFiles.length > 0) {
            alert(`Bu dosyalar çok büyük (${(maxFileSize/1024/1024)}MB üzeri):\n${oversizedFiles.join('\n')}\n\nLütfen daha küçük dosyalar seçin.`);
            return false;
        }
        return true;
    }

    // Lightweight preview oluşturma (mobil için optimize)
    async function createLightweightPreview(file) {
        if (file.type.startsWith("image/")) {
            return new Promise(resolve => {
                const reader = new FileReader();
                reader.onload = function (e) {
                    const img = document.createElement("img");
                    img.src = e.target.result;
                    img.style.cssText = 'width:80px;height:100px;object-fit:cover;border-radius:8px;border:2px solid #ddd;margin-right:10px;margin-bottom:10px;';
                    resolve(img);
                };
                reader.readAsDataURL(file);
            });
        } else if (file.type.startsWith("video/")) {
            // Mobilde video preview'ı basitleştir
            const videoDiv = document.createElement('div');
            videoDiv.style.cssText = 'width:80px;height:100px;border:2px dashed #6a0dad;display:flex;align-items:center;justify-content:center;font-size:12px;text-align:center;color:#6a0dad;border-radius:8px;margin-right:10px;margin-bottom:10px;';
            videoDiv.innerHTML = `📹<br>Video<br>${file.name.substring(0,8)}...`;
            return Promise.resolve(videoDiv);
        } else {
            // Diğer dosya türleri
            const fileDiv = document.createElement('div');
            fileDiv.style.cssText = 'width:80px;height:100px;border:2px dashed #ccc;display:flex;align-items:center;justify-content:center;font-size:10px;text-align:center;color:#888;border-radius:8px;margin-right:10px;margin-bottom:10px;';
            fileDiv.innerHTML = `📄<br>${file.name.substring(0,8)}...`;
            return Promise.resolve(fileDiv);
        }
    }

    fileInput.addEventListener('change', async () => {
        const newFiles = Array.from(fileInput.files);
        
        // Dosya validasyonu
        if (!validateFiles(newFiles)) {
            fileInput.value = '';
            return;
        }

        // Loading göster
        previewContainer.innerHTML = '<div style="text-align:center;padding:20px;color:#6a0dad;">📁 Dosyalar hazırlanıyor...</div>';
        uploadText.style.display = "none";

        try {
            // Dosyaları resize et (sadece image'lar için)
            const resizedFiles = [];
            for (let file of newFiles) {
                const resizedFile = await resizeImageForMobile(file);
                resizedFiles.push(resizedFile);
            }
            selectedFiles = resizedFiles;

            // Lightweight preview'ları oluştur
            previewContainer.innerHTML = '';
            const maxPreview = isMobile ? 6 : 8;
            
            for (let i = 0; i < Math.min(selectedFiles.length, maxPreview); i++) {
                const preview = await createLightweightPreview(selectedFiles[i]);
                previewContainer.appendChild(preview);
            }

            // Eğer daha fazla dosya varsa +X göster
            if (selectedFiles.length > maxPreview) {
                const extraDiv = document.createElement('div');
                extraDiv.style.cssText = 'width:80px;height:100px;border:2px solid #6a0dad;background:#6a0dad;color:white;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:bold;border-radius:8px;margin-right:10px;margin-bottom:10px;';
                extraDiv.textContent = `+${selectedFiles.length - maxPreview}`;
                previewContainer.appendChild(extraDiv);
            }

            console.log(`${selectedFiles.length} dosya hazırlandı. Toplam boyut: ${(selectedFiles.reduce((total, file) => total + file.size, 0) / 1024 / 1024).toFixed(2)}MB`);

        } catch (error) {
            console.error('Dosya hazırlama hatası:', error);
            alert('Dosyalar hazırlanırken bir hata oluştu. Lütfen tekrar deneyin.');
            fileInput.value = '';
            selectedFiles = [];
            previewContainer.innerHTML = '';
            uploadText.style.display = "block";
        }
    });

    // Optimize edilmiş form submit
    mainForm.addEventListener('submit', function(e) {
        e.preventDefault();

        if (submitBtn) {
            submitBtn.textContent = 'Gönderiliyor...';
            submitBtn.disabled = true;
            uploadProgressBarContainer.style.display = 'block';
            uploadProgressBar.style.width = '0%';
            uploadProgressText.textContent = 'Başlıyor...';
            uploadProgressBar.style.backgroundColor = '#6a0dad';
        }

        const formData = new FormData(mainForm);

        // Resize edilmiş dosyaları ekle
        selectedFiles.forEach(file => {
            formData.append("file", file);
        });

        const xhr = new XMLHttpRequest();

        // Mobil için daha kısa timeout
        xhr.timeout = isMobile ? 120000 : 180000; // Mobil: 2dk, Desktop: 3dk

        xhr.upload.addEventListener('progress', function(event) {
            if (event.lengthComputable) {
                const percentComplete = (event.loaded / event.total) * 100;
                uploadProgressBar.style.width = percentComplete.toFixed(0) + '%';
                uploadProgressText.textContent = `${percentComplete.toFixed(0)}% Yükleniyor...`;
            }
        });

        xhr.addEventListener('load', function() {
            if (xhr.status === 200 || xhr.status === 302) {
                uploadProgressBar.style.width = '100%';
                uploadProgressBar.style.backgroundColor = '#4CAF50';
                uploadProgressText.textContent = '100% Tamamlandı!';

                setTimeout(() => {
                    window.location.href = mainForm.action;
                }, 1000);

            } else {
                alert('Dosyalar yüklenirken bir hata oluştu. Lütfen tekrar deneyin.');
                console.error('Sunucu yanıtı:', xhr.responseText);
                resetSubmitButton();
            }
        });

        xhr.addEventListener('error', function() {
            alert('Ağ hatası. Lütfen internet bağlantınızı kontrol edin ve tekrar deneyin.');
            resetSubmitButton();
        });

        xhr.addEventListener('timeout', function() {
            alert(`Yükleme zaman aşımına uğradı (${isMobile ? '2' : '3'} dakika). Dosya sayısını veya boyutunu azaltın.`);
            resetSubmitButton();
        });

        function resetSubmitButton() {
            submitBtn.textContent = 'Gönder';
            submitBtn.disabled = false;
            uploadProgressBarContainer.style.display = 'none';
        }

        xhr.open('POST', mainForm.action);
        xhr.send(formData);
    });

    // Memory temizleme fonksiyonu
    function cleanupMemory() {
        // Eski preview'ları temizle
        const imgs = previewContainer.querySelectorAll('img');
        imgs.forEach(img => {
            if (img.src.startsWith('blob:')) {
                URL.revokeObjectURL(img.src);
            }
        });
    }

    // Sayfa kapanırken memory temizle
    window.addEventListener('beforeunload', cleanupMemory);
});
