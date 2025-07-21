document.addEventListener("DOMContentLoaded", function () {
    // === SES KAYDI ===
    let mediaRecorder;
    let audioChunks = [];

    const micBtn = document.getElementById("micBtn");
    const recordPanel = document.getElementById("recordPanel");
    const startBtn = document.getElementById("startBtn");
    const stopBtn = document.getElementById("stopBtn");

    micBtn.addEventListener("click", () => {
        recordPanel.classList.toggle("active");
    });

    startBtn.addEventListener("click", async () => {
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

            fetch("/upload-audio", {
                method: "POST",
                body: formData
            });
        });

        startBtn.disabled = true;
        stopBtn.disabled = false;
    });

    stopBtn.addEventListener("click", () => {
        mediaRecorder.stop();
        startBtn.disabled = false;
        stopBtn.disabled = true;
    });

    // === FOTOĞRAF ÖNİZLEME ===
    const fileInput = document.getElementById('real-file');
    const previewContainer = document.getElementById('uploadPreview');
    const uploadText = document.getElementById('uploadText');

    fileInput.addEventListener('change', () => {
        const files = fileInput.files;
        const imageFiles = Array.from(files).filter(file => file.type.startsWith("image/"));

        previewContainer.innerHTML = '';

        if (imageFiles.length > 0) {
            uploadText.style.display = "none";
            previewContainer.style.minHeight = "100px";
        } else {
            uploadText.style.display = "block";
            previewContainer.style.minHeight = "auto";
        }

        const maxNormalPreview = 2;
        const maxOverlayPreview = 3;

        imageFiles.slice(0, maxNormalPreview).forEach(file => {
            const reader = new FileReader();
            reader.onload = function (e) {
                const img = document.createElement("img");
                img.src = e.target.result;
                previewContainer.appendChild(img);
            };
            reader.readAsDataURL(file);
        });

        const remainingImagesForOverlay = imageFiles.slice(maxNormalPreview, maxNormalPreview + maxOverlayPreview);
        const totalExtraCount = imageFiles.length - maxNormalPreview;
        const shownOverlayCount = Math.min(maxOverlayPreview, totalExtraCount);
        const remainingHiddenCount = totalExtraCount;
        const extraCountToShow = imageFiles.length - maxNormalPreview;

        if (totalExtraCount > 0) {
            const overlayStackContainer = document.createElement("div");
            overlayStackContainer.className = "overlay-stack-container";
            
            const slideDistance = 3.75;

            remainingImagesForOverlay.forEach((file, index) => { 
                const reader = new FileReader();
                reader.onload = function (e) {
                    const img = document.createElement("img");
                    img.src = e.target.result;
                    img.classList.add("overlay");
                    img.style.left = `${index * slideDistance}px`;
                    img.style.zIndex = remainingImagesForOverlay.length - index;
                    overlayStackContainer.appendChild(img);
                };
                reader.readAsDataURL(file);
            });

            if (extraCountToShow > 0) {
                const extra = document.createElement("div");
                extra.className = "extra-count";
                extra.textContent = `+${extraCountToShow}`;
                overlayStackContainer.appendChild(extra);
            }

            previewContainer.appendChild(overlayStackContainer);
        }
    });
});
