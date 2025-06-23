from fastapi import Request, HTTPException
import time
from collections import defaultdict
from typing import Dict, Tuple
import asyncio

class RateLimiter:
    def __init__(self, requests_per_minute: int = 300, burst_allowance: int = 100):
        # Increased from 120 to 300 requests per minute
        self.requests_per_minute = requests_per_minute
        # Increased burst allowance from 40 to 100
        self.burst_allowance = burst_allowance
        self.requests: Dict[str, list] = defaultdict(list)
        self._cleanup_task = None
        # Track blocked IPs with a timeout
        self.blocked_ips: Dict[str, float] = {}
        # Keep track of API endpoints for smarter rate limiting
        self.endpoint_counts: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
        # Track per-user requests to avoid penalizing shared IPs
        self.user_requests: Dict[str, list] = defaultdict(list)
        # TODO: For production, consider using Redis or database-backed rate limiting
        # to support multiple server instances and persist rate limits across restarts

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
                    
            # Clear expired blocked IPs
            for ip in list(self.blocked_ips.keys()):
                if current_time > self.blocked_ips[ip]:
                    del self.blocked_ips[ip]
                    
            # Reset endpoint counts every minute
            self.endpoint_counts.clear()
            
            await asyncio.sleep(60)

    async def check_rate_limit(self, request: Request):
        client_ip = request.client.host if request.client else "unknown"
        current_time = time.time()
        
        # Get user ID from header if available
        user_id = request.headers.get('X-Current-User-Id', None)
        request_key = f"{client_ip}:{user_id}" if user_id else client_ip
        
        # Check if IP is in cooldown period
        if client_ip in self.blocked_ips:
            if current_time < self.blocked_ips[client_ip]:
                remaining = int(self.blocked_ips[client_ip] - current_time)
                raise HTTPException(
                    status_code=429,
                    detail=f"Too many requests. Please try again in a moment."
                )
            else:
                # Remove from blocked list if cooldown expired
                del self.blocked_ips[client_ip]
        
        # Get the endpoint path for more granular rate limiting
        path = request.url.path
        method = request.method
        
        # Remove requests older than 1 minute
        self.requests[request_key] = [req_time for req_time in self.requests[request_key] 
                                  if current_time - req_time < 60]
        
        # Track endpoint usage
        endpoint_key = f"{method}:{path}"
        self.endpoint_counts[request_key][endpoint_key] += 1
        
        # Apply special rules for API endpoints
        request_count = len(self.requests[request_key])
        
        # Check if this is a burst or sustained load
        ten_sec_count = sum(1 for t in self.requests[request_key] if current_time - t < 10)
        
        # More forgiving limit for read operations
        if method == "GET" and not path.startswith("/api/admin/"):
            # Allow higher rate for regular GET requests
            if request_count >= self.requests_per_minute + self.burst_allowance:
                # Block for 15 seconds instead of 30
                self.blocked_ips[client_ip] = current_time + 15
                raise HTTPException(
                    status_code=429,
                    detail="Too many requests. Please try again after 15 seconds."
                )
        # More lenient for mutations
        elif method in ("POST", "PUT", "DELETE", "PATCH"):
            # If endpoint is getting hammered, apply stricter limits
            endpoint_count = self.endpoint_counts[request_key][endpoint_key]
            if endpoint_count > 60:  # Increased from 30 to 60 identical mutations in a minute
                self.blocked_ips[client_ip] = current_time + 30  # Reduced from 60 to 30 seconds
                raise HTTPException(
                    status_code=429,
                    detail=f"Too many {method} requests to {path}. Please try again after 30 seconds."
                )
            # Standard rate limit check
            elif request_count >= self.requests_per_minute:
                self.blocked_ips[client_ip] = current_time + 30  # Reduced from 45 to 30 seconds
                raise HTTPException(
                    status_code=429,
                    detail="Too many requests. Please try again after 30 seconds."
                )
        # Admin endpoints get standard rate limiting
        else:
            if request_count >= self.requests_per_minute:
                self.blocked_ips[client_ip] = current_time + 30  # Reduced from 60 to 30 seconds
                raise HTTPException(
                    status_code=429,
                    detail="Too many requests. Please try again in 30 seconds."
                )
                
        # Record this request
        self.requests[request_key].append(current_time)
