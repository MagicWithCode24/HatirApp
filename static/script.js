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
    const previewContainer = document.getElementById('uploadPreview');

    // ------------------------
    // Mikrofon
    // ------------------------
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
            startBtn.disabled = true;
            stopBtn.disabled = false;
        } catch (err) {
            console.error("Mikrofon erişim hatası:", err);
            alert("Mikrofon erişimi reddedildi veya bir hata oluştu.");
        }
    });

    stopBtn.addEventListener("click", async () => {
        if (mediaRecorder && mediaRecorder.state === "recording") mediaRecorder.stop();
        startBtn.disabled = false;
        stopBtn.disabled = true;

        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        const formData = new FormData();
        formData.append("audio", audioBlob, "recording.wav");
        formData.append("name", document.querySelector("input[name='name']").value);

        try {
            const res = await fetch("/upload-audio", { method: "POST", body: formData });
            const data = await res.json();
            if (data.success) {
                const uploadId = data.upload_id;
                trackProgress(uploadId, "Ses kaydı");
            } else {
                alert("Ses kaydınız yüklenemedi.");
            }
        } catch (err) {
            console.error("Ses yükleme hatası:", err);
            alert("Ses kaydı yüklenirken bir hata oluştu.");
        }
    });

    // ------------------------
    // Dosya Seçimi
    // ------------------------
    const fileInput = document.getElementById('real-file');

    fileInput.addEventListener('change', () => {
        selectedFiles = Array.from(fileInput.files);
        previewContainer.innerHTML = '';
        selectedFiles.forEach(f => {
            const p = document.createElement("p");
            p.textContent = f.name;
            previewContainer.appendChild(p);
        });
    });

    // ------------------------
    // Form submit
    // ------------------------
    mainForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        if (!selectedFiles.length) {
            alert("Lütfen en az bir dosya seçin.");
            return;
        }

        submitBtn.textContent = 'Yükleniyor...';
        submitBtn.disabled = true;
        uploadProgressBarContainer.style.display = 'block';
        uploadProgressBar.style.width = '0%';
        uploadProgressText.textContent = '0%';

        const username = mainForm.querySelector("input[name='name']").value;

        for (const file of selectedFiles) {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("name", username);

            try {
                const res = await fetch(mainForm.action, { method: "POST", body: formData });
                // Sunucu, upload_id flash veya JSON ile dönebilir
                // Biz thread kullanıldığı için burada upload_id yoksa, frontend'de progress sadece tahmini gösterilecek
            } catch (err) {
                console.error(err);
                alert(`${file.name} yüklenirken hata oluştu.`);
            }
        }

        // Çoklu dosya için tüm upload_id’ler thread olarak başlatıldığı için genel polling ile progress
        // Basit yaklaşım: tüm dosyalar için ortalama progress
        let progressInterval = setInterval(async () => {
            try {
                let totalProgress = 0;
                let count = 0;
                for (const uploadId in window.uploadIds || {}) {
                    const res = await fetch(`/upload-progress/${uploadId}`);
                    const data = await res.json();
                    const values = Object.values(data);
                    if (values.length) {
                        totalProgress += values.reduce((a, b) => a + b, 0) / values.length;
                        count++;
                    }
                }
                let percent = count ? Math.round(totalProgress / count) : 0;
                uploadProgressBar.style.width = percent + "%";
                uploadProgressText.textContent = percent + "%";

                if (percent >= 100) {
                    clearInterval(progressInterval);
                    uploadProgressBar.style.width = '100%';
                    uploadProgressText.textContent = '100% Tamamlandı!';
                    submitBtn.textContent = 'Gönder';
                    submitBtn.disabled = false;
                }
            } catch (err) {
                console.error("Progress check hatası:", err);
            }
        }, 1000);
    });

    // ------------------------
    // Progress takip fonksiyonu (audio veya dosya)
    // ------------------------
    function trackProgress(uploadId, label) {
        const progBar = document.createElement("div");
        progBar.style.width = "0%";
        progBar.style.height = "20px";
        progBar.style.backgroundColor = "#4CAF50";
        progBar.style.marginTop = "5px";
        const progLabel = document.createElement("p");
        progLabel.textContent = label;
        previewContainer.appendChild(progLabel);
        previewContainer.appendChild(progBar);

        const interval = setInterval(async () => {
            try {
                const res = await fetch(`/upload-progress/${uploadId}`);
                const data = await res.json();
                const values = Object.values(data);
                if (values.length) {
                    const percent = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
                    progBar.style.width = percent + "%";
                    if (percent >= 100) clearInterval(interval);
                }
            } catch (err) {
                console.error(err);
            }
        }, 1000);
    }
});
