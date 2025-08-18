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
            mediaRecorder.addEventListener("dataavailable", event => audioChunks.push(event.data));
            mediaRecorder.addEventListener("stop", async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                const formData = new FormData();
                formData.append("audio", audioBlob, "recording.wav");
                formData.append("name", document.querySelector("input[name='name']").value);
                try {
                    const res = await fetch("/upload-audio", { method: "POST", body: formData });
                    const data = await res.json();
                    if (data.success) {
                        const previewArea = document.getElementById("audioPreview");
                        previewArea.innerHTML = "";
                        const audio = document.createElement("audio");
                        audio.controls = true;
                        audio.src = URL.createObjectURL(audioBlob);
                        const label = document.createElement("p");
                        label.textContent = "Kaydınız:";
                        previewArea.appendChild(label);
                        previewArea.appendChild(audio);
                    } else {
                        alert("Ses kaydınız yüklenemedi.");
                    }
                } catch (err) {
                    console.error("Ses yükleme hatası:", err);
                    alert("Ses kaydı yüklenirken bir hata oluştu.");
                }
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

    const fileInput = document.getElementById('real-file');
    const previewContainer = document.getElementById('uploadPreview');
    const uploadText = document.getElementById('uploadText');

    fileInput.addEventListener('change', () => {
        selectedFiles = Array.from(fileInput.files);
        previewContainer.innerHTML = '';
    });

    mainForm.addEventListener('submit', function(e) {
        e.preventDefault();
        if (submitBtn) {
            submitBtn.textContent = 'Yükleniyor...';
            submitBtn.disabled = true;
            uploadProgressBarContainer.style.display = 'block';
            uploadProgressBar.style.width = '0%';
            uploadProgressText.textContent = '0%';
            uploadProgressBar.style.backgroundColor = '#4CAF50';
        }

        const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
        const totalChunks = selectedFiles.reduce((sum, f) => sum + Math.ceil(f.size / CHUNK_SIZE), 0);
        let uploadedChunks = 0;

        async function uploadFileInChunks(file, username) {
            const chunks = Math.ceil(file.size / CHUNK_SIZE);
            for (let i = 0; i < chunks; i++) {
                const start = i * CHUNK_SIZE;
                const end = Math.min(file.size, start + CHUNK_SIZE);
                const chunk = file.slice(start, end);
                const chunkForm = new FormData();
                chunkForm.append("file", chunk, file.name);
                chunkForm.append("name", username);
                chunkForm.append("chunkIndex", i);
                chunkForm.append("totalChunks", chunks);

                await fetch(mainForm.action, { method: "POST", body: chunkForm });

                uploadedChunks++;
                const percentComplete = (uploadedChunks / totalChunks) * 100;
                uploadProgressBar.style.width = percentComplete.toFixed(0) + '%';
                uploadProgressText.textContent = percentComplete.toFixed(0) + '%';
            }
        }

        async function startUpload() {
            const username = document.querySelector("input[name='name']").value;
            for (const file of selectedFiles) {
                await uploadFileInChunks(file, username);
            }
        }

        startUpload().then(() => {
            uploadProgressBar.style.width = '100%';
            uploadProgressBar.style.backgroundColor = '#4CAF50';
            uploadProgressText.textContent = '100% Tamamlandı!';
            setTimeout(() => window.location.href = mainForm.action, 700);
        }).catch(err => {
            console.error(err);
            alert('Dosyalar yüklenirken bir hata oluştu. Lütfen tekrar deneyin.');
            submitBtn.textContent = 'Gönder';
            submitBtn.disabled = false;
            uploadProgressBarContainer.style.display = 'none';
        });
    });
});
