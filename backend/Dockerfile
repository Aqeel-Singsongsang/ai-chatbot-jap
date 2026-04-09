# Gunakan image dasar Python yang ringan namun memadai
FROM python:3.10-slim

# Set zona kerja di dalam container
WORKDIR /app

# Nonaktifkan buffer agar output logger bisa langsung dilihat (bagus untuk debug Hugging Face)
ENV PYTHONUNBUFFERED=1

# Salin daftar dependency
COPY requirements.txt .

# Install dependencies (Tanpa menyimpan cache untuk menekan ukuran docker)
RUN pip install --no-cache-dir -r requirements.txt

# Salin semua isi file code Backend
COPY . .

# Eksekusi API menggunakan Uvicorn di port 7860 (Wajib bagi HuggingFace Spaces)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
