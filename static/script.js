document.addEventListener("DOMContentLoaded", function () {
    let mediaRecorder;
    let audioChunks = [];
    let selectedFiles = [];
    let uploadedFilesCount = 0;
    let totalFilesToUpload = 0;
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

    // Mobile cihaz kontrolü
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    console.log("Cihaz:", isMobile ? "Mobile" : "Desktop");

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

    const fileInput = document.getElementById('real-file');
    const previewContainer = document.getElementById('uploadPreview');
    const uploadText = document.getElementById('uploadText');

    fileInput.addEventListener('change', () => {
        const newFiles = Array.from(fileInput.files);
        console.log("Seçilen dosya sayısı:", newFiles.length);
        
        // MOBILE İÇİN ÖZEL İŞLEM: Dosyaları yeniden oluştur
        if (isMobile && newFiles.length > 0) {
            processMobileFiles(newFiles).then(processedFiles => {
                selectedFiles = [...selectedFiles, ...processedFiles];
                updatePreview();
            });
        } else {
            selectedFiles = [...selectedFiles, ...newFiles];
            updatePreview();
        }
    });

    // Mobile dosyaları işleme fonksiyonu
    async function processMobileFiles(files) {
        const processedFiles = [];
        
        for (const file of files) {
            try {
                // Dosyayı ArrayBuffer olarak oku
                const arrayBuffer = await file.arrayBuffer();
                
                // Yeniden File objesi oluştur
                const processedFile = new File([arrayBuffer], file.name, {
                    type: file.type,
                    lastModified: file.lastModified
                });
                
                processedFiles.push(processedFile);
                console.log("Mobile dosya işlendi:", file.name);
            } catch (error) {
                console.error("Dosya işleme hatası:", file.name, error);
                processedFiles.push(file); // Fallback: orijinal dosya
            }
        }
        
        return processedFiles;
    }

    function updatePreview() {
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
        let allPreviews = [];
        let loadedCount = 0;

        const updateFilePreviewProgress = () => {
            loadedCount++;
            const percentComplete = (loadedCount / selectedFiles.length) * 100;
            filePreviewProgressBar.style.width = percentComplete.toFixed(0) + '%';
            filePreviewProgressText.textContent = percentComplete.toFixed(0) + '%';
            if (loadedCount === selectedFiles.length) {
                setTimeout(() => {
                    filePreviewProgressBarContainer.style.display = 'none';
                }, 500);
            }
        };

        selectedFiles.forEach(file => {
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
            } else if (file.type.startsWith("video/")) {
                allPreviews.push(new Promise(resolve => {
                    const video = document.createElement('video');
                    video.preload = 'metadata';
                    video.src = URL.createObjectURL(file);
                    video.onloadeddata = function () { video.currentTime = 0; };
                    video.onseeked = function () {
                        const canvas = document.createElement('canvas');
                        canvas.width = video.videoWidth;
                        canvas.height = video.videoHeight;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                        const img = document.createElement('img');
                        img.src = canvas.toDataURL('image/jpeg');
                        URL.revokeObjectURL(video.src);
                        updateFilePreviewProgress();
                        resolve(img);
                    };
                    video.onerror = function () {
                        console.error("Video yüklenemedi:", file.name);
                        const errorDiv = document.createElement('div');
                        errorDiv.textContent = 'Video önizlemesi yüklenemedi.';
                        errorDiv.style.cssText = 'width:80px;height:100px;border:2px dashed #ccc;display:flex;align-items:center;justify-content:center;font-size:10px;text-align:center;color:#888;overflow:hidden;';
                        updateFilePreviewProgress();
                        resolve(errorDiv);
                    };
                }));
            } else {
                updateFilePreviewProgress();
                allPreviews.push(Promise.resolve(null));
            }
        });

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
    }

    mainForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        if (selectedFiles.length === 0) {
            alert("Lütfen yüklenecek bir dosya seçin veya ses kaydı yapın.");
            return;
        }
    
        if (submitBtn) {
            submitBtn.textContent = 'Yükleniyor...';
            submitBtn.disabled = true;
            uploadProgressBarContainer.style.display = 'block';
        }
    
        uploadedFilesCount = 0;
        totalFilesToUpload = selectedFiles.length;
    
        // Not dosyasını ekle
        const noteContent = document.querySelector("textarea[name='note']").value;
        if (noteContent.trim() !== "") {
            const noteFile = new File([noteContent], "note.txt", { type: "text/plain" });
            selectedFiles.push(noteFile);
            totalFilesToUpload = selectedFiles.length;
        }
    
        // TÜM DOSYALARI SIRAYLA GÖNDER
        for (const file of selectedFiles) {
            try {
                await uploadFile(file);
            } catch (error) {
                alert(`Hata: ${error} yüklenemedi`);
                break;
            }
        }
    });

    // uploadFile fonksiyonunu bu şekilde değiştir:
    function uploadFile(file) {
        return new Promise((resolve, reject) => {
            // MOBILE İÇİN DOSYA İSMİNİ DÜZELT
            const getSafeFileName = (originalName) => {
                // Türkçe karakterleri ve özel karakterleri düzelt
                let safeName = originalName
                    .replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
                    .replace(/ü/g, 'u').replace(/Ü/g, 'U')
                    .replace(/ş/g, 's').replace(/Ş/g, 'S')
                    .replace(/ı/g, 'i').replace(/İ/g, 'I')
                    .replace(/ö/g, 'o').replace(/Ö/g, 'O')
                    .replace(/ç/g, 'c').replace(/Ç/g, 'C')
                    .replace(/[^a-zA-Z0-9._-]/g, '_') // Özel karakterleri _ ile değiştir
                    .replace(/_+/g, '_') // Ardışık _'leri tekilleştir
                    .replace(/^_+|_+$/g, ''); // Baştaki ve sondaki _'leri kaldır
                
                // Mobile için dosya uzantısını koru
                const extension = originalName.split('.').pop();
                if (extension && safeName.indexOf('.') === -1) {
                    safeName = safeName + '.' + extension;
                }
                
                return safeName || 'file';
            };
    
            const processFile = async (file) => {
                if (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)) {
                    try {
                        const fileBuffer = await file.arrayBuffer();
                        const safeFileName = getSafeFileName(file.name);
                        return new File([fileBuffer], safeFileName, { 
                            type: file.type,
                            lastModified: Date.now()
                        });
                    } catch (error) {
                        console.log("Dosya işleme hatası, orijinal kullanılıyor");
                        const safeFileName = getSafeFileName(file.name);
                        return new File([file], safeFileName, { 
                            type: file.type,
                            lastModified: Date.now()
                        });
                    }
                }
                return file;
            };
    
            processFile(file).then(processedFile => {
                const formData = new FormData();
                formData.append("file", processedFile);
                formData.append("name", document.querySelector("input[name='name']").value);
                formData.append("original_filename", file.name); // Orijinal dosya adını da gönder
    
                console.log("Yüklenen dosya:", processedFile.name, "Orijinal:", file.name);
    
                const xhr = new XMLHttpRequest();
                
                xhr.addEventListener('load', function() {
                    uploadedFilesCount++;
                    const percentComplete = (uploadedFilesCount / totalFilesToUpload) * 100;
                    uploadProgressBar.style.width = percentComplete.toFixed(0) + '%';
                    uploadProgressText.textContent = percentComplete.toFixed(0) + '%';
                    
                    if (uploadedFilesCount === totalFilesToUpload) {
                        setTimeout(() => { 
                            window.location.href = mainForm.action; 
                        }, 500);
                    }
                    resolve();
                });
                
                xhr.addEventListener('error', function() {
                    console.error("Dosya yükleme hatası:", file.name);
                    reject(file.name);
                });
    
                xhr.open('POST', mainForm.action);
                xhr.send(formData);
            });
        });
    }

    function uploadAllFilesTogether() {
        const formData = new FormData();
        const userName = document.querySelector("input[name='name']").value;
        
        formData.append("name", userName);
        formData.append("is_mobile", "yes");
        
        // Tüm dosyaları ekle
        selectedFiles.forEach((file, index) => {
            formData.append(`file_${index}`, file);
            formData.append(`file_name_${index}`, file.name);
        });

        const noteContent = document.querySelector("textarea[name='note']").value;
        if (noteContent.trim() !== "") {
            formData.append("note", noteContent);
        }

        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', function(event) {
            if (event.lengthComputable) {
                const percentComplete = (event.loaded / event.total) * 100;
                uploadProgressBar.style.width = percentComplete.toFixed(0) + '%';
                uploadProgressText.textContent = percentComplete.toFixed(0) + '%';
            }
        });
        
        xhr.addEventListener('load', function() {
            setTimeout(() => { 
                window.location.href = mainForm.action; 
            }, 500);
        });
        
        xhr.addEventListener('error', function() {
            console.error("Dosya yükleme hatası");
            alert("Dosya yüklenirken hata oluştu");
            if (submitBtn) {
                submitBtn.textContent = 'Gönder';
                submitBtn.disabled = false;
            }
        });

        xhr.open('POST', mainForm.action);
        xhr.send(formData);
    }
});


