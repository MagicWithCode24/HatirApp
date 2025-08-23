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

    startBtn.style.display = "none";
    stopBtn.style.display = "none";
    startBtn.disabled = true;
    stopBtn.disabled = true;

    function isDuplicateFile(newFile, existingFiles) {
        return existingFiles.some(existingFile => {
            return existingFile.name === newFile.name && 
                   existingFile.size === newFile.size && 
                   existingFile.lastModified === newFile.lastModified &&
                   existingFile.type === newFile.type;
        });
    }

    function filterDuplicateFiles(newFiles, existingFiles) {
        const uniqueFiles = [];
        const duplicateFiles = [];

        newFiles.forEach(file => {
            if (!isDuplicateFile(file, existingFiles) && !isDuplicateFile(file, uniqueFiles)) {
                uniqueFiles.push(file);
            } else {
                duplicateFiles.push(file);
            }
        });

        return { uniqueFiles, duplicateFiles };
    }

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
                const timestamp = Date.now();
                selectedFiles.push(new File([audioBlob], `recording_${timestamp}.wav`, { type: 'audio/wav' }));
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
        
        const { uniqueFiles, duplicateFiles } = filterDuplicateFiles(newFiles, selectedFiles);
        
        const totalFilesAfterAdd = selectedFiles.length + uniqueFiles.length;
        let filesToAdd = uniqueFiles;
        let limitExceeded = false;
        
        if (totalFilesAfterAdd > 300) {
            const allowedCount = 300 - selectedFiles.length;
            filesToAdd = uniqueFiles.slice(0, allowedCount);
            limitExceeded = true;
        }
        
        let alertMessage = '';
        if (duplicateFiles.length > 0) {
            const duplicateNames = duplicateFiles.map(file => file.name).join(', ');
            alertMessage += `Aşağıdaki dosyalar zaten seçilmiş, tekrar eklenmedi:\n${duplicateNames}`;
        }
        
        if (limitExceeded) {
            if (alertMessage) alertMessage += '\n\n';
            alertMessage += `Maksimum 300 dosya seçilebilir. ${filesToAdd.length} dosya eklendi, ${uniqueFiles.length - filesToAdd.length} dosya sınır aşımı nedeniyle eklenmedi.`;
        }
        
        if (alertMessage) {
            alert(alertMessage);
        }
        
        fileInput.value = '';
        
        if (filesToAdd.length === 0) {
            return;
        }
        
        const previousFileCount = selectedFiles.length;
        
        selectedFiles = [...selectedFiles, ...uniqueFiles];
        
        if (previousFileCount >= 4) {
            const overlayStackContainer = previewContainer.querySelector('.overlay-stack-container');
            if (overlayStackContainer) {
                const extraCountElement = overlayStackContainer.querySelector('.extra-count');
                if (extraCountElement) {
                    const maxNormalPreview = 2;
                    const totalExtraCount = selectedFiles.length - maxNormalPreview;
                    extraCountElement.textContent = `+${totalExtraCount}`;
                }
            }
            return;
        }
        
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
        const maxOverlayPreview = 2;
        const filesToPreview = selectedFiles.slice(0, maxNormalPreview + maxOverlayPreview);
        let allPreviews = [];
        let loadedCount = 0;

        const updateFilePreviewProgress = () => {
            loadedCount++;
            const percentComplete = (loadedCount / filesToPreview.length) * 100;
            filePreviewProgressBar.style.width = percentComplete.toFixed(0) + '%';
            filePreviewProgressText.textContent = percentComplete.toFixed(0) + '%';
            if (loadedCount === filesToPreview.length) {
                setTimeout(() => {
                    filePreviewProgressBarContainer.style.display = 'none';
                }, 500);
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
            } else {
                updateFilePreviewProgress();
                const placeholder = document.createElement('div');
                placeholder.textContent = file.type.startsWith("video/") ? 'Video dosyası' : 'Diğer dosya';
                placeholder.style.cssText = 'width:80px;height:100px;border:2px dashed #ccc;display:flex;align-items:center;justify-content:center;font-size:10px;text-align:center;color:#888;overflow:hidden;margin-right:10px;';
                allPreviews.push(Promise.resolve(placeholder));
            }
        });

        Promise.all(allPreviews).then(results => {
            const validPreviews = results.filter(el => el !== null);
            validPreviews.slice(0, maxNormalPreview).forEach(el => previewContainer.appendChild(el));

            const totalExtraCount = selectedFiles.length - maxNormalPreview;
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

            let infoText = document.getElementById("photoSelectInfo");
            if (!infoText) {
                infoText = document.createElement("p");
                infoText.id = "photoSelectInfo";
                infoText.style.marginTop = "20px";
                infoText.style.fontSize = "14px";
                infoText.style.color = "#555";
                fileInput.parentNode.appendChild(infoText);
            }
            infoText.textContent = "Daha fazla fotoğraf seçmek için seçme yerine bir daha basın. Halihazırda seçilmiş fotoğraflar bir daha seçilemez.";
        });
    });

    mainForm.addEventListener('submit', function(e) {
        e.preventDefault();
        if (selectedFiles.length === 0) {
            alert("Lütfen yüklenecek bir dosya seçin veya ses kaydı yapın.");
            return;
        }

        let warningContainer = document.getElementById('warningContainer');
        if (!warningContainer) {
            warningContainer = document.createElement('div');
            warningContainer.id = 'warningContainer';
            warningContainer.style.margin = '10px 0';
            warningContainer.style.color = '#333';
            warningContainer.style.fontSize = '20px';
            warningContainer.style.lineHeight = '1.4';
            warningContainer.style.textAlign = 'center';
            uploadProgressBarContainer.parentNode.insertBefore(warningContainer, uploadProgressBarContainer);
        }

        warningContainer.innerHTML = `
            <p>Bu işlem uzun sürebilir.</p>
            <p>Site arka planda açık olacak şekilde telefonunuzu kullanmaya devam edebilirsiniz.</p>
        `;

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
        xhr.timeout = 3600000;

        xhr.upload.addEventListener("progress", function(event) {
            if (event.lengthComputable) {
                const diff = event.loaded - fileLastUploaded;
                totalBytesUploaded += diff;
                fileLastUploaded = event.loaded;
                const percentComplete = (totalBytesUploaded / totalBytesToUpload) * 100;
                const loadedMB = (totalBytesUploaded / (1024 * 1024)).toFixed(2);
                const totalMB = (totalBytesToUpload / (1024 * 1024)).toFixed(2);
        
                uploadProgressBar.style.width = percentComplete.toFixed(0) + '%';
                
                if (percentComplete >= 100) {
                    uploadProgressText.textContent = "Sisteme gönderiliyor...";
                } else {
                    uploadProgressText.textContent = percentComplete.toFixed(0) + '% (' + loadedMB + ' MB / ' + totalMB + ' MB)';
                }
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




