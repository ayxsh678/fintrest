from dotenv import load_dotenv
import os
load_dotenv()
print(f"Key found: {os.getenv('NEWS_API_KEY')}")