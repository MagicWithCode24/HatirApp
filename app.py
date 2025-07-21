from flask import Flask, send_from_directory

app = Flask(__name__)

@app.route('/')
def serve_html():
    return send_from_directory('.', 'index.html')

if __name__ == '__main__':
    app.run(debug=True)
