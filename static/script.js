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
    const uploadProgressBarContainer = document.getElementById("uploadProgressBarContainer");
    const uploadProgressBar = document.getElementById("uploadProgressBar");
    const uploadProgressText = document.getElementById("uploadProgressText");
    const filePreviewProgressBarContainer = document.getElementById("filePreviewProgressBarContainer");
    const filePreviewProgressBar = document.getElementById("filePreviewProgressBar");
    const filePreviewProgressText = document.getElementById("filePreviewProgressText");

    // Başlangıçta butonları görünmez ve pasif yap
    startBtn.style.display = "none";
    stopBtn.style.display = "none";
    startBtn.disabled = true;
    stopBtn.disabled = true;

    micBtn.addEventListener("click", (e) => {
        e.preventDefault();
        recordPanel.classList.toggle("active");

        if (recordPanel.classList.contains("active")) {
            // Görünür ve uygun şekilde etkinleştir
            startBtn.style.display = "inline-block";
            stopBtn.style.display = "inline-block";
            startBtn.disabled = false;
            stopBtn.disabled = true; // başta stop pasif
        } else {
            // Tekrar gizle
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

            mediaRecorder.addEventListener("dataavailable", event => {
                audioChunks.push(event.data);
            });

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
        if (mediaRecorder && mediaRecorder.state === "recording") {
            mediaRecorder.stop();
        }
        startBtn.disabled = false;
        stopBtn.disabled = true;
    });

    // Dosya yükleme ve önizleme kısmı aynı kalıyor
    const fileInput = document.getElementById('real-file');
    const previewContainer = document.getElementById('uploadPreview');
    const uploadText = document.getElementById('uploadText');

    fileInput.addEventListener('change', () => {
        const newFiles = Array.from(fileInput.files);
        selectedFiles = [...selectedFiles, ...newFiles];
    
        previewContainer.innerHTML = '';
        uploadText.style.display = selectedFiles.length > 0 ? "none" : "block";
        previewContainer.style.minHeight = selectedFiles.length > 0 ? "100px" : "auto";
    
        selectedFiles.forEach(file => {
            const previewDiv = document.createElement('div');
            previewDiv.className = 'file-preview-item';
    
            if (file.type.startsWith("image/")) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const img = document.createElement("img");
                    img.src = e.target.result;
                    img.style.maxWidth = '100px';
                    img.style.maxHeight = '100px';
                    previewDiv.appendChild(img);
    
                    const successText = document.createElement('p');
                    successText.textContent = "Başarıyla yüklendi";
                    previewDiv.appendChild(successText);
                };
                reader.readAsDataURL(file);
            } else {
                // Video veya diğer dosyalar için sadece metin göster
                const successText = document.createElement('p');
                successText.textContent = "Başarıyla yüklendi";
                previewDiv.appendChild(successText);
            }
    
            previewContainer.appendChild(previewDiv);
        });
    });


    // Form submit ve uploadFile fonksiyonu aynı kalıyor
    mainForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        if (selectedFiles.length === 0) {
            alert("Lütfen yüklenecek bir dosya seçin veya ses kaydı yapın.");
            return;
        }

        if (submitBtn) {
            submitBtn.textContent = 'Yükleniyor... (' + selectedFiles.length + ' belge)';
            submitBtn.disabled = true;
            uploadProgressBarContainer.style.display = 'block';
            uploadProgressBar.style.width = '0%'; 
            uploadProgressText.textContent = '0% (0 MB / 0 MB)';
        }

        uploadedFilesCount = 0;
        totalFilesToUpload = selectedFiles.length;

        totalBytesToUpload = selectedFiles.reduce((sum, file) => sum + file.size, 0);
        totalBytesUploaded = 0;
        
        selectedFiles.forEach(file => uploadFile(file));
    });

    function uploadFile(file) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("name", document.querySelector("input[name='name']").value);

        const noteContent = document.querySelector("textarea[name='note']").value;
        if (noteContent.trim() !== "") {
            const noteFile = new File([noteContent], "note.txt", { type: "text/plain" });
            formData.append("file", noteFile);  
        }

        const xhr = new XMLHttpRequest();
        let fileLastUploaded = 0;
        xhr.upload.addEventListener("progress", function(event) {
            if (event.lengthComputable) {
                const diff = event.loaded - fileLastUploaded;
                totalBytesUploaded += diff;
                fileLastUploaded = event.loaded;
        
                const percentComplete = (totalBytesUploaded / totalBytesToUpload) * 100;
                const loadedMB = (totalBytesUploaded / (1024 * 1024)).toFixed(2);
                const totalMB = (totalBytesToUpload / (1024 * 1024)).toFixed(2);
        
                uploadProgressBar.style.width = percentComplete.toFixed(0) + '%';
                uploadProgressText.textContent = percentComplete.toFixed(0) + '% (' + loadedMB + ' MB / ' + totalMB + ' MB)';
            }
        });
        
        xhr.addEventListener('load', function() {
            uploadedFilesCount++;
            if (uploadedFilesCount === totalFilesToUpload) {
                setTimeout(() => { 
                    window.location.href = mainForm.action; 
                }, 500);
            }
        });
        xhr.addEventListener('error', function() {
            console.error("Dosya yükleme hatası:", file.name);
            alert(`Yüklenemeyen dosya: ${file.name}`);
        });

        xhr.open('POST', mainForm.action);
        xhr.send(formData);
    }
});

