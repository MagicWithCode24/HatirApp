import os
from flask import Flask, render_template, request, redirect, url_for, flash, jsonify
from werkzeug.utils import secure_filename
import boto3
from botocore.client import Config
import time

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'your_super_secret_key')

# MOBİL OPTİMİZASYON: Dosya boyutu limitlerini düşürdüm
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB (50GB çok fazlaydı)
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 31536000

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
            config=Config(
                signature_version='s3v4',
                retries={'max_attempts': 3},
                read_timeout=120,  # MOBİL OPTİMİZASYON: 2 dakika (5 dakika çok uzundu)
                connect_timeout=30,  # MOBİL OPTİMİZASYON: 30 saniye
                max_pool_connections=10  # Bağlantı havuzunu sınırla
            )
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
    
    filename = secure_filename(file.filename)
    # Zaman damgası ekleyerek dosya ismi çakışmalarını önle
    timestamp = str(int(time.time()))
    name_parts = filename.rsplit('.', 1)
    if len(name_parts) == 2:
        filename = f"{name_parts[0]}_{timestamp}.{name_parts[1]}"
    else:
        filename = f"{filename}_{timestamp}"
    
    s3_file_path = f"{username}/{filename}"
    
    try:
        # MOBİL OPTİMİZASYON: Metadata ekle
        extra_args = {
            'ContentType': file.content_type or 'application/octet-stream',
            'CacheControl': 'max-age=31536000',  # 1 yıl cache
        }
        
        s3_client.upload_fileobj(
            file, 
            AWS_S3_BUCKET_NAME, 
            s3_file_path,
            ExtraArgs=extra_args
        )
        print(f"'{filename}' S3'e yüklendi: s3://{AWS_S3_BUCKET_NAME}/{s3_file_path}")
        return f"https://{AWS_S3_BUCKET_NAME}.s3.{AWS_S3_REGION}.amazonaws.com/{s3_file_path}", None
    except Exception as e:
        print(f"Hata: '{filename}' S3'e yüklenirken bir sorun oluştu: {e}")
        return None, f"S3 yükleme hatası: {str(e)[:100]}..."  # Hata mesajını kısalt

def upload_note_to_s3(username, note_content):
    if not s3_client:
        return None, "S3 istemcisi başlatılmadı veya kimlik bilgileri eksik."
    
    timestamp = str(int(time.time()))
    note_filename = f"{username}_note_{timestamp}.txt"
    s3_note_path = f"{username}/{note_filename}"
    
    try:
        s3_client.put_object(
            Bucket=AWS_S3_BUCKET_NAME,
            Key=s3_note_path,
            Body=note_content.encode('utf-8'),
            ContentType='text/plain; charset=utf-8',
            CacheControl='max-age=31536000'
        )
        print(f"Not dosyası S3'e yüklendi: s3://{AWS_S3_BUCKET_NAME}/{s3_note_path}")
        return f"https://{AWS_S3_BUCKET_NAME}.s3.{AWS_S3_REGION}.amazonaws.com/{s3_note_path}", None
    except Exception as e:
        print(f"Hata: Not dosyası S3'e yüklenirken bir sorun oluştu: {e}")
        return None, f"S3 not yükleme hatası: {str(e)[:100]}..."

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

    # MOBİL OPTİMİZASYON: İşlem durumu takibi
    total_operations = len([f for f in uploaded_files if f.filename]) + (1 if note_content else 0)
    completed_operations = 0
    
    print(f"Toplam işlem sayısı: {total_operations}")

    # Not yükleme
    if note_content:
        note_s3_url, note_error = upload_note_to_s3(username, note_content)
        completed_operations += 1
        if note_error:
            flash(f'Not yüklenirken bir hata oluştu: {note_error}', 'error')
        else:
            flash('Not başarıyla yüklendi.', 'success')
            print(f"İlerleme: {completed_operations}/{total_operations}")

    # Dosya yükleme - MOBİL OPTİMİZASYON: Hızlı fail
    for file in uploaded_files:
        if file and file.filename != '':
            # Dosya boyutu kontrol et
            file.seek(0, 2)  # Dosya sonuna git
            file_size = file.tell()
            file.seek(0)  # Başa dön
            
            if file_size > 15 * 1024 * 1024:  # 15MB limit
                flash(f"'{file.filename}' çok büyük (15MB üzeri). Atlandı.", 'warning')
                continue
            
            file_s3_url, file_error = upload_file_to_s3(file, username)
            completed_operations += 1
            
            if file_error:
                flash(f"'{file.filename}' yüklenirken hata: {file_error}", 'error')
            else:
                flash(f"'{file.filename}' başarıyla yüklendi.", 'success')
            
            print(f"İlerleme: {completed_operations}/{total_operations}")

    if completed_operations > 0:
        flash(f'İşlemler tamamlandı! ({completed_operations}/{total_operations})', 'success')
    else:
        flash('Hiçbir dosya yüklenemedi.', 'warning')
    
    return redirect(url_for('son_page'))

@app.route('/son')
def son_page():
    return render_template('son.html')

@app.route('/upload-audio', methods=['POST'])
def upload_audio():
    # MOBİL OPTİMİZASYON: S3 client kontrolü ekledim
    if not s3_client:
        return jsonify(success=False, error="S3 istemcisi başlatılmadı."), 500
        
    if 'audio' not in request.files:
        return jsonify(success=False, error="Ses kaydı bulunamadı."), 400
    
    audio_file = request.files['audio']
    username = request.form.get('name')
    
    if not username:
        return jsonify(success=False, error="Kullanıcı adı eksik."), 400
    
    # MOBİL OPTİMİZASYON: Ses dosyası boyut kontrolü
    audio_file.seek(0, 2)
    file_size = audio_file.tell()
    audio_file.seek(0)
    
    if file_size > 2000 * 1024 * 1024:  # 10MB ses dosyası limiti
        return jsonify(success=False, error="Ses kaydı çok büyük (10MB üzeri)."), 400
    
    timestamp = str(int(time.time()))
    filename = f"{username}_audio_{timestamp}.wav"
    s3_audio_path = f"{username}/{filename}"
    
    try:
        s3_client.upload_fileobj(
            audio_file, 
            AWS_S3_BUCKET_NAME, 
            s3_audio_path,
            ExtraArgs={
                'ContentType': 'audio/wav',
                'CacheControl': 'max-age=31536000'
            }
        )
        audio_url = f"https://{AWS_S3_BUCKET_NAME}.s3.{AWS_S3_REGION}.amazonaws.com/{s3_audio_path}"
        print(f"Ses kaydı S3'e yüklendi: {audio_url}")
        return jsonify(success=True, url=audio_url), 200
    except Exception as e:
        print(f"Hata: Ses kaydı yüklenirken bir sorun oluştu: {e}")
        return jsonify(success=False, error="Ses kaydı yüklenemedi."), 500

if __name__ == "__main__":
    port = int(os.environ.get('PORT', 5000))
    # MOBİL OPTİMİZASYON: Threaded=True performans için önemli
    app.run(debug=False, host='0.0.0.0', port=port, threaded=True)
