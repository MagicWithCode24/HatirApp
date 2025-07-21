from flask import Flask, render_template, send_from_directory
import os

app = Flask(__name__)

# Ana sayfa
@app.route('/')
def home():
    return render_template('index.html')

# Diğer sayfalar
@app.route('/ana')
def ana():
    return render_template('ana.html')

@app.route('/son')
def son():
    return render_template('son.html')

# Statik dosyalar (CSS, JS)
@app.route('/static/<path:filename>')
def static_files(filename):
    return send_from_directory(os.path.join(app.root_path, 'static'), filename)

if __name__ == "__main__":
    app.run(debug=True)
