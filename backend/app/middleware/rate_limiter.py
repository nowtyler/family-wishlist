from fastapi import Request, HTTPException
import time
from collections import defaultdict
from typing import Dict, Tuple
import asyncio

class RateLimiter:
    def __init__(self, requests_per_minute: int = 120, burst_allowance: int = 40):
        # Increased from 60 to 120 requests per minute
        self.requests_per_minute = requests_per_minute
        # New parameter to allow short bursts of activity
        self.burst_allowance = burst_allowance
        self.requests: Dict[str, list] = defaultdict(list)
        self._cleanup_task = None
        # Track blocked IPs with a timeout
        self.blocked_ips: Dict[str, float] = {}
        # Keep track of API endpoints for smarter rate limiting
        self.endpoint_counts: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))

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
        client_ip = request.client.host
        current_time = time.time()
        
        # Check if IP is in cooldown period
        if client_ip in self.blocked_ips:
            if current_time < self.blocked_ips[client_ip]:
                remaining = int(self.blocked_ips[client_ip] - current_time)
                raise HTTPException(
                    status_code=429,
                    detail=f"Too many requests. Please try again in {remaining} seconds."
                )
            else:
                # Remove from blocked list if cooldown expired
                del self.blocked_ips[client_ip]
        
        # Get the endpoint path for more granular rate limiting
        path = request.url.path
        method = request.method
        
        # Remove requests older than 1 minute
        self.requests[client_ip] = [req_time for req_time in self.requests[client_ip] 
                                  if current_time - req_time < 60]
        
        # Track endpoint usage
        endpoint_key = f"{method}:{path}"
        self.endpoint_counts[client_ip][endpoint_key] += 1
        
        # Apply special rules for API endpoints
        request_count = len(self.requests[client_ip])
        
        # Check if this is a burst or sustained load
        ten_sec_count = sum(1 for t in self.requests[client_ip] if current_time - t < 10)
        
        # More forgiving limit for read operations
        if method == "GET" and not path.startswith("/api/admin/"):
            # Allow higher rate for regular GET requests
            if request_count >= self.requests_per_minute + self.burst_allowance:
                # Block for 30 seconds instead of a full minute
                self.blocked_ips[client_ip] = current_time + 30
                raise HTTPException(
                    status_code=429,
                    detail="Too many requests. Please try again after 30 seconds."
                )
        # More strict for mutations
        elif method in ("POST", "PUT", "DELETE", "PATCH"):
            # If endpoint is getting hammered, apply stricter limits
            endpoint_count = self.endpoint_counts[client_ip][endpoint_key]
            if endpoint_count > 30:  # More than 30 identical mutations in a minute
                self.blocked_ips[client_ip] = current_time + 60
                raise HTTPException(
                    status_code=429,
                    detail=f"Too many {method} requests to {path}. Please try again after a minute."
                )
            # Standard rate limit check
            elif request_count >= self.requests_per_minute:
                self.blocked_ips[client_ip] = current_time + 45
                raise HTTPException(
                    status_code=429,
                    detail="Too many requests. Please try again after 45 seconds."
                )
        # Admin endpoints get standard rate limiting
        else:
            if request_count >= self.requests_per_minute:
                self.blocked_ips[client_ip] = current_time + 60
                raise HTTPException(
                    status_code=429,
                    detail="Too many requests. Please try again in a minute."
                )
                
        # Record this request
        self.requests[client_ip].append(current_time)
