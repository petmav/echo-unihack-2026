#!/usr/bin/env python
"""Test the FastAPI app endpoints directly"""
import sys
sys.path.insert(0, '.')

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

print("Testing endpoints:")
print("\n1. Health check:")
response = client.get("/health")
print(f"   Status: {response.status_code}")
print(f"   Response: {response.json()}")

print("\n2. Root endpoint:")
response = client.get("/")
print(f"   Status: {response.status_code}")
print(f"   Response: {response.json()}")

print("\n3. POST /api/v1/thoughts (should be 501 - not implemented):")
response = client.post("/api/v1/thoughts", json={"raw_text": "test"})
print(f"   Status: {response.status_code}")
print(f"   Response: {response.json()}")

print("\n4. POST /api/v1/auth/register (should be 501 - not implemented):")
response = client.post("/api/v1/auth/register", json={"email": "test@example.com", "password": "testpass123"})
print(f"   Status: {response.status_code}")
print(f"   Response: {response.json()}")

print("\n5. GET /api/v1/thoughts/aggregates (should be 501 - not implemented):")
response = client.get("/api/v1/thoughts/aggregates")
print(f"   Status: {response.status_code}")
print(f"   Response: {response.json()}")

print("\n6. CORS check:")
response = client.get("/health", headers={"Origin": "http://localhost:3000"})
print(f"   Status: {response.status_code}")
print(f"   CORS header: {response.headers.get('access-control-allow-origin', 'NOT FOUND')}")
