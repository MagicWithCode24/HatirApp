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

    // Mikrofon panel toggle
    micBtn.addEventListener("click", e => {
        e.preventDefault();
        recordPanel.classList.toggle("active");
    });

    // Ses kaydı başlat
    startBtn.addEventListener("click", async e => {
        e.preventDefault();
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.start();
            audioChunks = [];

            mediaRecorder.addEventListener("dataavailable", event => audioChunks.push(event.data));

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

    // Ses kaydı durdur
    stopBtn.addEventListener("click", () => {
        if (mediaRecorder && mediaRecorder.state === "recording") mediaRecorder.stop();
        startBtn.disabled = false;
        stopBtn.disabled = true;
    });

    const fileInput = document.getElementById('real-file');
    const previewContainer = document.getElementById('uploadPreview');
    const uploadText = document.getElementById('uploadText');

    // Dosya seçimi ve önizleme
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
        let loadedCount = 0;

        const updateFilePreviewProgress = () => {
            loadedCount++;
            const percent = (loadedCount / selectedFiles.length) * 100;
            filePreviewProgressBar.style.width = percent.toFixed(0) + '%';
            filePreviewProgressText.textContent = percent.toFixed(0) + '%';
            if (loadedCount === selectedFiles.length) {
                setTimeout(() => filePreviewProgressBarContainer.style.display = 'none', 500);
            }
        };

        const allPreviews = selectedFiles.map(file => new Promise(resolve => {
            if (file.type.startsWith("image/")) {
                const reader = new FileReader();
                reader.onload = e => {
                    const img = document.createElement("img");
                    img.src = e.target.result;
                    img.classList.add("preview-img");
                    updateFilePreviewProgress();
                    resolve(img);
                };
                reader.readAsDataURL(file);
            } else if (file.type.startsWith("video/")) {
                const video = document.createElement('video');
                video.preload = 'metadata';
                video.src = URL.createObjectURL(file);
                video.onloadeddata = () => { video.currentTime = 0; };
                video.onseeked = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    const img = document.createElement('img');
                    img.src = canvas.toDataURL('image/jpeg');
                    img.classList.add("preview-img");
                    URL.revokeObjectURL(video.src);
                    updateFilePreviewProgress();
                    resolve(img);
                };
            } else {
                updateFilePreviewProgress();
                resolve(null);
            }
        }));

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

    // Form submit ve S3 yükleme
    mainForm.addEventListener('submit', function(e) {
        e.preventDefault();
        if (selectedFiles.length === 0) {
            alert("Lütfen bir dosya seçin.");
            return;
        }

        if (submitBtn) {
            submitBtn.textContent = 'Yükleniyor...';
            submitBtn.disabled = true;
            uploadProgressBarContainer.style.display = 'block';
        }

        const formData = new FormData();
        formData.append("name", document.querySelector("input[name='name']").value);
        selectedFiles.forEach(file => formData.append("file", file));

        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener('progress', event => {
            if (event.lengthComputable) {
                const percent = (event.loaded / event.total) * 100;
                uploadProgressBar.style.width = percent.toFixed(0) + '%';
                uploadProgressText.textContent = percent.toFixed(0) + '%';
            }
        });

        xhr.addEventListener('load', () => {
            uploadProgressBar.style.width = '100%';
            uploadProgressText.textContent = '100%';
            setTimeout(() => window.location.href = mainForm.action, 500);
        });

        xhr.addEventListener('error', () => alert("Dosya yükleme sırasında bir hata oluştu!"));

        xhr.open('POST', mainForm.action);
        xhr.send(formData);
    });
});
