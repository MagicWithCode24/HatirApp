from flask import Flask, render_template, request, redirect, url_for
import os
from werkzeug.utils import secure_filename
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from google.oauth2.service_account import Credentials

app = Flask(__name__, template_folder='templates', static_folder='static')

SCOPES = ['https://www.googleapis.com/auth/drive.file']
SERVICE_ACCOUNT_FILE = 'path_to_your_credentials.json'

creds = Credentials.from_service_account_file(SERVICE_ACCOUNT_FILE, scopes=SCOPES)
drive_service = build('drive', 'v3', credentials=creds)

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

        folder_metadata = {'name': name, 'mimeType': 'application/vnd.google-apps.folder'}
        folder = drive_service.files().create(body=folder_metadata, fields='id').execute()
        folder_id = folder['id']

        for file in files:
            filename = secure_filename(file.filename)
            file_path = os.path.join('uploads', filename)
            file.save(file_path)
            media = MediaFileUpload(file_path, mimetype='image/jpeg')
            file_metadata = {'name': filename, 'parents': [folder_id]}
            drive_service.files().create(body=file_metadata, media_body=media, fields='id').execute()

        if note:
            note_filename = f'{name}_note.txt'
            with open(note_filename, 'w') as note_file:
                note_file.write(note)

            media = MediaFileUpload(note_filename, mimetype='text/plain')
            note_metadata = {'name': note_filename, 'parents': [folder_id]}
            drive_service.files().create(body=note_metadata, media_body=media, fields='id').execute()

        return redirect(url_for('home'))

    return render_template('son.html')

if __name__ == "__main__":
    app.run(debug=True)
