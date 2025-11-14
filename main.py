from fastapi import FastAPI, Request, Header
import httpx
import os

app = FastAPI()

BASE_URL = os.getenv("BASE_URL")
SECRET = os.getenv("SECRET")

@app.get("/proxy/{path:path}")
async def proxy(path: str, request: Request, x_proxy_secret: str = Header(None)):
    if x_proxy_secret != SECRET:
        return {"error": "Unauthorized"}

    target_url = f"{BASE_URL}/{path}"

    async with httpx.AsyncClient() as client:
        response = await client.request(
            method=request.method,
            url=target_url,
            headers=request.headers.raw,
            params=request.query_params,
            timeout=20.0
        )

    return response.json()
