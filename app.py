import os
from flask import Flask, render_template, request, redirect, url_for, flash, jsonify
from werkzeug.utils import secure_filename
import boto3
from botocore.client import Config
import threading
import uuid

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'your_super_secret_key')

AWS_ACCESS_KEY_ID = os.environ.get('AWS_ACCESS_KEY_ID')
AWS_SECRET_ACCESS_KEY = os.environ.get('AWS_SECRET_ACCESS_KEY')
AWS_S3_BUCKET_NAME = os.environ.get('AWS_S3_BUCKET_NAME')
AWS_S3_REGION = os.environ.get('AWS_S3_REGION')

s3_client = None
if AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY and AWS_S3_BUCKET_NAME and AWS_S3_REGION:
    try:
        s3_client = boto3.client(
            's3',
            aws_access_key_id=AWS_ACCESS_KEY_ID,
            aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
            region_name=AWS_S3_REGION,
            config=Config(signature_version='s3v4')
        )
        print("Amazon S3 istemcisi başarıyla başlatıldı.")
    except Exception as e:
        print(f"HATA: Amazon S3 istemcisi başlatılırken bir sorun oluştu: {e}")
        s3_client = None
else:
    print("UYARI: AWS S3 ortam değişkenleri eksik. Dosya yüklemeleri çalışmayacak.")

# ------------------------
# Upload progress tracker
# ------------------------
upload_progress = {}  # {upload_id: {filename: progress_percentage}}
CHUNK_SIZE = 5 * 1024 * 1024  # 5MB

def multipart_upload_thread(file, username, upload_id):
    if not s3_client:
        upload_progress[upload_id][file.filename] = -1
        return

    filename = secure_filename(file.filename)
    s3_key = f"{username}/{filename}"
    upload_progress[upload_id][filename] = 0

    file.seek(0, os.SEEK_END)
    file_size = file.tell()
    file.seek(0)

    total_chunks = (file_size + CHUNK_SIZE - 1) // CHUNK_SIZE
    parts = []

    try:
        mpu = s3_client.create_multipart_upload(Bucket=AWS_S3_BUCKET_NAME, Key=s3_key)
        upload_id_s3 = mpu['UploadId']

        for i in range(total_chunks):
            start = i * CHUNK_SIZE
            chunk_data = file.read(CHUNK_SIZE)
            part = s3_client.upload_part(
                Bucket=AWS_S3_BUCKET_NAME,
                Key=s3_key,
                PartNumber=i+1,
                UploadId=upload_id_s3,
                Body=chunk_data
            )
            parts.append({'ETag': part['ETag'], 'PartNumber': i+1})
            upload_progress[upload_id][filename] = int(((i+1)/total_chunks)*100)

        s3_client.complete_multipart_upload(
            Bucket=AWS_S3_BUCKET_NAME,
            Key=s3_key,
            UploadId=upload_id_s3,
            MultipartUpload={'Parts': parts}
        )
        upload_progress[upload_id][filename] = 100

    except Exception as e:
        if 'upload_id_s3' in locals():
            s3_client.abort_multipart_upload(Bucket=AWS_S3_BUCKET_NAME, Key=s3_key, UploadId=upload_id_s3)
        upload_progress[upload_id][filename] = -1

# ------------------------
# Routes
# ------------------------
@app.route('/')
def home():
    return render_template('index.html')

@app.route('/ana')
def ana():
    return render_template('ana.html')

@app.route('/son', methods=['POST'])
def son():
    username = request.form.get('name')
    note_content = request.form.get('note')
    uploaded_files = request.files.getlist('file')

    if not username:
        flash('Lütfen bir kullanıcı adı girin!', 'error')
        return redirect(url_for('ana'))

    if not s3_client:
        flash('Depolama hizmeti (Amazon S3) ayarları eksik veya hatalı.', 'error')
        return redirect(url_for('ana'))

    if note_content:
        note_s3_path = f"{username}/{username}_note.txt"
        try:
            s3_client.put_object(
                Bucket=AWS_S3_BUCKET_NAME,
                Key=note_s3_path,
                Body=note_content.encode('utf-8'),
                ContentType='text/plain'
            )
            flash('Not başarıyla yüklendi.', 'success')
        except Exception as e:
            flash(f'Not yüklenirken bir hata oluştu: {e}', 'error')

    for file in uploaded_files:
        if file and file.filename != '':
            upload_id = str(uuid.uuid4())
            upload_progress[upload_id] = {}
            threading.Thread(target=multipart_upload_thread, args=(file, username, upload_id)).start()
            flash(f"{file.filename} yüklenmeye başladı. Upload ID: {upload_id}", 'info')
        else:
            flash(f"Boş dosya seçildi veya dosya adı yok.", 'info')

    flash('Dosyalar yüklenmeye başladı. Progress bar ile takip edebilirsiniz.', 'info')
    return redirect(url_for('son_page'))

@app.route('/son')
def son_page():
    return render_template('son.html')

@app.route('/upload-audio', methods=['POST'])
def upload_audio():
    if 'audio' not in request.files:
        return jsonify(success=False, error="Ses kaydı bulunamadı."), 400
    audio_file = request.files['audio']
    username = request.form.get('name')
    if not username:
        return jsonify(success=False, error="Kullanıcı adı eksik."), 400
    audio_thread_id = str(uuid.uuid4())
    upload_progress[audio_thread_id] = {}
    threading.Thread(target=multipart_upload_thread, args=(audio_file, username, audio_thread_id)).start()
    return jsonify(success=True, upload_id=audio_thread_id)

@app.route('/upload-progress/<upload_id>')
def progress(upload_id):
    if upload_id in upload_progress:
        return jsonify(upload_progress[upload_id])
    return jsonify({})

if __name__ == "__main__":
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=False, host='0.0.0.0', port=port)
