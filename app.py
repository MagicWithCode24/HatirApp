import os
from flask import Flask, render_template, request, redirect, url_for, flash, jsonify
from werkzeug.utils import secure_filename
import boto3
from botocore.client import Config

app = Flask(__name__)

# Flask'in toplam istek boyutu limiti (3 GB)
# 1 GB = 1024 * 1024 * 1024 = 1073741824 bytes
# 3 GB = 3 * 1073741824 = 3221225472 bytes
app.config['MAX_CONTENT_LENGTH'] = 3 * 1024 * 1024 * 1024

# Her bir dosya için dosya boyutu limiti (30 MB)
# 30 MB = 30 * 1024 * 1024 = 31457280 bytes
MAX_FILE_SIZE = 30 * 1024 * 1024

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

def upload_file_to_s3(file, username):
    if not s3_client:
        return None, "S3 istemcisi başlatılmadı veya kimlik bilgileri eksik."
    
    # Dosya boyutunu kontrol et
    # file.seek(0, os.SEEK_END) ile dosyanın boyutunu al
    # Ardından dosyanın başına dönmek için file.seek(0) kullan
    file.seek(0, os.SEEK_END)
    file_size = file.tell()
    file.seek(0)
    
    if file_size > MAX_FILE_SIZE:
        return None, f"Dosya boyutu {MAX_FILE_SIZE / 1024 / 1024:.2f} MB'den büyük olamaz."

    filename = secure_filename(file.filename)
    s3_file_path = f"{username}/{filename}"
    try:
        s3_client.upload_fileobj(file, AWS_S3_BUCKET_NAME, s3_file_path)
        print(f"'{filename}' S3'e yüklendi: s3://{AWS_S3_BUCKET_NAME}/{s3_file_path}")
        return f"https://{AWS_S3_BUCKET_NAME}.s3.{AWS_S3_REGION}[.amazonaws.com/](https://.amazonaws.com/){s3_file_path}", None
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
        return f"https://{AWS_S3_BUCKET_NAME}.s3.{AWS_S3_REGION}[.amazonaws.com/](https://.amazonaws.com/){s3_note_path}", None
    except Exception as e:
        print(f"Hata: Not dosyası S3'e yüklenirken bir sorun oluştu: {e}")
        return None, f"S3 not yükleme hatası: {e}"

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
        audio_url = f"https://{AWS_S3_BUCKET_NAME}.s3.{AWS_S3_REGION}[.amazonaws.com/](https://.amazonaws.com/){s3_audio_path}"
        print(f"Ses kaydı S3'e yüklendi: {audio_url}")
        return jsonify(success=True, url=audio_url), 200
    except Exception as e:
        print(f"Hata: Ses kaydı yüklenirken bir sorun oluştu: {e}")
        return jsonify(success=False, error="Ses kaydı yüklenemedi."), 500

if __name__ == "__main__":
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=False, host='0.0.0.0', port=port)
