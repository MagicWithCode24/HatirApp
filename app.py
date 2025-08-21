import os
from flask import Flask, render_template, request, redirect, url_for, flash, jsonify
from werkzeug.utils import secure_filename
import boto3
from botocore.client import Config
from datetime import datetime

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

def upload_file_to_s3(file, username, custom_filename=None):
    if not s3_client:
        return None, "S3 istemcisi başlatılmadı veya kimlik bilgileri eksik."

    # Özel dosya adı varsa onu kullan, yoksa orijinal adı güvenli hale getir
    filename = custom_filename if custom_filename else secure_filename(file.filename)
    s3_file_path = f"{username}/{filename}"

    try:
        # Content-Type'ı dosya tipine göre belirle
        content_type = file.content_type or 'application/octet-stream'
        
        s3_client.upload_fileobj(
            file, 
            AWS_S3_BUCKET_NAME, 
            s3_file_path,
            ExtraArgs={'ContentType': content_type}
        )
        print(f"'{filename}' S3'e yüklendi: s3://{AWS_S3_BUCKET_NAME}/{s3_file_path}")
        return f"https://{AWS_S3_BUCKET_NAME}.s3.{AWS_S3_REGION}.amazonaws.com/{s3_file_path}", None
    except Exception as e:
        print(f"Hata: '{filename}' S3'e yüklenirken bir sorun oluştu: {e}")
        return None, f"S3 yükleme hatası: {e}"

def upload_note_to_s3(username, note_content):
    if not s3_client:
        return None, "S3 istemcisi başlatılmadı veya kimlik bilgileri eksik."

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    note_filename = f"{username}_note_{timestamp}.txt"
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

@app.route('/son', methods=['POST'])
def son():
    username = request.form.get('name')
    note_content = request.form.get('note')
    
    # BASITLEŞTIRME: Sadece 'file' parametresini kullan (eski sistem)
    uploaded_files = request.files.getlist('file')

    print(f"📝 Alınan parametreler:")
    print(f"   - Username: {username}")
    print(f"   - Note: {'Var' if note_content else 'Yok'}")
    print(f"   - Dosya sayısı: {len(uploaded_files)}")
    
    if not username:
        flash('Lütfen bir kullanıcı adı girin!', 'error')
        return redirect(url_for('ana'))

    if not s3_client:
        flash('Depolama hizmeti (Amazon S3) ayarları eksik veya hatalı. Lütfen yöneticinizle iletişime geçin.', 'error')
        return redirect(url_for('ana'))

    upload_success_count = 0
    upload_error_count = 0
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')

    # Not yükleme (sadece içerik varsa)
    if note_content and note_content.strip():
        print("📄 Not yükleniyor...")
        note_s3_url, note_error = upload_note_to_s3(username, note_content)
        if note_error:
            flash(f'Not yüklenirken bir hata oluştu: {note_error}', 'error')
            upload_error_count += 1
            print(f"❌ Not yüklenemedi: {note_error}")
        else:
            flash('Not başarıyla yüklendi.', 'success')
            upload_success_count += 1
            print(f"✅ Not yüklendi")

    # Dosya yükleme
    if uploaded_files:
        print(f"📁 Toplam işlenecek dosya sayısı: {len(uploaded_files)}")
        
        for index, file in enumerate(uploaded_files):
            if file and file.filename != '':
                print(f"📤 İşleniyor ({index+1}/{len(uploaded_files)}): {file.filename} ({file.content_type})")
                
                # Dosya adını benzersiz yap
                original_filename = secure_filename(file.filename)
                unique_filename = f"{timestamp}_{index+1}_{original_filename}"
                
                file_s3_url, file_error = upload_file_to_s3(file, username, unique_filename)
                if file_error:
                    flash(f"'{file.filename}' yüklenirken bir hata oluştu: {file_error}", 'error')
                    upload_error_count += 1
                    print(f"❌ Hata: {file.filename} - {file_error}")
                else:
                    flash(f"'{file.filename}' başarıyla yüklendi.", 'success')
                    upload_success_count += 1
                    print(f"✅ Başarılı: {file.filename}")
            else:
                print(f"⚠️ Boş dosya atlandı: {getattr(file, 'filename', 'Unknown')}")
    else:
        print("⚠️ Hiç dosya bulunamadı")

    # Özet mesaj
    if upload_success_count > 0:
        flash(f'Toplam {upload_success_count} öğe başarıyla yüklendi!', 'success')
        print(f"🎉 Toplam başarı: {upload_success_count} öğe")
    
    if upload_error_count > 0:
        flash(f'{upload_error_count} öğe yüklenirken hata oluştu.', 'error')
        print(f"⚠️ Toplam hata: {upload_error_count} öğe")
    
    if upload_success_count == 0 and upload_error_count == 0:
        flash('Yüklenecek içerik bulunamadı.', 'info')
        print("ℹ️ Hiçbir içerik yüklenmedi")

    return redirect(url_for('son_page'))

@app.route('/son')
def son_page():
    return render_template('son.html')

@app.route('/upload-audio', methods=['POST'])
def upload_audio():
    if 'audio' not in request.files:
        return jsonify(success=False, error="Ses kaydı bulunamadı."), 400

    audio_file = request.files['audio']
    username = request.form.get('name', 'anonymous')
    
    # Benzersiz ses dosyası adı oluştur
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"{username}_audio_{timestamp}.wav"
    s3_audio_path = f"{username}/{filename}"

    try:
        s3_client.upload_fileobj(
            audio_file, 
            AWS_S3_BUCKET_NAME, 
            s3_audio_path,
            ExtraArgs={'ContentType': 'audio/wav'}
        )
        audio_url = f"https://{AWS_S3_BUCKET_NAME}.s3.{AWS_S3_REGION}.amazonaws.com/{s3_audio_path}"
        print(f"Ses kaydı S3'e yüklendi: {audio_url}")
        return jsonify(success=True, url=audio_url), 200
    except Exception as e:
        print(f"Hata: Ses kaydı yüklenirken bir sorun oluştu: {e}")
        return jsonify(success=False, error="Ses kaydı yüklenemedi."), 500

if __name__ == "__main__":
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=False, host='0.0.0.0', port=port)
