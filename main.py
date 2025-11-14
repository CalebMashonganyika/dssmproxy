from fastapi import FastAPI, Request, Header
from fastapi.responses import Response
import httpx
import os

app = FastAPI()

BASE_URL = os.getenv("BASE_URL")
SECRET = os.getenv("SECRET")


@app.api_route("/proxy/{path:path}", methods=["GET", "POST"])
async def proxy(path: str, request: Request, x_proxy_secret: str = Header(None)):
    if x_proxy_secret != SECRET:
        return {"error": "Unauthorized"}

    target_url = f"{BASE_URL}/{path}"

    headers = dict(request.headers)
    headers.pop("host", None)  # remove host header to avoid issues

    async with httpx.AsyncClient() as client:
        if request.method == "POST":
            body = await request.body()
            response = await client.post(target_url, content=body, headers=headers)
        else:
            response = await client.get(target_url, headers=headers, params=request.query_params)

    # Return the exact content and content-type from target
    return Response(content=response.content, media_type=response.headers.get("content-type"))

