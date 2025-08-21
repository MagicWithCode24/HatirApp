import os
from flask import Flask, render_template, request, redirect, url_for, flash, jsonify
from werkzeug.utils import secure_filename
import boto3
from botocore.client import Config

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

def upload_file_to_s3(file, username, filename):
    """Tek bir dosyayı S3'e yükler"""
    if not s3_client:
        return None, "S3 istemcisi başlatılmadı veya kimlik bilgileri eksik."

    secure_filename_result = secure_filename(filename)
    s3_file_path = f"{username}/{secure_filename_result}"

    try:
        # Dosya pointer'ını başa al
        file.seek(0)
        
        s3_client.upload_fileobj(file, AWS_S3_BUCKET_NAME, s3_file_path)
        print(f"'{filename}' S3'e yüklendi: s3://{AWS_S3_BUCKET_NAME}/{s3_file_path}")
        return f"https://{AWS_S3_BUCKET_NAME}.s3.{AWS_S3_REGION}.amazonaws.com/{s3_file_path}", None
    except Exception as e:
        print(f"Hata: '{filename}' S3'e yüklenirken bir sorun oluştu: {e}")
        return None, f"S3 yükleme hatası: {e}"

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/ana')
def ana():
    return render_template('ana.html')

@app.route('/upload-all', methods=['POST'])
def upload_all():
    """Tüm dosyaları tek seferde S3'e yükler"""
    username = request.form.get('name')
    uploaded_files = request.files.getlist('files')

    if not username or not username.strip():
        return jsonify(success=False, error="Kullanıcı adı gerekli."), 400

    if not s3_client:
        return jsonify(success=False, error="Depolama hizmeti ayarları eksik."), 500

    if not uploaded_files or len(uploaded_files) == 0:
        return jsonify(success=False, error="Yüklenecek dosya bulunamadı."), 400

    # Başarılı ve başarısız yüklemeleri takip et
    successful_uploads = []
    failed_uploads = []

    for file in uploaded_files:
        if file and file.filename != '':
            # Dosya adını temizle
            original_filename = file.filename
            
            # Dosya uzantısını koru
            file_s3_url, file_error = upload_file_to_s3(file, username, original_filename)
            
            if file_error:
                failed_uploads.append(f"'{original_filename}': {file_error}")
                print(f"Yükleme hatası - {original_filename}: {file_error}")
            else:
                successful_uploads.append(original_filename)
                print(f"Başarıyla yüklendi - {original_filename}")

    # Sonuçları değerlendir
    if len(failed_uploads) > 0 and len(successful_uploads) == 0:
        # Hiçbir dosya yüklenemedi
        return jsonify(
            success=False, 
            error=f"Hiçbir dosya yüklenemedi. Hatalar: {'; '.join(failed_uploads)}"
        ), 500
    elif len(failed_uploads) > 0:
        # Bazı dosyalar yüklendi, bazıları yüklenemedi
        return jsonify(
            success=True, 
            message=f"{len(successful_uploads)} dosya başarıyla yüklendi. {len(failed_uploads)} dosyada hata oluştu.",
            successful_uploads=successful_uploads,
            failed_uploads=failed_uploads
        ), 200
    else:
        # Tüm dosyalar başarıyla yüklendi
        return jsonify(
            success=True, 
            message=f"Tüm dosyalar ({len(successful_uploads)} adet) başarıyla yüklendi.",
            successful_uploads=successful_uploads
        ), 200

@app.route('/son', methods=['POST'])
def son():
    """Eski endpoint - sadece geriye dönük uyumluluk için"""
    return redirect(url_for('son_page'))

@app.route('/son')
def son_page():
    return render_template('son.html')

# Eski upload-audio endpoint'ini kaldırdık çünkü artık tüm dosyalar tek seferde yükleniyor

if __name__ == "__main__":
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=False, host='0.0.0.0', port=port)
