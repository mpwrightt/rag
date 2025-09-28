# Deploying to Replit (Disk Space Optimized)

## Quick Setup

1. **Fork/Import** this repository to Replit

2. **Install minimal dependencies:**
   ```bash
   pip install -r requirements-replit.txt
   ```

3. **Copy environment configuration:**
   ```bash
   cp .env.replit .env
   ```

4. **Update your environment variables** in `.env`:
   - Set your API keys
   - Update `NEXT_PUBLIC_API_BASE` to your Replit URL
   - Update `DATABASE_URL` if using external database

5. **Run the application:**
   ```bash
   python -m uvicorn agent.api:app --host 0.0.0.0 --port 8058
   ```

## What's Disabled for Disk Space

- **Dolphin Parser**: Advanced PDF parsing (falls back to pdfminer)
- **PyTorch/Transformers**: Heavy ML dependencies
- **Advanced Features**: Graph search, hybrid search

## Alternative ML Processing

If you need advanced document parsing:

1. **Use Google Colab** for preprocessing documents
2. **Deploy Dolphin separately** on a service with more storage
3. **Use Hugging Face Inference API** for ML tasks

## Monitoring Disk Usage

```bash
# Check disk usage
df -h
du -sh ~/.cache/pip
du -sh venv/
```

## Upgrading Storage

Consider upgrading to Replit Core/Teams for more storage:
- **Core**: ~10GB storage
- **Teams**: ~50GB storage