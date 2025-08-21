import os
from flask import Flask, request, jsonify, render_template
import boto3
from botocore.exceptions import ClientError

# Bir Flask uygulama örneği oluşturun.
app = Flask(__name__)

# --- AWS S3 Konfigürasyonu ---
# BURAYI KENDİ AWS KİMLİK BİLGİLERİNİZLE DEĞİŞTİRMELİSİNİZ.
# Önemli Not: Üretim ortamında, kimlik bilgilerini koda yazmak yerine
# IAM rollerini kullanmanız şiddetle tavsiye edilir.
AWS_ACCESS_KEY_ID = 'YOUR_AWS_ACCESS_KEY_ID'
AWS_SECRET_ACCESS_KEY = 'YOUR_AWS_SECRET_ACCESS_KEY'
AWS_REGION = 'us-east-1'  # AWS bölgenizi buraya yazın.

# S3 istemcisini başlatın.
s3 = boto3.client(
    's3',
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
    region_name=AWS_REGION
)
# -----------------------------

# Bu yol, ana sayfayı sunar.
@app.route('/')
def index():
    # 'templates' klasörünüzde 'index.html' adında bir şablonunuz olduğundan emin olun.
    return render_template('index.html')

# Bu yol, tüm form gönderimini (dosyalar dahil) işler.
@app.route('/upload', methods=['POST'])
def upload_data():
    # Form verilerini alın.
    first_name = request.form.get('firstName')
    last_name = request.form.get('lastName')
    note_content = request.form.get('noteContent')

    # İstekten gelen tüm dosyaları liste olarak alın.
    files = request.files.getlist('fileToUpload')
    audio_file = request.files.get('audioFile')

    # Ad ve soyad alanları için temel doğrulama yapın.
    if not first_name or not last_name:
        return jsonify({'success': False, 'message': 'Ad ve soyad zorunludur.'}), 400

    # Güvenli bir S3 bucket adı oluşturun.
    # S3 bucket adları benzersiz, küçük harf olmalı ve boşluk içermemelidir.
    bucket_name = f"{first_name.lower().replace(' ', '-')}-{last_name.lower().replace(' ', '-')}-user-uploads"

    try:
        # Bucket'ın var olup olmadığını kontrol edin. Yoksa oluşturun.
        # Bu güvenli bir kontroldür; bucket zaten varsa hata vermez.
        s3.head_bucket(Bucket=bucket_name)
    except ClientError as e:
        # Eğer bucket yoksa oluşturun.
        if e.response['Error']['Code'] == '404':
            s3.create_bucket(Bucket=bucket_name, CreateBucketConfiguration={'LocationConstraint': AWS_REGION})
        else:
            # Farklı bir hata türü varsa hatayı yeniden fırlatın.
            return jsonify({'success': False, 'message': f'Kova kontrol hatası: {e}'}), 500

    try:
        # --- Dosyaları işleyin (ses dosyası dahil) ---
        for file in files:
            if file and file.filename:
                # Dosya için bucket içinde basit bir yol kullanın.
                s3_file_path = f"{file.filename}"
                s3.upload_fileobj(file, bucket_name, s3_file_path)

        if audio_file and audio_file.filename:
            s3.upload_fileobj(audio_file, bucket_name, audio_file.filename)

        # --- Metin içeriğini (not) işleyin ---
        if note_content:
            note_filename = 'note.txt'
            # Not içeriğini bir metin dosyası olarak yükleyin.
            s3.put_object(
                Bucket=bucket_name,
                Key=note_filename,
                Body=note_content.encode('utf-8'),
                ContentType='text/plain'
            )

        return jsonify({'success': True, 'message': 'Tüm içerik başarıyla S3\'e yüklendi!'}), 200

    except Exception as e:
        # Diğer tüm genel yükleme hatalarını yakalayın.
        return jsonify({'success': False, 'message': f'Yükleme sırasında bir hata oluştu: {str(e)}'}), 500

if __name__ == '__main__':
    # Flask uygulamasını belirtilen bir portta çalıştırın.
    app.run(host='0.0.0.0', port=5000)
