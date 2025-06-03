import requests
from bs4 import BeautifulSoup
import re
import logging
from typing import Dict, Any
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

class ProductScraper:
    """Service to scrape product information from e-commerce websites."""
    
    def __init__(self):
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml',
            'Accept-Language': 'en-US,en;q=0.9',
        }

    def _extract_amazon(self, soup: BeautifulSoup, url: str) -> Dict[str, Any]:
        """Extract product details from Amazon."""
        result = {"url": url}
        
        # Get product title
        title_element = soup.select_one('#productTitle')
        if title_element:
            result["title"] = title_element.get_text().strip()

        # Get product image
        img_element = soup.select_one('#landingImage') or soup.select_one('#imgBlkFront')
        if img_element and 'src' in img_element.attrs:
            result["image_url"] = img_element['src']
        elif img_element and 'data-src' in img_element.attrs:
            result["image_url"] = img_element['data-src']
        
        # Get product price
        price = None
        price_whole = soup.select_one('.a-price-whole')
        price_fraction = soup.select_one('.a-price-fraction')
        
        if price_whole and price_fraction:
            price_text = f"{price_whole.get_text().strip()}{price_fraction.get_text().strip()}"
            try:
                # Remove any currency symbols and commas
                price_text = re.sub(r'[^\d.]', '', price_text)
                price = float(price_text)
                result["price"] = price
            except ValueError:
                pass
                
        return result

    def _extract_etsy(self, soup: BeautifulSoup, url: str) -> Dict[str, Any]:
        """Extract product details from Etsy."""
        result = {"url": url}
        
        try:
            # Etsy blocks most web scrapers, so we need to be more clever
            # Try to get data from JSON-LD first (most reliable)
            json_ld = None
            for script in soup.find_all('script', type='application/ld+json'):
                try:
                    import json
                    data = json.loads(script.string)
                    if isinstance(data, dict) and data.get('@type') in ['Product', 'IndividualProduct']:
                        json_ld = data
                        break
                except:
                    continue
                
            if json_ld:
                # Parse JSON-LD data
                result["title"] = json_ld.get('name')
                
                # Handle offers data structure
                if 'offers' in json_ld:
                    offers = json_ld['offers']
                    if isinstance(offers, dict):
                        price_str = offers.get('price')
                        if price_str:
                            try:
                                result["price"] = float(price_str)
                            except ValueError:
                                pass
                    
                # Get image from JSON-LD
                if 'image' in json_ld:
                    img_data = json_ld['image']
                    if isinstance(img_data, list) and len(img_data) > 0:
                        result["image_url"] = img_data[0]
                    else:
                        result["image_url"] = img_data
                        
                return result
        except Exception as e:
            logger.error(f"Error in JSON-LD extraction for Etsy: {e}")
            # Continue to fallback methods
        
        try:
            # Traditional scraping as fallback
            # Get product title
            title_element = soup.select_one('h1.wt-text-body-01') or soup.select_one('.listing-page-title-component')
            if title_element:
                result["title"] = title_element.get_text().strip()
            
            # Get product image - try multiple selector patterns
            img_element = (
                soup.select_one('img.wt-max-width-full') or
                soup.select_one('img[data-src-zoom-image]') or
                soup.select_one('img.carousel-image')
            )
            if img_element:
                if 'src' in img_element.attrs:
                    result["image_url"] = img_element['src']
                elif 'data-src-zoom-image' in img_element.attrs:
                    result["image_url"] = img_element['data-src-zoom-image']
                
            # Try to get metadata from meta tags as another fallback
            og_image = soup.find('meta', property='og:image')
            if og_image and 'content' in og_image.attrs and not result.get("image_url"):
                result["image_url"] = og_image['content']
                
            og_title = soup.find('meta', property='og:title')
            if og_title and 'content' in og_title.attrs and not result.get("title"):
                result["title"] = og_title['content']
                
            # Get product price - try multiple approaches
            price_element = (
                soup.select_one('p.wt-text-title-medium span.money') or
                soup.select_one('p.wt-text-title-01 span.money') or
                soup.select_one('.listing-page-price')
            )
            if price_element:
                price_text = price_element.get_text().strip()
                try:
                    # Remove any currency symbols and commas
                    price_text = re.sub(r'[^\d.]', '', price_text)
                    price = float(price_text)
                    result["price"] = price
                except ValueError:
                    pass
            
            # If we still don't have a price, try to find it in any text containing price patterns
            if "price" not in result:
                price_pattern = r'(?:Price:|US\$|EUR|£|€)\s*(\d+(?:,\d+)*(?:\.\d+)?)'
                price_matches = re.search(price_pattern, soup.get_text())
                if price_matches:
                    try:
                        price_str = price_matches.group(1).replace(',', '')
                        result["price"] = float(price_str)
                    except ValueError:
                        pass
        except Exception as e:
            logger.error(f"Traditional scraping for Etsy failed: {e}")
        
        return result

    def _extract_walmart(self, soup: BeautifulSoup, url: str) -> Dict[str, Any]:
        """Extract product details from Walmart."""
        result = {"url": url}
        
        # Get product title
        title_element = soup.select_one('h1.prod-ProductTitle')
        if title_element:
            result["title"] = title_element.get_text().strip()
            
        # Get product image
        img_element = soup.select_one('img.prod-hero-image')
        if img_element and 'src' in img_element.attrs:
            result["image_url"] = img_element['src']
            
        # Get product price
        price_element = soup.select_one('.prod-PriceSection .price-characteristic')
        price_fraction = soup.select_one('.prod-PriceSection .price-mantissa')
        
        if price_element:
            price_text = price_element.get_text().strip()
            if price_fraction:
                price_text += "." + price_fraction.get_text().strip()
                
            try:
                price = float(price_text)
                result["price"] = price
            except ValueError:
                pass
                
        return result
    
    def _extract_target(self, soup: BeautifulSoup, url: str) -> Dict[str, Any]:
        """Extract product details from Target."""
        result = {"url": url}
        
        # Get product title
        title_element = soup.select_one('h1[data-test="product-title"]')
        if title_element:
            result["title"] = title_element.get_text().strip()
            
        # Get product image
        img_element = soup.select_one('img[data-test="product-image"]')
        if img_element and 'src' in img_element.attrs:
            result["image_url"] = img_element['src']
            
        # Get product price
        price_element = soup.select_one('[data-test="product-price"]')
        if price_element:
            price_text = price_element.get_text().strip()
            try:
                # Remove any currency symbols and commas
                price_text = re.sub(r'[^\d.]', '', price_text)
                price = float(price_text)
                result["price"] = price
            except ValueError:
                pass
                
        return result
    
    def _extract_ebay(self, soup: BeautifulSoup, url: str) -> Dict[str, Any]:
        """Extract product details from eBay."""
        result = {"url": url}
        
        # Get product title
        title_element = soup.select_one('h1.x-item-title__mainTitle')
        if title_element:
            result["title"] = title_element.get_text().strip()
            
        # Get product image
        img_element = soup.select_one('img.ux-image-carousel-item')
        if img_element and 'src' in img_element.attrs:
            result["image_url"] = img_element['src']
            
        # Get product price
        price_element = soup.select_one('div.x-price-primary span')
        if price_element:
            price_text = price_element.get_text().strip()
            try:
                # Remove any currency symbols and commas
                price_text = re.sub(r'[^\d.]', '', price_text)
                price = float(price_text)
                result["price"] = price
            except ValueError:
                pass
                
        return result

    def _extract_generic(self, soup: BeautifulSoup, url: str) -> Dict[str, Any]:
        """Extract product details using generic methods for unknown sites."""
        result = {"url": url}
        
        # Try to get title from meta tags
        og_title = soup.find('meta', property='og:title')
        if og_title and 'content' in og_title.attrs:
            result["title"] = og_title['content']
        else:
            # Fallback to page title
            title_element = soup.find('title')
            if title_element:
                result["title"] = title_element.get_text().strip()
        
        # Try to get image from meta tags
        og_image = soup.find('meta', property='og:image')
        if og_image and 'content' in og_image.attrs:
            result["image_url"] = og_image['content']
        else:
            # Try to find largest image on page
            images = soup.find_all('img')
            largest_image = None
            max_size = 0
            
            for img in images:
                if 'src' in img.attrs:
                    # Skip tiny images, icons, etc.
                    if img.get('width') and img.get('height'):
                        try:
                            width = int(img['width'])
                            height = int(img['height'])
                            size = width * height
                            if size > max_size:
                                max_size = size
                                largest_image = img['src']
                        except (ValueError, TypeError):
                            continue
            
            if largest_image:
                result["image_url"] = largest_image
        
        # Try to find price using common patterns
        price_patterns = [
            r'\$\s*(\d+(?:\.\d{2})?)',  # $XX.XX
            r'(\d+(?:\.\d{2})?)(?:\s*USD)?',  # XX.XX USD
            r'(?:price|cost|amount)(?:\s*:)?\s*\$?\s*(\d+(?:\.\d{2})?)',  # price: $XX.XX
        ]
        
        for pattern in price_patterns:
            price_match = re.search(pattern, soup.get_text(), re.IGNORECASE)
            if price_match:
                try:
                    result["price"] = float(price_match.group(1))
                    break
                except (ValueError, IndexError):
                    continue
        
        return result

    async def fetch_product_details_async(self, url: str) -> Dict[str, Any]:
        """Fetch product details asynchronously, without browser scraping."""
        try:
            # Parse the URL to determine the website
            parsed_url = urlparse(url)
            domain = parsed_url.netloc.lower()
            
            # Direct call to regular scraping for all sites
            logger.info(f"Fetching product details for {domain} using regular scraper")
            result = self.fetch_product_details(url)
            return result
                
        except Exception as e:
            logger.error(f"Error in fetch_product_details_async: {e}")
            return {"error": f"Failed to fetch product details: {str(e)}"}

    # Keep the existing non-async method for compatibility
    def fetch_product_details(self, url: str) -> Dict[str, Any]:
        """Fetch product details from a URL."""
        original_url = url
        try:
            # Parse the URL to determine the website
            parsed_url = urlparse(url)
            domain = parsed_url.netloc.lower()

            # Use more robust headers that look more like a real browser
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Connection': 'keep-alive',
                'Referer': 'https://www.google.com/',
                'DNT': '1',
                'Upgrade-Insecure-Requests': '1',
            }
            
            # Attempt to get the page content with longer timeout
            response = requests.get(url, headers=headers, timeout=15)
            response.raise_for_status()
            
            # Parse using Beautiful Soup
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Extract data based on the website
            if 'amazon' in domain:
                return self._extract_amazon(soup, url)
            elif 'etsy' in domain:
                return self._extract_etsy(soup, url)
            elif 'walmart' in domain:
                return self._extract_walmart(soup, url)
            elif 'target' in domain:
                return self._extract_target(soup, url)
            elif 'ebay' in domain:
                return self._extract_ebay(soup, url)
            else:
                # Generic extraction for unknown sites
                return self._extract_generic(soup, url)
                
        except requests.exceptions.RequestException as e:
            logger.error(f"Request error fetching product details: {str(e)}")
            
            # Special handling for 403 (Forbidden) responses
            if hasattr(e, 'response') and e.response and e.response.status_code == 403:
                # For sites that block scrapers, return a more user-friendly message
                return {
                    "error": "This website blocked our request. Try copying the product details manually.",
                    "url": original_url
                }
            
            return {"error": f"Failed to fetch product details: {str(e)}"}
        except Exception as e:
            logger.error(f"Error fetching product details: {str(e)}")
            return {"error": f"Failed to fetch product details: {str(e)}"}