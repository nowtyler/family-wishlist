import requests
from bs4 import BeautifulSoup
import re
import json
import logging
from typing import Dict, Any, Optional
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

class ProductScraper:
    """Service to scrape product information from e-commerce websites."""
    
    def __init__(self):
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml',
            'Accept-Language': 'en-US,en;q=0.9',
        }

    def _extract_json_ld_product(self, soup: BeautifulSoup) -> Optional[Dict[str, Any]]:
        """Extract product data from JSON-LD structured data if available."""
        for script in soup.find_all('script', type='application/ld+json'):
            try:
                if not script.string:
                    continue
                data = json.loads(script.string)

                # Handle array of JSON-LD objects
                if isinstance(data, list):
                    for item in data:
                        if isinstance(item, dict) and item.get('@type') in ['Product', 'IndividualProduct']:
                            return item
                # Handle single JSON-LD object
                elif isinstance(data, dict):
                    if data.get('@type') in ['Product', 'IndividualProduct']:
                        return data
                    # Some sites nest Product inside @graph
                    if '@graph' in data:
                        for item in data['@graph']:
                            if isinstance(item, dict) and item.get('@type') in ['Product', 'IndividualProduct']:
                                return item
            except (json.JSONDecodeError, TypeError) as e:
                logger.debug(f"Failed to parse JSON-LD script: {e}")
                continue
        return None

    def _parse_json_ld_product(self, json_ld: Dict[str, Any], url: str) -> Dict[str, Any]:
        """Parse a JSON-LD Product object into our standard format."""
        result = {"url": url}

        # Get title
        if 'name' in json_ld:
            result["title"] = json_ld['name']

        # Get price from offers
        if 'offers' in json_ld:
            offers = json_ld['offers']
            # Handle single offer or array of offers
            if isinstance(offers, list) and len(offers) > 0:
                offers = offers[0]
            if isinstance(offers, dict):
                price_str = offers.get('price')
                if price_str:
                    try:
                        result["price"] = float(price_str)
                    except (ValueError, TypeError):
                        pass

        # Get image
        if 'image' in json_ld:
            img_data = json_ld['image']
            if isinstance(img_data, list) and len(img_data) > 0:
                # Could be list of strings or list of ImageObject
                first_img = img_data[0]
                if isinstance(first_img, dict):
                    result["image_url"] = first_img.get('url') or first_img.get('contentUrl')
                else:
                    result["image_url"] = first_img
            elif isinstance(img_data, dict):
                result["image_url"] = img_data.get('url') or img_data.get('contentUrl')
            elif isinstance(img_data, str):
                result["image_url"] = img_data

        return result

    def _extract_amazon(self, soup: BeautifulSoup, url: str) -> Dict[str, Any]:
        """Extract product details from Amazon."""
        result = {"url": url}

        # Get product title
        title_element = soup.select_one('#productTitle')
        if title_element:
            result["title"] = title_element.get_text().strip()

        # Get product image - try multiple selectors
        img_element = (
            soup.select_one('#landingImage') or
            soup.select_one('#imgBlkFront') or
            soup.select_one('#main-image') or
            soup.select_one('img.a-dynamic-image')
        )
        if img_element:
            # Prefer data-old-hires for higher resolution, fall back to src
            result["image_url"] = (
                img_element.get('data-old-hires') or
                img_element.get('src') or
                img_element.get('data-src')
            )

        # Get product price - try multiple approaches in order of reliability
        price = None

        # Method 1: .a-offscreen inside .a-price (contains full price as text like "$29.99")
        price_offscreen = soup.select_one('.a-price .a-offscreen')
        if price_offscreen:
            price_text = price_offscreen.get_text().strip()
            try:
                price_text = re.sub(r'[^\d.]', '', price_text)
                price = float(price_text)
            except ValueError:
                pass

        # Method 2: Combine .a-price-whole and .a-price-fraction
        if price is None:
            price_whole = soup.select_one('.a-price-whole')
            price_fraction = soup.select_one('.a-price-fraction')
            if price_whole:
                price_text = price_whole.get_text().strip()
                if price_fraction:
                    price_text += price_fraction.get_text().strip()
                try:
                    price_text = re.sub(r'[^\d.]', '', price_text)
                    price = float(price_text)
                except ValueError:
                    pass

        # Method 3: Legacy Amazon price blocks (older product pages)
        if price is None:
            legacy_selectors = [
                '#priceblock_ourprice',
                '#priceblock_dealprice',
                '#priceblock_saleprice',
                'span.a-price-whole',
                '#corePrice_feature_div .a-offscreen',
            ]
            for selector in legacy_selectors:
                price_element = soup.select_one(selector)
                if price_element:
                    price_text = price_element.get_text().strip()
                    try:
                        price_text = re.sub(r'[^\d.]', '', price_text)
                        price = float(price_text)
                        break
                    except ValueError:
                        continue

        if price is not None:
            result["price"] = price

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
                except Exception as e:
                    logger.debug(f"Failed to parse JSON-LD script: {e}")
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

        # Method 1: Try __NEXT_DATA__ script tag (Walmart uses Next.js)
        next_data_script = soup.find('script', id='__NEXT_DATA__')
        if next_data_script and next_data_script.string:
            try:
                next_data = json.loads(next_data_script.string)
                # Navigate to product data - Walmart nests it in props.pageProps.initialData
                props = next_data.get('props', {})
                page_props = props.get('pageProps', {})
                initial_data = page_props.get('initialData', {})
                product_data = initial_data.get('data', {}).get('product', {})

                if product_data:
                    # Get title
                    if product_data.get('name'):
                        result["title"] = product_data['name']

                    # Get price - try multiple paths
                    price_info = product_data.get('priceInfo', {})
                    current_price = price_info.get('currentPrice', {})
                    if current_price.get('price'):
                        result["price"] = float(current_price['price'])
                    elif price_info.get('linePrice'):
                        # Sometimes price is in linePrice
                        price_text = re.sub(r'[^\d.]', '', price_info['linePrice'])
                        if price_text:
                            result["price"] = float(price_text)

                    # Get image
                    image_info = product_data.get('imageInfo', {})
                    if image_info.get('thumbnailUrl'):
                        result["image_url"] = image_info['thumbnailUrl']
                    elif image_info.get('allImages') and len(image_info['allImages']) > 0:
                        result["image_url"] = image_info['allImages'][0].get('url')

                    if result.get("title") and result.get("price"):
                        logger.debug(f"Walmart: extracted from __NEXT_DATA__")
                        return result
            except (json.JSONDecodeError, KeyError, TypeError) as e:
                logger.debug(f"Walmart __NEXT_DATA__ parsing failed: {e}")

        # Method 2: Try JSON-LD
        json_ld = self._extract_json_ld_product(soup)
        if json_ld:
            ld_result = self._parse_json_ld_product(json_ld, url)
            if ld_result.get("title"):
                # Merge with any existing data
                for key, value in ld_result.items():
                    if value and not result.get(key):
                        result[key] = value

        # Method 3: Fallback to Open Graph tags
        if not result.get("title"):
            og_title = soup.find('meta', property='og:title')
            if og_title and 'content' in og_title.attrs:
                result["title"] = og_title['content']

        if not result.get("image_url"):
            og_image = soup.find('meta', property='og:image')
            if og_image and 'content' in og_image.attrs:
                result["image_url"] = og_image['content']

        # Method 4: HTML selectors for price if still missing
        if not result.get("price"):
            price_selectors = [
                '[itemprop="price"]',
                '[data-testid="price-wrap"] [data-automation-id="product-price"] .f2',
                'span[data-automation="product-price"]',
                '.price-characteristic',
            ]
            for selector in price_selectors:
                price_element = soup.select_one(selector)
                if price_element:
                    price_text = price_element.get('content') or price_element.get_text().strip()
                    try:
                        price_text = re.sub(r'[^\d.]', '', price_text)
                        if price_text:
                            result["price"] = float(price_text)
                            break
                    except ValueError:
                        continue

        return result
    
    def _extract_target(self, soup: BeautifulSoup, url: str) -> Dict[str, Any]:
        """Extract product details from Target."""
        result = {"url": url}

        # Method 1: Try __NEXT_DATA__ script tag (Target uses Next.js)
        next_data_script = soup.find('script', id='__NEXT_DATA__')
        if next_data_script and next_data_script.string:
            try:
                next_data = json.loads(next_data_script.string)
                props = next_data.get('props', {})
                page_props = props.get('pageProps', {})

                # Target stores product in different paths depending on page type
                product_data = None

                # Try direct product path
                if 'product' in page_props:
                    product_data = page_props['product']
                # Try nested in initialData
                elif 'initialData' in page_props:
                    initial_data = page_props['initialData']
                    if 'data' in initial_data and 'product' in initial_data['data']:
                        product_data = initial_data['data']['product']

                if product_data:
                    # Get title
                    if product_data.get('item', {}).get('product_description', {}).get('title'):
                        result["title"] = product_data['item']['product_description']['title']
                    elif product_data.get('title'):
                        result["title"] = product_data['title']

                    # Get price
                    price_data = product_data.get('price', {})
                    if price_data.get('current_retail'):
                        result["price"] = float(price_data['current_retail'])
                    elif price_data.get('formatted_current_price'):
                        price_text = re.sub(r'[^\d.]', '', price_data['formatted_current_price'])
                        if price_text:
                            result["price"] = float(price_text)

                    # Get image
                    images = product_data.get('item', {}).get('enrichment', {}).get('images', {})
                    if images.get('primary_image_url'):
                        result["image_url"] = images['primary_image_url']
                    elif product_data.get('images', []):
                        result["image_url"] = product_data['images'][0]

                    if result.get("title") and result.get("price"):
                        logger.debug(f"Target: extracted from __NEXT_DATA__")
                        return result
            except (json.JSONDecodeError, KeyError, TypeError) as e:
                logger.debug(f"Target __NEXT_DATA__ parsing failed: {e}")

        # Method 2: Try to find preloaded state in script tags
        for script in soup.find_all('script'):
            if script.string and '__TGT_DATA__' in script.string:
                try:
                    # Extract JSON from the script
                    match = re.search(r'__TGT_DATA__\s*=\s*(\{.*?\});', script.string, re.DOTALL)
                    if match:
                        tgt_data = json.loads(match.group(1))
                        # Navigate to product data
                        queries = tgt_data.get('__PRELOADED_QUERIES__', {})
                        for key, value in queries.items():
                            if 'product' in key.lower() and isinstance(value, dict):
                                if value.get('data', {}).get('product'):
                                    product = value['data']['product']
                                    if product.get('item', {}).get('product_description', {}).get('title'):
                                        result["title"] = product['item']['product_description']['title']
                                    if product.get('price', {}).get('current_retail'):
                                        result["price"] = float(product['price']['current_retail'])
                                    break
                except (json.JSONDecodeError, KeyError, TypeError) as e:
                    logger.debug(f"Target __TGT_DATA__ parsing failed: {e}")

        # Method 3: Try JSON-LD
        json_ld = self._extract_json_ld_product(soup)
        if json_ld:
            ld_result = self._parse_json_ld_product(json_ld, url)
            for key, value in ld_result.items():
                if value and not result.get(key):
                    result[key] = value

        # Method 4: Fallback to Open Graph tags
        if not result.get("title"):
            og_title = soup.find('meta', property='og:title')
            if og_title and 'content' in og_title.attrs:
                result["title"] = og_title['content']

        if not result.get("image_url"):
            og_image = soup.find('meta', property='og:image')
            if og_image and 'content' in og_image.attrs:
                result["image_url"] = og_image['content']

        # Try price from meta tags
        if not result.get("price"):
            price_meta_props = [
                'og:price:amount',
                'product:price:amount',
                'twitter:data1',  # Sometimes contains price
            ]
            for prop in price_meta_props:
                price_meta = soup.find('meta', property=prop) or soup.find('meta', attrs={'name': prop})
                if price_meta and price_meta.get('content'):
                    try:
                        price_text = re.sub(r'[^\d.]', '', price_meta['content'])
                        if price_text:
                            result["price"] = float(price_text)
                            break
                    except (ValueError, TypeError):
                        continue

        # Method 5: HTML selectors for price if still missing
        if not result.get("price"):
            price_selectors = [
                '[data-test="product-price"]',
                '[data-test="current-price"]',
                'span[data-test="product-price"]',
                'span[class*="currentPriceFontSize"]',
                '[data-test="product-price-wrapper"] span',
            ]
            for selector in price_selectors:
                price_element = soup.select_one(selector)
                if price_element:
                    price_text = price_element.get('content') or price_element.get_text().strip()
                    try:
                        price_text = re.sub(r'[^\d.]', '', price_text)
                        if price_text:
                            result["price"] = float(price_text)
                            break
                    except ValueError:
                        continue

        # If we still don't have a price, add a helpful message
        if not result.get("price"):
            result["price_note"] = "Price unavailable - please enter manually"

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

        # Try JSON-LD structured data first (most reliable for product pages)
        json_ld = self._extract_json_ld_product(soup)
        if json_ld:
            result = self._parse_json_ld_product(json_ld, url)
            # If we got good data from JSON-LD, return it
            if result.get("title") and (result.get("price") or result.get("image_url")):
                logger.debug(f"Generic extraction: using JSON-LD data for {url}")
                return result

        # Fallback to Open Graph and meta tags
        og_title = soup.find('meta', property='og:title')
        if og_title and 'content' in og_title.attrs:
            result["title"] = og_title['content']
        else:
            title_element = soup.find('title')
            if title_element:
                result["title"] = title_element.get_text().strip()

        og_image = soup.find('meta', property='og:image')
        if og_image and 'content' in og_image.attrs:
            result["image_url"] = og_image['content']
        else:
            # Try Twitter card image
            twitter_image = soup.find('meta', attrs={'name': 'twitter:image'})
            if twitter_image and 'content' in twitter_image.attrs:
                result["image_url"] = twitter_image['content']

        # Try og:price:amount for price (some sites use this)
        og_price = soup.find('meta', property='og:price:amount')
        if og_price and 'content' in og_price.attrs:
            try:
                result["price"] = float(og_price['content'])
            except (ValueError, TypeError):
                pass

        # If still no price, try common price patterns in page text
        if "price" not in result:
            price_patterns = [
                r'\$\s*(\d+(?:,\d{3})*(?:\.\d{2})?)',  # $XX.XX or $X,XXX.XX
                r'(?:price|cost)(?:\s*:)?\s*\$?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)',  # price: $XX.XX
            ]
            for pattern in price_patterns:
                price_match = re.search(pattern, soup.get_text(), re.IGNORECASE)
                if price_match:
                    try:
                        price_str = price_match.group(1).replace(',', '')
                        result["price"] = float(price_str)
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
            # Use more robust headers that look more like a real browser
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Connection': 'keep-alive',
                'Referer': 'https://www.google.com/',
                'DNT': '1',
                'Upgrade-Insecure-Requests': '1',
            }

            # Attempt to get the page content with longer timeout
            # allow_redirects=True is default, but being explicit for short URL support
            response = requests.get(url, headers=headers, timeout=15, allow_redirects=True)
            response.raise_for_status()

            # Use the final URL after redirects (important for short URLs like a.co, amzn.to)
            final_url = response.url
            parsed_url = urlparse(final_url)
            domain = parsed_url.netloc.lower()

            logger.debug(f"Original URL: {original_url}, Final URL: {final_url}, Domain: {domain}")

            # Parse using Beautiful Soup
            soup = BeautifulSoup(response.content, 'html.parser')

            # Extract data based on the website (using final URL after redirects)
            if 'amazon' in domain:
                return self._extract_amazon(soup, final_url)
            elif 'etsy' in domain:
                return self._extract_etsy(soup, final_url)
            elif 'walmart' in domain:
                return self._extract_walmart(soup, final_url)
            elif 'target' in domain:
                return self._extract_target(soup, final_url)
            elif 'ebay' in domain:
                return self._extract_ebay(soup, final_url)
            else:
                # Generic extraction for unknown sites
                return self._extract_generic(soup, final_url)
                
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