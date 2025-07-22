from flask import Flask, render_template, request, redirect, url_for
import os
import json
from werkzeug.utils import secure_filename
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from google.oauth2.service_account import Credentials

app = Flask(__name__)

json_key_string = os.getenv('DRIVE_KEY')

if json_key_string is None:
    raise ValueError("DRIVE_KEY ortam değişkeni tanımlı değil.")

try:
    service_account_info = json.loads(json_key_string)
    creds = Credentials.from_service_account_info(service_account_info, scopes=['https://www.googleapis.com/auth/drive'])
    drive_service = build('drive', 'v3', credentials=creds)
    print("Google Drive servisi başarıyla başlatıldı ve yetkilendirildi.")
except json.JSONDecodeError:
    raise ValueError("DRIVE_KEY ortam değişkeninin içeriği geçerli bir JSON formatında değil.")
except Exception as e:
    raise Exception(f"Google Drive kimlik bilgileri yüklenirken veya servis başlatılırken bir hata oluştu: {e}")

if not os.path.exists('uploads'):
    os.makedirs('uploads')
    print("uploads klasörü oluşturuldu.")

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/ana')
def ana():
    return render_template('ana.html')

@app.route('/son', methods=['POST', 'GET'])
def son():
    if request.method == 'POST':
        name = request.form['name']
        files = request.files.getlist('file')
        note = request.form['note']

        MAIN_DRIVE_FOLDER_ID = '1vN1Bd5aWh2OmmRv1IXM159Ky5Xve6f5O'

        uploaded_temp_files = []

        try:
            query = f"name = '{name}' and mimeType = 'application/vnd.google-apps.folder' and '{MAIN_DRIVE_FOLDER_ID}' in parents and trashed = false"
            results = drive_service.files().list(q=query, fields="files(id, name)").execute()
            
            user_folder_id = None
            if results.get('files'):
                user_folder_id = results['files'][0]['id']
                print(f"Drive'da '{name}' klasörü zaten var. ID: {user_folder_id}")
            else:
                folder_metadata = {
                    'name': name,
                    'mimeType': 'application/vnd.google-apps.folder',
                    'parents': [MAIN_DRIVE_FOLDER_ID]
                }
                folder = drive_service.files().create(body=folder_metadata, fields='id').execute()
                user_folder_id = folder['id']
                print(f"Drive'da '{name}' klasörü oluşturuldu. ID: {user_folder_id}")

            for file in files:
                if file.filename == '':
                    continue 

                filename = secure_filename(file.filename)
                file_path = os.path.join('uploads', filename)
                
                try:
                    file.save(file_path)
                    uploaded_temp_files.append(file_path)

                    mimetype = file.content_type if file.content_type else 'application/octet-stream'

                    media = MediaFileUpload(file_path, mimetype=mimetype, resumable=True)
                    file_metadata = {'name': filename, 'parents': [user_folder_id]}
                    drive_service.files().create(body=file_metadata, media_body=media, fields='id').execute()
                    print(f"'{filename}' Google Drive'a yüklendi.")
                except Exception as file_upload_e:
                    print(f"Hata: '{filename}' yüklenirken bir sorun oluştu: {file_upload_e}")
                    continue 

            if note:
                note_filename = f'{name}_note.txt'
                note_file_path = os.path.join('uploads', note_filename)
                
                try:
                    with open(note_file_path, 'w', encoding='utf-8') as note_file: 
                        note_file.write(note)
                    uploaded_temp_files.append(note_file_path)

                    media = MediaFileUpload(note_file_path, mimetype='text/plain', resumable=True)
                    note_metadata = {'name': note_filename, 'parents': [user_folder_id]}
                    drive_service.files().create(body=note_metadata, media_body=media, fields='id').execute()
                    print(f"Not dosyası '{note_filename}' Google Drive'a yüklendi.")
                except Exception as note_upload_e:
                    print(f"Hata: Not dosyası yüklenirken bir sorun oluştu: {note_upload_e}")

            return redirect(url_for('home'))

        except Exception as e:
            print(f"Genel bir hata oluştu: {e}")
            return "Dosya yükleme sırasında beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.", 500
        finally:
            for temp_file_path in uploaded_temp_files:
                if os.path.exists(temp_file_path):
                    try:
                        os.remove(temp_file_path)
                        print(f"Geçici dosya silindi: {temp_file_path}")
                    except Exception as clean_e:
                        print(f"Hata: Geçici dosya silinirken sorun oluştu '{temp_file_path}': {clean_e}")

    return render_template('son.html')

if __name__ == "__main__":
    app.run(debug=True)
