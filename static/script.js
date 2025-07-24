document.addEventListener("DOMContentLoaded", function () {
    const fileInput = document.getElementById('real-file');
    const previewContainer = document.getElementById('uploadPreview');
    const uploadText = document.getElementById('uploadText');
    const progressBar = document.getElementById('progressBar');
    const uploadProgress = document.getElementById('uploadProgress');

    const micBtn = document.getElementById('micBtn');
    const recordPanel = document.getElementById('recordPanel');
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const audioPreviewContainer = document.getElementById('audioPreviewContainer');
    let mediaRecorder;
    let audioChunks = [];
    let audioBlob;
    let audioUrl;
    let audio;

    micBtn.addEventListener('click', () => {
        recordPanel.classList.toggle("active");
    });

    startBtn.addEventListener('click', () => {
        startRecording();
    });

    stopBtn.addEventListener('click', () => {
        stopRecording();
    });

    function startRecording() {
        audioChunks = [];
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                mediaRecorder = new MediaRecorder(stream);
                mediaRecorder.start();
                startBtn.disabled = true;
                stopBtn.disabled = false;

                mediaRecorder.ondataavailable = event => {
                    audioChunks.push(event.data);
                };

                mediaRecorder.onstop = () => {
                    audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                    audioUrl = URL.createObjectURL(audioBlob);
                    audio = new Audio(audioUrl);
                    const audioPreview = document.createElement("audio");
                    audioPreview.controls = true;
                    audioPreview.src = audioUrl;

                    audioPreviewContainer.innerHTML = '';
                    audioPreviewContainer.appendChild(audioPreview);
                    startBtn.disabled = false;
                    stopBtn.disabled = true;
                };
            });
    }

    function stopRecording() {
        mediaRecorder.stop();
    }

    fileInput.addEventListener('change', () => {
        const files = fileInput.files;
        const imageFiles = Array.from(files).filter(file => file.type.startsWith("image/"));
        const videoFiles = Array.from(files).filter(file => file.type.startsWith("video/"));

        previewContainer.innerHTML = '';

        if (imageFiles.length > 0 || videoFiles.length > 0) {
            uploadText.style.display = "none";
            previewContainer.style.minHeight = "100px";
            uploadProgress.style.display = "block";
        } else {
            uploadText.style.display = "block";
            previewContainer.style.minHeight = "auto";
            uploadProgress.style.display = "none";
        }

        const totalFiles = imageFiles.length + videoFiles.length;
        let uploadedFiles = 0;

        const updateProgressBar = () => {
            const progress = (uploadedFiles / totalFiles) * 100;
            progressBar.style.width = `${progress}%`;
        };

        imageFiles.slice(0, 2).forEach(file => {
            const reader = new FileReader();
            reader.onload = function (e) {
                const img = document.createElement("img");
                img.src = e.target.result;
                img.style.maxWidth = "100px"; // Görselleri daha küçük yapmak için stil eklenebilir
                previewContainer.appendChild(img);
            };
            reader.readAsDataURL(file);
        });

        videoFiles.slice(0, 2).forEach(file => {
            const video = document.createElement("video");
            video.src = URL.createObjectURL(file);
            video.load();
            video.onloadeddata = function () {
                const canvas = document.createElement("canvas");
                const ctx = canvas.getContext("2d");
                canvas.width = 80;
                canvas.height = 100;
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const img = new Image();
                img.src = canvas.toDataURL();
                previewContainer.appendChild(img);
            };
        });

        const remainingFiles = [...imageFiles.slice(2), ...videoFiles.slice(2)];
        const totalExtraCount = remainingFiles.length;

        if (totalExtraCount > 0) {
            const overlayStackContainer = document.createElement("div");
            overlayStackContainer.className = "overlay-stack-container";

            const slideDistance = 3.75;

            remainingFiles.forEach((file, index) => { 
                const reader = new FileReader();
                reader.onload = function (e) {
                    const img = document.createElement("img");
                    img.src = e.target.result;
                    img.classList.add("overlay");
                    img.style.left = `${index * slideDistance}px`;
                    img.style.zIndex = remainingFiles.length - index;
                    overlayStackContainer.appendChild(img);
                };
                reader.readAsDataURL(file);
            });

            previewContainer.appendChild(overlayStackContainer);
        }

        imageFiles.concat(videoFiles).forEach(file => {
            const reader = new FileReader();
            reader.onload = function () {
                uploadedFiles++;
                updateProgressBar();
            };
            reader.readAsDataURL(file);
        });
    });
});
