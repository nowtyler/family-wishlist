import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

class BrowserScraper:
    """A placeholder service that indicates browser scraping is not available."""
    
    def __init__(self):
        self.is_available = False
        logger.info("Browser-based scraping is disabled. Only using regular scraping methods.")
    
    async def scrape_url(self, url: str) -> Dict[str, Any]:
        """Returns an error indicating browser scraping is not available."""
        return {
            "error": "Browser scraping has been removed from this application.",
            "fallback_needed": True
        }
