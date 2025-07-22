from flask import Flask, render_template, request, redirect, url_for, session
import os
import json
from werkzeug.utils import secure_filename
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
import pathlib

app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY', 's1mpl3-k3y')

google_client_secret_json = os.getenv("GOOGLE_CLIENT_SECRET")
client_secret = json.loads(google_client_secret_json)

SCOPES = ['https://www.googleapis.com/auth/drive.file']

REDIRECT_URI = os.getenv('REDIRECT_URI', 'https://hatirapp.onrender.com/oauth2callback')

UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

flow = Flow.from_client_config(client_secret, SCOPES)
flow.redirect_uri = REDIRECT_URI

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/ana')
def ana():
    return render_template('ana.html')

@app.route('/authorize')
def authorize():
    authorization_url, state = flow.authorization_url(access_type='offline', include_granted_scopes='true')
    session['state'] = state
    return redirect(authorization_url)

@app.route('/oauth2callback')
def oauth2callback():
    flow.fetch_token(authorization_response=request.url)

    credentials = flow.credentials
    session['credentials'] = credentials_to_dict(credentials)

    drive_service = build('drive', 'v3', credentials=credentials)

    return redirect(url_for('son'))

@app.route('/son', methods=['POST', 'GET'])
def son():
    if 'credentials' not in session:
        return redirect(url_for('authorize'))

    credentials = session['credentials']
    drive_service = build('drive', 'v3', credentials=credentials)

    if request.method == 'POST':
        name = request.form['name']
        files = request.files.getlist('file')
        note = request.form['note']

        MAIN_DRIVE_FOLDER_ID = '1YUWbnWe9IVNkteJW9Neb3S2cABgUHVjr'

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
                file_path = os.path.join(UPLOAD_FOLDER, filename)

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
                note_file_path = os.path.join(UPLOAD_FOLDER, note_filename)

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


def credentials_to_dict(creds):
    return {
        'token': creds.token,
        'refresh_token': creds.refresh_token,
        'token_uri': creds.token_uri,
        'client_id': creds.client_id,
        'client_secret': creds.client_secret,
        'scopes': creds.scopes
    }

if __name__ == "__main__":
    app.run(debug=True)
