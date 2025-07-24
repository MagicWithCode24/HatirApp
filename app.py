import os
from flask import Flask, render_template, request, redirect, url_for, flash, jsonify # jsonify eklendi
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

# Yeni AJAX endpoint'i: Tek dosya veya not yüklemesi için
@app.route('/upload_item', methods=['POST'])
def upload_item():
    username = request.form.get('name')
    if not username:
        return jsonify({'success': False, 'error': 'Kullanıcı adı gerekli.'}), 400

    if 'file' in request.files:
        file = request.files['file']
        if file.filename == '':
            return jsonify({'success': False, 'error': 'Boş dosya adı.'}), 400
        
        file_s3_url, file_error = upload_file_to_s3(file, username)
        if file_error:
            return jsonify({'success': False, 'error': file_error}), 500
        else:
            return jsonify({'success': True, 'message': f"'{file.filename}' başarıyla yüklendi."}), 200
    
    elif 'note' in request.form:
        note_content = request.form.get('note')
        if not note_content:
            return jsonify({'success': False, 'error': 'Boş not içeriği.'}), 400

        note_s3_url, note_error = upload_note_to_s3(username, note_content)
        if note_error:
            return jsonify({'success': False, 'error': note_error}), 500
        else:
            return jsonify({'success': True, 'message': 'Not başarıyla yüklendi.'}), 200
    else:
        return jsonify({'success': False, 'error': 'Geçersiz istek. Dosya veya not bulunamadı.'}), 400


# Bu rota artık sadece yönlendirme alacak ve flash mesajlarını gösterecek.
# Dosya ve not yüklemesi /upload_item AJAX endpoint'i üzerinden yapılacak.
@app.route('/son', methods=['GET']) # Sadece GET isteklerini kabul et
def son():
    return render_template('son.html')


@app.route('/upload-audio', methods=['POST'])
def upload_audio():
    if 'audio' not in request.files:
        return jsonify({'success': False, 'error': 'Ses kaydı bulunamadı!'}), 400

    audio_file = request.files['audio']
    username = request.form.get('name')
    
    if not username:
        return jsonify({'success': False, 'error': 'Kullanıcı adı gerekli!'}), 400

    filename = secure_filename(audio_file.filename) # Güvenli dosya adı kullanımı
    s3_audio_path = f"{username}/{filename}"

    try:
        s3_client.upload_fileobj(audio_file, AWS_S3_BUCKET_NAME, s3_audio_path)
        audio_url = f"https://{AWS_S3_BUCKET_NAME}.s3.{AWS_S3_REGION}.amazonaws.com/{s3_audio_path}"
        print(f"Ses kaydı S3'e yüklendi: {audio_url}")
        return jsonify({'success': True, 'message': 'Ses kaydı başarıyla yüklendi.', 'url': audio_url}), 200
    except Exception as e:
        print(f"Hata: Ses kaydı yüklenirken bir sorun oluştu: {e}")
        return jsonify({'success': False, 'error': f"Ses kaydı yüklenirken hata oluştu: {e}"}), 500

if __name__ == "__main__":
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=False, host='0.0.0.0', port=port)
