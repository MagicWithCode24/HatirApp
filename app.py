import os
from flask import Flask, render_template, request, redirect, url_for, flash, jsonify
from werkzeug.utils import secure_filename
import boto3
from botocore.client import Config
import logging

# Loglama ayarları
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'your_super_secret_key')

# AWS S3 ortam değişkenleri
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
        logger.info("Amazon S3 istemcisi başarıyla başlatıldı.")
    except Exception as e:
        logger.error(f"HATA: Amazon S3 istemcisi başlatılırken bir sorun oluştu: {e}")
        s3_client = None
else:
    logger.warning("UYARI: AWS S3 ortam değişkenleri eksik. Dosya yüklemeleri çalışmayacak.")

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/ana')
def ana():
    return render_template('ana.html')

@app.route('/son')
def son_page():
    return render_template('son.html')

# Yeni uç nokta: Ön-imzalı URL almak için
@app.route('/get-presigned-url', methods=['POST'])
def get_presigned_url():
    if not s3_client:
        return jsonify(success=False, error="S3 istemcisi başlatılmadı veya kimlik bilgileri eksik."), 500

    data = request.json
    filename = data.get('filename')
    username = data.get('username')
    file_type = data.get('file_type')

    if not filename or not username:
        return jsonify(success=False, error="Dosya adı veya kullanıcı adı eksik."), 400

    # Dosya adını güvenli hale getir
    safe_filename = secure_filename(filename)
    s3_path = f"{username}/{safe_filename}"

    try:
        # S3'e dosya yüklemek için bir PUT isteği oluşturacak ön-imzalı URL oluştur
        presigned_url = s3_client.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': AWS_S3_BUCKET_NAME,
                'Key': s3_path,
                'ContentType': file_type
            },
            ExpiresIn=3600 # URL 1 saat geçerli olacak
        )
        logger.info(f"'{safe_filename}' için ön-imzalı URL oluşturuldu.")
        return jsonify(success=True, url=presigned_url, key=s3_path), 200
    except Exception as e:
        logger.error(f"Hata: Ön-imzalı URL oluşturulurken bir sorun oluştu: {e}")
        return jsonify(success=False, error=str(e)), 500

# Not metni yükleme uç noktası
@app.route('/upload-note', methods=['POST'])
def upload_note_endpoint():
    if not s3_client:
        return jsonify(success=False, error="S3 istemcisi başlatılmadı veya kimlik bilgileri eksik."), 500
    
    data = request.json
    username = data.get('name')
    note_content = data.get('note')

    if not username or not note_content:
        return jsonify(success=False, error="Kullanıcı adı veya not içeriği eksik."), 400

    note_filename = f"{username}_note.txt"
    s3_note_path = f"{username}/{note_filename}"

    try:
        s3_client.put_object(
            Bucket=AWS_S3_BUCKET_NAME,
            Key=s3_note_path,
            Body=note_content.encode('utf-8'),
            ContentType='text/plain'
        )
        logger.info(f"Not dosyası S3'e yüklendi: {s3_note_path}")
        return jsonify(success=True), 200
    except Exception as e:
        logger.error(f"Hata: Not dosyası S3'e yüklenirken bir sorun oluştu: {e}")
        return jsonify(success=False, error=str(e)), 500

if __name__ == "__main__":
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=False, host='0.0.0.0', port=port)
