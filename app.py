import os
from flask import Flask, render_template, request, redirect, url_for, flash, jsonify
from werkzeug.utils import secure_filename
import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'your_super_secret_key')

AWS_ACCESS_KEY_ID = os.environ.get('AWS_ACCESS_KEY_ID')
AWS_SECRET_ACCESS_KEY = os.environ.get('AWS_SECRET_ACCESS_KEY')
AWS_S3_REGION = os.environ.get('AWS_S3_REGION')
BASE_BUCKET_NAME = os.environ.get('AWS_S3_BUCKET_NAME')

s3_client = None
if AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY and BASE_BUCKET_NAME and AWS_S3_REGION:
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

def create_s3_bucket_if_not_exists(bucket_name, region):
    if not s3_client:
        return False, "S3 istemcisi başlatılmadı."
    
    try:
        s3_client.head_bucket(Bucket=bucket_name)
        print(f"Bucket '{bucket_name}' zaten mevcut.")
        return True, None
    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == '404':
            try:
                if region == 'us-east-1':
                    s3_client.create_bucket(Bucket=bucket_name)
                else:
                    s3_client.create_bucket(Bucket=bucket_name, CreateBucketConfiguration={'LocationConstraint': region})
                print(f"Bucket '{bucket_name}' başarıyla oluşturuldu.")
                return True, None
            except ClientError as ce:
                print(f"HATA: Bucket oluşturulurken hata oluştu: {ce}")
                return False, f"Bucket oluşturma hatası: {ce}"
        else:
            print(f"HATA: Bucket kontrol edilirken hata oluştu: {e}")
            return False, f"Bucket kontrol hatası: {e}"

def upload_file_to_s3(file, username):
    if not s3_client:
        return None, "S3 istemcisi başlatılmadı veya kimlik bilgileri eksik."

    filename = secure_filename(file.filename)
    s3_file_path = f"{username}/{filename}"

    try:
        s3_client.upload_fileobj(file, username, s3_file_path)
        print(f"'{filename}' S3'e yüklendi: s3://{username}/{s3_file_path}")
        return f"https://{username}.s3.{AWS_S3_REGION}.amazonaws.com/{s3_file_path}", None
    except Exception as e:
        print(f"Hata: '{filename}' S3'e yüklenirken bir sorun oluştu: {e}")
        return None, f"S3 yükleme hatası: {e}"

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/ana')
def ana():
    return render_template('ana.html')

@app.route('/son', methods=['POST'])
def son():
    username = request.form.get('name', '').replace(' ', '-').lower()
    uploaded_files = request.files.getlist('files')

    if not username:
        return jsonify(success=False, error="Lütfen adınızı ve soyadınızı girin."), 400

    if not uploaded_files:
        return jsonify(success=False, error="Yüklenecek dosya veya not bulunamadı."), 400

    if not s3_client:
        return jsonify(success=False, error="Depolama hizmeti (Amazon S3) ayarları eksik veya hatalı."), 500

    # Kullanıcı adına göre S3 bucket'ı oluştur (veya varlığını kontrol et)
    is_bucket_ready, bucket_error = create_s3_bucket_if_not_exists(username, AWS_S3_REGION)
    if not is_bucket_ready:
        print(f"Bucket '{username}' oluşturulamadı: {bucket_error}")
        return jsonify(success=False, error=f"Depolama klasörü oluşturulurken hata oluştu: {bucket_error}"), 500

    errors = []
    for file in uploaded_files:
        if file and file.filename != '':
            file_s3_url, file_error = upload_file_to_s3(file, username)
            if file_error:
                errors.append(f"'{file.filename}' yüklenirken hata: {file_error}")
        else:
            errors.append("Boş dosya bulundu.")
    
    if errors:
        return jsonify(success=False, error="Yüklemelerden bazıları başarısız oldu: " + " ".join(errors)), 500
    else:
        return jsonify(success=True, message="Tüm dosyalar başarıyla yüklendi!"), 200

@app.route('/son')
def son_page():
    return render_template('son.html')

if __name__ == "__main__":
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=False, host='0.0.0.0', port=port)
