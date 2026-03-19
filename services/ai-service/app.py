import os
from flask import Flask
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'), override=True)

app = Flask(__name__)


@app.route('/health', methods=['GET'])
def health():
    return {'status': 'ok'}


# Import and register blueprints
from resume_parser import resume_bp
from job_parser import job_bp
from resume_tailor import tailor_bp
from scorer import scorer_bp

app.register_blueprint(resume_bp)
app.register_blueprint(job_bp)
app.register_blueprint(tailor_bp)
app.register_blueprint(scorer_bp)

if __name__ == '__main__':
    port = int(os.getenv('AI_SERVICE_PORT', '8000'))
    app.run(host='0.0.0.0', port=port, debug=os.getenv('NODE_ENV') == 'development')
