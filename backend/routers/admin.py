"""
Admin dashboard for Echo backend.

Provides a password-protected web UI for runtime configuration.
Password is generated at startup (or read from ADMIN_PASSWORD env var)
and printed to the server logs.

Routes:
    GET  /admin              — Dashboard (login wall if unauthenticated)
    POST /admin/login        — Validate password, set session cookie
    GET  /admin/logout       — Clear session cookie
    POST /admin/anonymiser/mode — Switch anonymiser backend (ollama / nanogpt)
"""

import hashlib

from fastapi import APIRouter, Cookie, Form, Header, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse
from pydantic import BaseModel

from services import anonymiser as anonymiser_service
from services.auth import decode_access_token_admin

router = APIRouter(prefix="/admin", tags=["admin"])

_admin_password: str = ""
_admin_token: str = ""  # sha256 of password — stored in session cookie


def init_admin(password: str) -> None:
    """Called at startup with the admin password (generated or env-provided)."""
    global _admin_password, _admin_token
    _admin_password = password
    _admin_token = hashlib.sha256(password.encode()).hexdigest()


def _is_authed(cookie: str | None) -> bool:
    return bool(_admin_token and cookie == _admin_token)


# ---------------------------------------------------------------------------
# HTML templates
# ---------------------------------------------------------------------------

_BASE_STYLES = """
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Georgia, serif;
    background: #FAF7F2;
    color: #2C2825;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }
  .card {
    background: #fff;
    border-radius: 20px;
    padding: 40px 44px;
    max-width: 460px;
    width: 100%;
    box-shadow: 0 4px 32px rgba(44,40,37,0.09);
  }
  .logo {
    font-size: 12px;
    letter-spacing: 4px;
    color: #8C7D70;
    opacity: 0.6;
    margin-bottom: 28px;
    text-transform: uppercase;
  }
  h1 { font-size: 22px; font-weight: normal; margin-bottom: 6px; }
  .sub { font-size: 13px; color: #8C7D70; margin-bottom: 32px; }
  input[type=password] {
    width: 100%;
    padding: 13px 16px;
    border: 1.5px solid #E8E0D8;
    border-radius: 11px;
    font-size: 14px;
    font-family: Georgia, serif;
    margin-bottom: 16px;
    background: #fff;
    color: #2C2825;
    outline: none;
  }
  input[type=password]:focus { border-color: #8C7D70; }
  .btn {
    background: #8C7D70;
    color: #fff;
    border: none;
    padding: 13px 24px;
    border-radius: 11px;
    font-size: 14px;
    font-family: Georgia, serif;
    cursor: pointer;
    width: 100%;
    transition: background 0.15s;
  }
  .btn:hover { background: #7a6b5f; }
  .btn-outline {
    background: transparent;
    color: #8C7D70;
    border: 1.5px solid #E8E0D8;
  }
  .btn-outline:hover { background: #FAF7F2; }
  .error { color: #b94040; font-size: 13px; margin-bottom: 16px; }
"""


def _login_html(error: str = "") -> str:
    error_html = f'<p class="error">{error}</p>' if error else ""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Echo Admin</title>
  <style>{_BASE_STYLES}</style>
</head>
<body>
  <div class="card">
    <div class="logo">echo &nbsp;·&nbsp; admin</div>
    <h1>Admin Access</h1>
    <p class="sub">Enter your admin password to continue.</p>
    {error_html}
    <form method="POST" action="/admin/login">
      <input type="password" name="password" placeholder="Password"
             autofocus autocomplete="current-password">
      <button type="submit" class="btn">Sign in</button>
    </form>
  </div>
