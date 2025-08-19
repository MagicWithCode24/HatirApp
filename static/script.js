document.addEventListener("DOMContentLoaded", function () {
    let mediaRecorder;
    let audioChunks = [];
    let selectedFiles = []; // Tüm dosyalar burada birikecek
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
    const audioPreview = document.getElementById("audioPreview");

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
                const audioFile = new File([audioBlob], "recording.wav", { type: 'audio/wav' });

                // Ses kaydını selectedFiles dizisine ekle
                selectedFiles.push(audioFile);

                audioPreview.innerHTML = "";
                const audio = document.createElement("audio");
                audio.controls = true;
                audio.src = audioUrl;

                const label = document.createElement("p");
                label.textContent = "Kaydınız:";

                audioPreview.appendChild(label);
                audioPreview.appendChild(audio);

                // Dosya önizlemesini güncelle
                updateFilePreview();
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
        selectedFiles = [...selectedFiles, ...newFiles]; // Mevcut dosyalara yenilerini ekle

        updateFilePreview();
    });
    
    function updateFilePreview() {
        previewContainer.innerHTML = '';
        const filesToPreview = selectedFiles.filter(file => file.type.startsWith("image/") || file.type.startsWith("video/"));

        if (filesToPreview.length > 0) {
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
            const percentComplete = (loadedCount / filesToPreview.length) * 100;
            filePreviewProgressBar.style.width = percentComplete.toFixed(0) + '%';
            filePreviewProgressText.textContent = percentComplete.toFixed(0) + '%';

            if (loadedCount === filesToPreview.length) {
                filePreviewProgressBar.style.backgroundColor = '#4CAF50';
                filePreviewProgressText.textContent = 'Tamamlandı!';
                setTimeout(() => {
                    filePreviewProgressBarContainer.style.display = 'none';
                    filePreviewProgressBar.style.backgroundColor = '#6a0dad';
                }, 1500);
            }
        };

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
                    video.onloadeddata = function () {
                        video.currentTime = 0;
                    };
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
    }

    // Yeni dosya yükleme fonksiyonu
    function uploadFilesSequentially(files, index = 0) {
        if (index >= files.length) {
            // Tüm dosyalar başarıyla yüklendi, yönlendir
            uploadProgressBar.style.width = '100%';
            uploadProgressBar.style.backgroundColor = '#4CAF50';
            uploadProgressText.textContent = 'Tüm dosyalar yüklendi!';
            
            setTimeout(() => {
                window.location.href = '/son';
            }, 700);
            return;
        }

        const file = files[index];
        const formData = new FormData();
        const username = document.querySelector("input[name='name']").value;
        const note = document.querySelector("textarea[name='note']").value;

        // Kullanıcı adını her zaman gönder
        formData.append("name", username);
        
        // Notu sadece ilk dosyayla birlikte gönder
        if (index === 0) {
            formData.append("note", note);
        }

        formData.append("file", file);

        const xhr = new XMLHttpRequest();
        xhr.timeout = 300000; // 5 dakika

        xhr.upload.addEventListener('progress', function (event) {
            if (event.lengthComputable) {
                const totalBytes = selectedFiles.reduce((sum, f) => sum + f.size, 0);
                const loadedBytes = files.slice(0, index).reduce((sum, f) => sum + f.size, 0) + event.loaded;
                
                const percentComplete = (loadedBytes / totalBytes) * 100;
                uploadProgressBar.style.width = percentComplete.toFixed(0) + '%';
                uploadProgressText.textContent = `${percentComplete.toFixed(0)}% (${index + 1}/${files.length} dosya)`;
            }
        });

        xhr.addEventListener('load', function () {
            if (xhr.status === 200 || xhr.status === 302) {
                // Başarılı yükleme, bir sonraki dosyayı yükle
                uploadFilesSequentially(files, index + 1);
            } else {
                alert(`Dosya yüklenirken bir hata oluştu: ${file.name}`);
                submitBtn.textContent = 'Gönder';
                submitBtn.disabled = false;
                uploadProgressBarContainer.style.display = 'none';
            }
        });

        xhr.addEventListener('error', function () {
            alert('Ağ hatası veya sunucuya ulaşılamadı. Lütfen internet bağlantınızı kontrol edin.');
            submitBtn.textContent = 'Gönder';
            submitBtn.disabled = false;
            uploadProgressBarContainer.style.display = 'none';
        });

        xhr.addEventListener('timeout', function () {
            alert('Yükleme çok uzun sürdü. Lütfen dosya boyutlarınızı kontrol edin.');
            submitBtn.textContent = 'Gönder';
            submitBtn.disabled = false;
            uploadProgressBarContainer.style.display = 'none';
        });

        xhr.open('POST', mainForm.action);
        xhr.send(formData);
    }
    
    // Form gönderimini ele al
    mainForm.addEventListener('submit', function (e) {
        e.preventDefault();

        const username = document.querySelector("input[name='name']").value;
        if (!username) {
            alert('Lütfen isminizi girin!');
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

        // Tüm dosyaları sırayla yüklemeye başla
        uploadFilesSequentially(selectedFiles);
    });
});
