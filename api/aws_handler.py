from mangum import Mangum

# Import the FastAPI app from our backend
# The app instance is defined in `agent/api.py` as `app = FastAPI(...)`
from agent.api import app

# Create the AWS Lambda handler using Mangum
# lifespan="auto" ensures FastAPI lifespan events run appropriately on cold starts
handler = Mangum(app, lifespan="auto")
