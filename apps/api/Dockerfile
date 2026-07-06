FROM python:3.13-slim 

WORKDIR /app 

# System deps (psycopg2 needs build deps sometimes; binary usually works but keep minimal)
RUN apt-get update && apt-get install -y --no-install-recommends \ 
    build-essential \
    && rm -rf /var/lib/apt/lists/* 

COPY requirements.txt /app/requirements.txt 
RUN pip install --no-cache-dir -r /app/requirements.txt 

COPY . /app

# Make sure start.sh is executable
RUN chmod +x /app/start.sh

EXPOSE 8000

CMD ["bash", "/app/start.sh"]