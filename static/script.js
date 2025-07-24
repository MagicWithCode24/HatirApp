document.addEventListener("DOMContentLoaded", function () {
    let mediaRecorder;
    let audioChunks = [];

    const micBtn = document.getElementById("micBtn");
    const recordPanel = document.getElementById("recordPanel");
    const startBtn = document.getElementById("startBtn");
    const stopBtn = document.getElementById("stopBtn");

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
                .then(response => {
                    // Yanıtın durum kodunu kontrol et
                    if (response.ok) { // HTTP durumu 200-299 arasında ise başarılıdır
                        alert("Ses kaydınız başarıyla yüklendi!");
                        // Sayfa yönlendirmesi sunucu tarafında yapıldığı için burada bir şey yapmaya gerek yok
                    } else {
                        // Eğer sunucudan bir hata kodu gelirse (örn: 500)
                        console.error("Ses yükleme sunucu hatası:", response.status, response.statusText);
                        alert("Ses kaydınız yüklenemedi. (Sunucu hatası)");
                    }
                })
                .catch(error => {
                    console.error("Ses yükleme ağ hatası:", error);
                    alert("Ses kaydı yüklenirken bir sorun oluştu. (Ağ hatası)");
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
    const uploadProgressBar = document.getElementById('uploadProgressBar');
    const uploadProgressText = document.getElementById('uploadProgressText');
    const uploadProgressContainer = document.querySelector('.upload-progress-container');

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

        const simulateFileUpload = (file, index) => {
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
                const progressPercentage = (loadedFilesCount / totalFiles) * 100;
                uploadProgressBar.style.width = `${progressPercentage}%`;
                uploadProgressText.textContent = `${Math.round(progressPercentage)}%`;

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

                if (loadedFilesCount === totalFiles) {
                    uploadProgressBar.classList.add('complete');
                }
                resolve();
            });
        };

        for (let i = 0; i < totalFiles; i++) {
            await simulateFileUpload(files[i], i);
        }
    });
});
