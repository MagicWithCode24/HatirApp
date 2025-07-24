document.addEventListener("DOMContentLoaded", function () {
    let mediaRecorder;
    let audioChunks = [];

    const micBtn = document.getElementById("micBtn");
    const recordPanel = document.getElementById("recordPanel");
    const startBtn = document.getElementById("startBtn");
    const stopBtn = document.getElementById("stopBtn");
    // Yeni eklenenler
    const submitBtn = document.getElementById("submitBtn"); // Gönder butonunu seçiyoruz
    const mainForm = document.querySelector("form"); // Formu seçiyoruz

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
        } else {
            uploadText.style.display = "block";
            previewContainer.style.minHeight = "auto";
        }

        const maxNormalPreview = 2;
        const maxOverlayPreview = 3;

        let allPreviews = [];

        files.forEach(file => {
            if (file.type.startsWith("image/")) {
                allPreviews.push(new Promise(resolve => {
                    const reader = new FileReader();
                    reader.onload = function (e) {
                        const img = document.createElement("img");
                        img.src = e.target.result;
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
                        resolve(img);
                    };
                    video.onerror = function() {
                        console.error("Video yüklenemedi veya işlenemedi:", file.name);
                        const errorDiv = document.createElement('div');
                        errorDiv.textContent = 'Video önizlemesi yüklenemedi.';
                        errorDiv.style.cssText = 'width:80px;height:100px;border:2px dashed #ccc;display:flex;align-items:center;justify-content:center;font-size:10px;text-align:center;color:#888;overflow:hidden;';
                        resolve(errorDiv);
                    };
                }));
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

    // Form gönderildiğinde buton metnini değiştirme
    mainForm.addEventListener('submit', function() {
        if (submitBtn) {
            submitBtn.textContent = 'Yükleniyor...';
            submitBtn.disabled = true; // Kullanıcının tekrar basmasını engelle
        }
    });
});
