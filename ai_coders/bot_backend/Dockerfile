# Use Python 3.9 for the backend bot
FROM python:3.9-slim

# Set the working directory
WORKDIR /usr/src/app

# Copy requirements and install dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . .

# Expose the port
EXPOSE 5000

# Run the backend bot
CMD ["python", "main.py"]
