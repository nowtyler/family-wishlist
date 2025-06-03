import requests
from bs4 import BeautifulSoup
import re
import logging
from typing import Dict, Any
from urllib.parse import urlparse
import json
import random
import time

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
        
        # Get listing ID from URL for better tracking
        listing_id = None
        listing_id_match = re.search(r'etsy\.com/(?:[a-z]{2}/)?listing/(\d+)', url)
        if listing_id_match:
            listing_id = listing_id_match.group(1)
            result["listing_id"] = listing_id
        
        try:
            # Use JSON-LD data first (most reliable method)
            json_ld = None
            for script in soup.find_all('script', type='application/ld+json'):
                try:
                    data = json.loads(script.string)
                    if isinstance(data, dict) and data.get('@type') in ['Product', 'IndividualProduct']:
                        json_ld = data
                        break
                except:
                    continue
                
            if json_ld:
                # Extract title
                if 'name' in json_ld:
                    result["title"] = json_ld['name']
                
                # Extract price
                if 'offers' in json_ld:
                    offers = json_ld['offers']
                    if isinstance(offers, dict):
                        price_str = offers.get('price')
                        if price_str:
                            try:
                                result["price"] = float(price_str)
                            except ValueError:
                                pass
                
                # Extract image
                if 'image' in json_ld:
                    img_data = json_ld['image']
                    if isinstance(img_data, list) and len(img_data) > 0:
                        result["image_url"] = img_data[0]
                    else:
                        result["image_url"] = img_data
                
                # Extract description
                if 'description' in json_ld:
                    result["description"] = json_ld['description']
                
                if len(result) > 2:  # If we got at least title and one more attribute
                    return result
        except Exception as e:
            logger.error(f"Error in JSON-LD extraction for Etsy: {e}")
        
        # Fallback to traditional scraping methods if JSON-LD failed
        try:
            # Get product title using more specific Etsy selectors
            title_selectors = [
                'h1.wt-text-body-01',
                '.listing-page-title-component',
                'h1[data-buy-box-listing-title]'
            ]
            
            for selector in title_selectors:
                title_element = soup.select_one(selector)
                if title_element:
                    result["title"] = title_element.get_text().strip()
                    break
            
            # Handle multiple image selector patterns
            image_selectors = [
                'img.wt-max-width-full',
                'img[data-src-zoom-image]',
                'img.carousel-image',
                'img.wt-rounded'
            ]
            
            for selector in image_selectors:
                img_element = soup.select_one(selector)
                if img_element:
                    if 'src' in img_element.attrs:
                        result["image_url"] = img_element['src']
                        break
                    elif 'data-src-zoom-image' in img_element.attrs:
                        result["image_url"] = img_element['data-src-zoom-image']
                        break
            
            # Try multiple price selectors
            price_selectors = [
                'p.wt-text-title-medium span.money',
                'p.wt-text-title-01 span.money',
                '.listing-page-price',
                'p[data-buy-box-region="price"] span.currency-value',
                'div[data-selector="price-only"]'
            ]
            
            for selector in price_selectors:
                price_element = soup.select_one(selector)
                if price_element:
                    price_text = price_element.get_text().strip()
                    try:
                        # Remove any currency symbols and commas
                        price_text = re.sub(r'[^\d.]', '', price_text)
                        result["price"] = float(price_text)
                        break
                    except ValueError:
                        pass
            
            # Get shop name
            shop_element = soup.select_one('p.wt-text-body-01 span.wt-screen-reader-only')
            if shop_element:
                shop_text = shop_element.get_text().strip()
                # Handle the format "Shop: ShopName" or similar
                shop_parts = shop_text.split(":")
                if len(shop_parts) > 1:
                    result["shop_name"] = shop_parts[1].strip()
                else:
                    result["shop_name"] = shop_text.strip()
            
            # Get star rating
            rating_element = soup.select_one('input.wt-rating-input')
            if rating_element and 'value' in rating_element.attrs:
                try:
                    result["rating"] = float(rating_element['value'])
                except ValueError:
                    pass
                
            # Get number of reviews
            reviews_element = soup.select_one('span.wt-text-body-01 a span')
            if reviews_element:
                reviews_text = reviews_element.get_text().strip().replace(',', '')
                reviews_match = re.search(r'\d+', reviews_text)
                if reviews_match:
                    try:
                        result["review_count"] = int(reviews_match.group(0))
                    except ValueError:
                        pass
                    
            # Try to extract description
            description_element = soup.select_one('div[data-id="description-text"]')
            if description_element:
                result["description"] = description_element.get_text().strip()
            
            # Try to extract shipping info
            shipping_element = soup.select_one('p.wt-text-body-01 span.currency-value')
            if shipping_element:
                shipping_text = shipping_element.get_text().strip()
                if shipping_text.lower() == 'free':
                    result["shipping"] = 0.0
                else:
                    try:
                        shipping_text = re.sub(r'[^\d.]', '', shipping_text)
                        result["shipping"] = float(shipping_text)
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
            
            # For Etsy, implement rate limiting to avoid IP blocks
            if 'etsy' in domain:
                # Random sleep between requests to avoid detection
                sleep_time = random.uniform(1, 3)
                time.sleep(sleep_time)
            
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
