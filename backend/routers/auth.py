"""
Auth router: POST /auth/register, POST /auth/login, POST /auth/refresh

Echo collects ONLY email + bcrypt password hash.
No name, no DOB, no phone, no profile photo -- nothing else.

In-memory user store for hackathon demo:
  _users: dict[email -> {user_id, hashed_password}]
"""

from fastapi import APIRouter, Depends, HTTPException, Header
from typing import Optional

from fastapi import APIRouter, HTTPException, Header

from models.auth import AuthCredentials, AuthResponse
from middleware.rate_limit import make_rate_limit_dependency

router = APIRouter(prefix="/auth", tags=["auth"])

# 5 login attempts per 15 minutes (900 seconds), keyed by IP
login_rate_limit = make_rate_limit_dependency(
    max_requests=5,
    window_seconds=900,
    key_prefix="login",
)


@router.post("/register", response_model=AuthResponse)
async def register(credentials: AuthCredentials):
    """Register a new user account. Returns JWT access token (7-day expiry)."""
    if credentials.email in _users:
        raise HTTPException(status_code=409, detail="Email already registered")

    user_id = str(uuid.uuid4())
    hashed = hash_password(credentials.password)
    _users[credentials.email] = {"user_id": user_id, "hashed_password": hashed}

    token = create_access_token(user_id)
    return AuthResponse(access_token=token)


@router.post("/login", response_model=AuthResponse)
async def login(credentials: AuthCredentials, _: None = Depends(login_rate_limit)):
    """Authenticate existing user. Returns JWT access token."""
    user = _users.get(credentials.email)
    if user is None or not verify_password(credentials.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(user["user_id"])
    return AuthResponse(access_token=token)


@router.post("/refresh", response_model=AuthResponse)
async def refresh_token(authorization: Optional[str] = Header(None)):
    """Refresh JWT token before expiry."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")

    token = authorization.removeprefix("Bearer ")
    user_id = decode_access_token(token)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    new_token = create_access_token(user_id)
    return AuthResponse(access_token=new_token)
