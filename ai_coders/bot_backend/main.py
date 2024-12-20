from flask import Flask, jsonify
from flask_cors import CORS  # To handle CORS (Cross-Origin Resource Sharing)

# Initialize Flask app
app = Flask(__name__)

# Enable CORS for all routes
CORS(app)

@app.route('/')
def home():
    return "Backend Bot is running!"

@app.route('/api/data', methods=['GET'])
def get_data():
    # Return some sample data as a JSON response
    return jsonify({
        "status": "success",
        "message": "Hello from the backend!",
        "data": [1, 2, 3, 4, 5]
    })

if __name__ == '__main__':
    # Run the app, binding to all IP addresses (0.0.0.0) to allow external access
    app.run(host='0.0.0.0', port=5000)
