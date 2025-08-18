import os
from flask import Flask, render_template, request, redirect, url_for, flash, jsonify
from werkzeug.utils import secure_filename
import boto3
from botocore.client import Config
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

# Multipart upload tracking
active_uploads = {}

def upload_file_to_s3(file, username):
    if not s3_client:
        return None, "S3 istemcisi başlatılmadı veya kimlik bilgileri eksik."
    filename = secure_filename(file.filename)
    s3_file_path = f"{username}/{filename}"
    try:
        s3_client.upload_fileobj(file, AWS_S3_BUCKET_NAME, s3_file_path)
        print(f"'{filename}' S3'e yüklendi: s3://{AWS_S3_BUCKET_NAME}/{s3_file_path}")
        return f"https://{AWS_S3_BUCKET_NAME}.s3.{AWS_S3_REGION}.amazonaws.com/{s3_file_path}", None
    except Exception as e:
        print(f"Hata: '{filename}' S3'e yüklenirken bir sorun oluştu: {e}")
        return None, f"S3 yükleme hatası: {e}"

def upload_note_to_s3(username, note_content):
    if not s3_client:
        return None, "S3 istemcisi başlatılmadı veya kimlik bilgileri eksik."
    note_filename = f"{username}_note.txt"
    s3_note_path = f"{username}/{note_filename}"
    try:
        s3_client.put_object(
            Bucket=AWS_S3_BUCKET_NAME,
            Key=s3_note_path,
            Body=note_content.encode('utf-8'),
            ContentType='text/plain'
        )
        print(f"Not dosyası S3'e yüklendi: s3://{AWS_S3_BUCKET_NAME}/{s3_note_path}")
        return f"https://{AWS_S3_BUCKET_NAME}.s3.{AWS_S3_REGION}.amazonaws.com/{s3_note_path}", None
    except Exception as e:
        print(f"Hata: Not dosyası S3'e yüklenirken bir sorun oluştu: {e}")
        return None, f"S3 not yükleme hatası: {e}"

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/ana')
def ana():
    return render_template('ana.html')

# Yeni chunk upload endpoints
@app.route('/start-upload', methods=['POST'])
def start_upload():
    """Multipart upload başlat"""
    if not s3_client:
        return jsonify(success=False, error="S3 istemcisi bulunamadı"), 500
    
    data = request.get_json()
    filename = secure_filename(data['filename'])
    username = data['username']
    file_size = data['fileSize']
    
    s3_file_path = f"{username}/{filename}"
    upload_id = str(uuid.uuid4())
    
    try:
        # S3 multipart upload başlat
        response = s3_client.create_multipart_upload(
            Bucket=AWS_S3_BUCKET_NAME,
            Key=s3_file_path,
            ContentType=data.get('contentType', 'application/octet-stream')
        )
        
        s3_upload_id = response['UploadId']
        
        # Upload bilgilerini sakla
        active_uploads[upload_id] = {
            's3_upload_id': s3_upload_id,
            's3_key': s3_file_path,
            'parts': [],
            'total_size': file_size,
            'uploaded_size': 0
        }
        
        return jsonify(success=True, uploadId=upload_id)
        
    except Exception as e:
        print(f"Multipart upload başlatma hatası: {e}")
        return jsonify(success=False, error=str(e)), 500

@app.route('/upload-chunk', methods=['POST'])
def upload_chunk():
    """Dosya parçası yükle"""
    if not s3_client:
        return jsonify(success=False, error="S3 istemcisi bulunamadı"), 500
    
    upload_id = request.form.get('uploadId')
    chunk_number = int(request.form.get('chunkNumber'))
    chunk_data = request.files.get('chunk')
    
    if upload_id not in active_uploads:
        return jsonify(success=False, error="Upload ID bulunamadı"), 400
    
    upload_info = active_uploads[upload_id]
    
    try:
        # Chunk'ı S3'e yükle
        response = s3_client.upload_part(
            Bucket=AWS_S3_BUCKET_NAME,
            Key=upload_info['s3_key'],
            PartNumber=chunk_number,
            UploadId=upload_info['s3_upload_id'],
            Body=chunk_data.read()
        )
        
        # Part bilgisini sakla
        upload_info['parts'].append({
            'ETag': response['ETag'],
            'PartNumber': chunk_number
        })
        
        upload_info['uploaded_size'] += len(chunk_data.read())
        chunk_data.seek(0)  # Reset for re-read
        
        return jsonify(success=True, partNumber=chunk_number)
        
    except Exception as e:
        print(f"Chunk yükleme hatası: {e}")
        return jsonify(success=False, error=str(e)), 500