</body>
</html>"""


def _dashboard_html(mode: str) -> str:
    other_mode = "nanogpt" if mode == "ollama" else "ollama"
    mode_labels = {
        "ollama": "Ollama · local (qwen3.5:0.8b)",
        "nanogpt": "NanoGPT API · gpt-oss-120b",
    }
    current_label = mode_labels[mode]
    other_label = mode_labels[other_mode]
    indicator_color = "#5a8a5a" if mode == "ollama" else "#7a6b5f"

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Echo Admin</title>
  <style>
    {_BASE_STYLES}
    .section-label {{
      font-size: 11px;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: #8C7D70;
      margin-bottom: 12px;
    }}
    .status-row {{
      background: #FAF7F2;
      border-radius: 12px;
      padding: 18px 20px;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 12px;
    }}
    .dot {{
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: {indicator_color};
      flex-shrink: 0;
    }}
    .status-text {{
      font-size: 14px;
      font-family: 'Courier New', monospace;
    }}
    .divider {{
      border: none;
      border-top: 1px solid #EDE8E2;
      margin: 24px 0;
    }}
    .footer {{
      margin-top: 20px;
      font-size: 12px;
      color: #8C7D70;
      text-align: center;
    }}
    .footer a {{ color: #8C7D70; }}
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">echo &nbsp;·&nbsp; admin</div>
    <h1>Dashboard</h1>
    <p class="sub">Runtime pipeline configuration</p>

    <div class="section-label">Anonymiser backend</div>
    <div class="status-row">
      <div class="dot"></div>
      <span class="status-text">{current_label}</span>
    </div>

    <form method="POST" action="/admin/anonymiser/mode">
      <input type="hidden" name="mode" value="{other_mode}">
      <button type="submit" class="btn">Switch to {other_label}</button>
    </form>

    <hr class="divider">

    <div class="footer"><a href="/admin/logout">Sign out</a></div>
  </div>
</body>
</html>"""


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("", response_class=HTMLResponse)
async def admin_dashboard(echo_admin: str | None = Cookie(default=None)):
    if not _is_authed(echo_admin):
        return HTMLResponse(_login_html())
    return HTMLResponse(_dashboard_html(anonymiser_service.get_anonymiser_mode()))


@router.post("/login")
async def admin_login(password: str = Form(...)):
    if password == _admin_password:
        response = RedirectResponse(url="/admin", status_code=303)
        response.set_cookie(
            "echo_admin",
            _admin_token,
            httponly=True,
            samesite="lax",
            max_age=86400 * 7,
        )
        return response
    return HTMLResponse(_login_html(error="Incorrect password."), status_code=401)


@router.post("/anonymiser/mode")
async def set_anonymiser_mode(
    mode: str = Form(...),
    echo_admin: str | None = Cookie(default=None),
):
    if not _is_authed(echo_admin):
        return RedirectResponse(url="/admin", status_code=303)
    if mode in ("ollama", "nanogpt"):
        anonymiser_service.set_anonymiser_mode(mode)
    return RedirectResponse(url="/admin", status_code=303)


@router.get("/logout")
async def admin_logout():
    response = RedirectResponse(url="/admin", status_code=303)
    response.delete_cookie("echo_admin")
    return response


# ---------------------------------------------------------------------------
# JWT-protected API endpoints for in-app admin panel
# Mounted at /api/v1/admin/... via main.py
# ---------------------------------------------------------------------------

class AnonymiserModeRequest(BaseModel):
    mode: str


api_router = APIRouter(prefix="/admin", tags=["admin-api"])


def _require_admin(authorization: str | None) -> None:
    """Raise 401/403 if the Bearer token is missing or not admin."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")
    token = authorization.removeprefix("Bearer ")
    user_id, is_admin = decode_access_token_admin(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")


@api_router.get("/anonymiser/mode")
async def api_get_anonymiser_mode(authorization: str | None = Header(None)):
    """Return current anonymiser mode. Requires admin JWT."""
    _require_admin(authorization)
    return {"mode": anonymiser_service.get_anonymiser_mode()}


@api_router.post("/anonymiser/mode")
async def api_set_anonymiser_mode(
    body: AnonymiserModeRequest,
    authorization: str | None = Header(None),
):
    """Set anonymiser mode. Requires admin JWT."""
    _require_admin(authorization)
    if body.mode not in ("ollama", "nanogpt"):
        raise HTTPException(status_code=422, detail="mode must be 'ollama' or 'nanogpt'")
    anonymiser_service.set_anonymiser_mode(body.mode)
    return {"mode": anonymiser_service.get_anonymiser_mode()}
