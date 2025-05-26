from fastapi import Request, HTTPException
import time
from collections import defaultdict
from typing import Dict, Tuple
import asyncio

class RateLimiter:
    def __init__(self, requests_per_minute: int = 60):
        self.requests_per_minute = requests_per_minute
        self.requests: Dict[str, list] = defaultdict(list)
        self._cleanup_task = None

    async def start_cleanup(self):
        if not self._cleanup_task:
            self._cleanup_task = asyncio.create_task(self._cleanup_old_requests())

    async def _cleanup_old_requests(self):
        while True:
            current_time = time.time()
            for ip in list(self.requests.keys()):
                self.requests[ip] = [req_time for req_time in self.requests[ip] 
                                   if current_time - req_time < 60]
                if not self.requests[ip]:
                    del self.requests[ip]
            await asyncio.sleep(60)

    async def check_rate_limit(self, request: Request):
        client_ip = request.client.host
        current_time = time.time()
        
        # Remove requests older than 1 minute
        self.requests[client_ip] = [req_time for req_time in self.requests[client_ip] 
                                  if current_time - req_time < 60]
        
        if len(self.requests[client_ip]) >= self.requests_per_minute:
            raise HTTPException(
                status_code=429,
                detail="Too many requests. Please try again in a minute."
            )
        
        self.requests[client_ip].append(current_time)
