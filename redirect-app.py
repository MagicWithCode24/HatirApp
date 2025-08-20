from flask import Flask, redirect

redirect_app = Flask(__name__)

@redirect_app.route('/', defaults={'path': ''})
@redirect_app.route('/<path:path>')
def redirect_to_domain(path):
    return redirect(f'https://hatirapp.site/{path}', code=302)

if __name__ == "__main__":
    redirect_app.run(host='0.0.0.0', port=5000)
