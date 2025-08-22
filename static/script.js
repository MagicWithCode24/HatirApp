document.addEventListener("DOMContentLoaded", function () {
    let mediaRecorder;
    let audioChunks = [];
    let selectedFiles = [];
    let uploadedFilesCount = 0;
    let totalFilesToUpload = 0;
    let totalBytesToUpload = 0;
    let totalBytesUploaded = 0;

    const micBtn = document.getElementById("micBtn");
    const recordPanel = document.getElementById("recordPanel");
    const startBtn = document.getElementById("startBtn");
    const stopBtn = document.getElementById("stopBtn");
    const submitBtn = document.getElementById("submitBtn");
    const mainForm = document.getElementById("mainForm");
    const previewContainer = document.getElementById('uploadPreview');
    const uploadText = document.getElementById('uploadText');
    const uploadStatus = document.createElement('p'); // Genel "Başarıyla yüklendi" mesajı
    uploadStatus.style.marginTop = "10px";
    uploadStatus.style.color = "green";
    previewContainer.appendChild(uploadStatus);

    startBtn.style.display = "none";
    stopBtn.style.display = "none";
    startBtn.disabled = true;
    stopBtn.disabled = true;

    micBtn.addEventListener("click", (e) => {
        e.preventDefault();
        recordPanel.classList.toggle("active");
        if (recordPanel.classList.contains("active")) {
            startBtn.style.display = "inline-block";
            stopBtn.style.display = "inline-block";
            startBtn.disabled = false;
            stopBtn.disabled = true;
        } else {
            startBtn.style.display = "none";
            stopBtn.style.display = "none";
            startBtn.disabled = true;
            stopBtn.disabled = true;
        }
    });

    startBtn.addEventListener("click", async (e) => {
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

    stopBtn.addEventListener("click", () => {
        if (mediaRecorder && mediaRecorder.state === "recording") mediaRecorder.stop();
        startBtn.disabled = false;
        stopBtn.disabled = true;
    });

    // File seçme
    fileInput.addEventListener('change', () => {
        const newFiles = Array.from(fileInput.files);
        selectedFiles = [...selectedFiles, ...newFiles];

        previewContainer.innerHTML = '';
        if (selectedFiles.length > 0) {
            uploadText.style.display = "none";
        } else {
            uploadText.style.display = "block";
        }

        // Önizleme
        const maxNormalPreview = 2;
        const maxOverlayPreview = 3;
        let loadedCount = 0;
        const updatePreviewProgress = () => { loadedCount++; };

        selectedFiles.forEach(file => {
            if (file.type.startsWith("image/")) {
                const reader = new FileReader();
                reader.onload = function (e) {
                    const img = document.createElement("img");
                    img.src = e.target.result;
                    if (previewContainer.childElementCount < maxNormalPreview) {
                        previewContainer.appendChild(img);
                    } else {
                        let overlayContainer = previewContainer.querySelector(".overlay-stack-container");
                        if (!overlayContainer) {
                            overlayContainer = document.createElement("div");
                            overlayContainer.className = "overlay-stack-container";
                            previewContainer.appendChild(overlayContainer);
                        }
                        img.classList.add("overlay");
                        img.style.left = `${(overlayContainer.childElementCount) * 3.75}px`;
                        img.style.zIndex = maxOverlayPreview - overlayContainer.childElementCount;
                        overlayContainer.appendChild(img);
                    }
                    updatePreviewProgress();
                };
                reader.readAsDataURL(file);
            } else {
                updatePreviewProgress(); // video veya diğer dosyalar için placeholder
            }
        });
    });

    // Upload kısmı paralel ve throttling
    mainForm.addEventListener('submit', function(e) {
        e.preventDefault();
        if (selectedFiles.length === 0) return alert("Lütfen yüklenecek bir dosya seçin veya ses kaydı yapın.");
        submitBtn.textContent = 'Yükleniyor... (' + selectedFiles.length + ' belge)';
        submitBtn.disabled = true;

        uploadedFilesCount = 0;
        totalFilesToUpload = selectedFiles.length;
        totalBytesToUpload = selectedFiles.reduce((sum, f) => sum + f.size, 0);
        totalBytesUploaded = 0;
        uploadStatus.textContent = '';

        const MAX_PARALLEL_UPLOADS = 4; // Aynı anda max 4 dosya yükle
        let queue = [...selectedFiles];

        const startNextUpload = () => {
            if (queue.length === 0) return;
            const file = queue.shift();
            uploadFile(file).finally(() => startNextUpload());
        };

        // Başlat
        for (let i = 0; i < MAX_PARALLEL_UPLOADS; i++) startNextUpload();
    });

    function uploadFile(file) {
        return new Promise((resolve, reject) => {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("name", document.querySelector("input[name='name']").value);

            const noteContent = document.querySelector("textarea[name='note']").value;
            if (noteContent.trim() !== "") formData.append("file", new File([noteContent], "note.txt", { type: "text/plain" }));

            const xhr = new XMLHttpRequest();
            let fileLastUploaded = 0;
            xhr.upload.addEventListener("progress", (event) => {
                if (event.lengthComputable) {
                    const diff = event.loaded - fileLastUploaded;
                    totalBytesUploaded += diff;
                    fileLastUploaded = event.loaded;
                    const loadedMB = (totalBytesUploaded / (1024 * 1024)).toFixed(2);
                    const totalMB = (totalBytesToUpload / (1024 * 1024)).toFixed(2);
                    uploadStatus.textContent = `Başarıyla yüklendi (${loadedMB} MB / ${totalMB} MB)`;
                }
            });

            xhr.addEventListener('load', () => {
                uploadedFilesCount++;
                if (uploadedFilesCount === totalFilesToUpload) setTimeout(() => { window.location.href = mainForm.action; }, 500);
                resolve();
            });

            xhr.addEventListener('error', () => {
                console.error("Dosya yükleme hatası:", file.name);
                alert(`Yüklenemeyen dosya: ${file.name}`);
                reject();
            });

            xhr.open('POST', mainForm.action);
            xhr.send(formData);
        });
    }
});
