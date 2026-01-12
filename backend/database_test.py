# This loads variables from .env file
from dotenv import load_dotenv
import os

# Read the .env file
load_dotenv()

# Get the DATABASE_URL from .env
database_url = os.getenv("DATABASE_URL")

# Show what we got (hide password for security)
if database_url:
    # Split at @ to hide password
    parts = database_url.split("@")
    if len(parts) == 2:
        print(f"✅ DATABASE_URL loaded")
        print(f"   Server: {parts[1]}")
    else:
        print(f"⚠️  DATABASE_URL format looks weird: {database_url[:50]}")
else:
    print("❌ DATABASE_URL not found in .env file")
    exit()

print("\n" + "="*60)
print("Testing database connection...")
print("="*60 + "\n")

# Import the database library
try:
    from sqlalchemy import create_engine, text
    print("✅ SQLAlchemy library found")
except ImportError:
    print("❌ SQLAlchemy not installed")
    print("   Run: pip install sqlalchemy")
    exit()

# Try to connect
try:
    # Remove +asyncpg for this simple test (we'll use sync)
    simple_url = database_url.replace("+asyncpg", "")
    
    print(f"🔌 Connecting to database...")
    
    # Create a connection
    engine = create_engine(simple_url)
    
    # Try a simple query
    with engine.connect() as connection:
        result = connection.execute(text("SELECT 1 + 1 AS answer"))
        answer = result.scalar()
        
        print(f"✅ SUCCESS! Database responded with: {answer}")
        print(f"\n🎉 Your database connection works!")
        
except Exception as e:
    print(f"❌ Connection failed")
    print(f"   Error: {e}")
    print("\n🔍 Common issues:")
    print("   - Wrong password in .env")
    print("   - Wrong server address")
    print("   - Firewall blocking connection")