@app.route('/complete-upload', methods=['POST'])
def complete_upload():
    """Multipart upload'ı tamamla"""
    if not s3_client:
        return jsonify(success=False, error="S3 istemcisi bulunamadı"), 500
    
    data = request.get_json()
    upload_id = data['uploadId']
    
    if upload_id not in active_uploads:
        return jsonify(success=False, error="Upload ID bulunamadı"), 400
    
    upload_info = active_uploads[upload_id]
    
    try:
        # Part'ları sırala
        parts = sorted(upload_info['parts'], key=lambda x: x['PartNumber'])
        
        # Upload'ı tamamla
        s3_client.complete_multipart_upload(
            Bucket=AWS_S3_BUCKET_NAME,
            Key=upload_info['s3_key'],
            UploadId=upload_info['s3_upload_id'],
            MultipartUpload={'Parts': parts}
        )
        
        file_url = f"https://{AWS_S3_BUCKET_NAME}.s3.{AWS_S3_REGION}.amazonaws.com/{upload_info['s3_key']}"
        
        # Cleanup
        del active_uploads[upload_id]
        
        return jsonify(success=True, url=file_url)
        
    except Exception as e:
        print(f"Upload tamamlama hatası: {e}")
        return jsonify(success=False, error=str(e)), 500

@app.route('/cancel-upload', methods=['POST'])
def cancel_upload():
    """Upload'ı iptal et"""
    if not s3_client:
        return jsonify(success=False, error="S3 istemcisi bulunamadı"), 500
    
    data = request.get_json()
    upload_id = data['uploadId']
    
    if upload_id not in active_uploads:
        return jsonify(success=False, error="Upload ID bulunamadı"), 400
    
    upload_info = active_uploads[upload_id]
    
    try:
        # S3'teki multipart upload'ı iptal et
        s3_client.abort_multipart_upload(
            Bucket=AWS_S3_BUCKET_NAME,
            Key=upload_info['s3_key'],
            UploadId=upload_info['s3_upload_id']
        )
        
        # Cleanup
        del active_uploads[upload_id]
        
        return jsonify(success=True)
        
    except Exception as e:
        print(f"Upload iptal hatası: {e}")
        return jsonify(success=False, error=str(e)), 500

@app.route('/son', methods=['POST'])
def son():
    username = request.form.get('name')
    note_content = request.form.get('note')
    uploaded_files = request.files.getlist('file')

    if not username:
        flash('Lütfen bir kullanıcı adı girin!', 'error')
        return redirect(url_for('ana'))

    if not s3_client:
        flash('Depolama hizmeti (Amazon S3) ayarları eksik veya hatalı. Lütfen yöneticinizle iletişime geçin.', 'error')
        return redirect(url_for('ana'))

    if note_content:
        note_s3_url, note_error = upload_note_to_s3(username, note_content)
        if note_error:
            flash(f'Not yüklenirken bir hata oluştu: {note_error}', 'error')
        else:
            flash('Not başarıyla yüklendi.', 'success')

    for file in uploaded_files:
        if file and file.filename != '':
            file_s3_url, file_error = upload_file_to_s3(file, username)
            if file_error:
                flash(f"'{file.filename}' yüklenirken bir hata oluştu: {file_error}", 'error')
            else:
                flash(f"'{file.filename}' başarıyla yüklendi.", 'success')
        else:
            flash(f"Boş dosya seçildi veya dosya adı yok.", 'info')

    flash('Tüm işlemler tamamlandı!', 'success')
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
    filename = f"{username}_audio.wav"
    s3_audio_path = f"{username}/{filename}"
    try:
        s3_client.upload_fileobj(audio_file, AWS_S3_BUCKET_NAME, s3_audio_path)
        audio_url = f"https://{AWS_S3_BUCKET_NAME}.s3.{AWS_S3_REGION}.amazonaws.com/{s3_audio_path}"
        print(f"Ses kaydı S3'e yüklendi: {audio_url}")
        return jsonify(success=True, url=audio_url), 200
    except Exception as e:
        print(f"Hata: Ses kaydı yüklenirken bir sorun oluştu: {e}")
        return jsonify(success=False, error="Ses kaydı yüklenemedi."), 500

if __name__ == "__main__":
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=False, host='0.0.0.0', port=port)
