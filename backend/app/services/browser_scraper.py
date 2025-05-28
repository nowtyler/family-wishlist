import os
import logging
import json
import asyncio
from typing import Dict, Any, Optional
import tempfile
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

class BrowserScraper:
    """A service to scrape websites using a headless browser (Puppeteer via Node.js)."""
    
    def __init__(self):
        # Path to the Node.js script
        self.script_path = os.path.join(os.path.dirname(__file__), "browser_scripts", "scrape.js")
        # Create directory if it doesn't exist
        os.makedirs(os.path.dirname(self.script_path), exist_ok=True)
        
        # Create the Node.js script if it doesn't exist
        if not os.path.exists(self.script_path):
            self._create_scraper_script()
            
        # Check if Node.js and Puppeteer are installed
        self.is_available = self._check_environment()
        
        # Log a more detailed message about availability
        if not self.is_available:
            logger.warning("Browser-based scraping is disabled. Falling back to regular scraping methods.")
            logger.info("To enable browser-based scraping, make sure Node.js is installed and available in the PATH.")
    
    def _check_environment(self) -> bool:
        """Check if Node.js and required npm packages are installed."""
        try:
            # Try multiple ways to detect Node.js
            node_paths = [
                "node",                # Standard path
                "/usr/bin/node",       # Common Linux location
                "/usr/local/bin/node", # Common alternative location
                "nodejs"               # Some distributions use this name
            ]
            
            node_found = False
            for node_path in node_paths:
                check_cmd = f"which {node_path} > /dev/null 2>&1 || {node_path} --version > /dev/null 2>&1"
                if os.system(check_cmd) == 0:
                    node_found = True
                    logger.info(f"Found Node.js at: {node_path}")
                    break
                    
            if not node_found:
                logger.warning("Node.js not found in any standard location. Browser scraping will be disabled.")
                return False
                
            # Check if Puppeteer is installed
            puppeteer_check = os.system(f"{node_path} -e \"try {{ require('puppeteer'); console.log('Puppeteer found'); }} catch(e) {{ process.exit(1); }}\" > /dev/null 2>&1")
            if puppeteer_check != 0:
                logger.warning("Puppeteer not installed. Will attempt to install it.")
                # Try to install Puppeteer
                npm_paths = ["npm", "/usr/bin/npm", "/usr/local/bin/npm"]
                install_success = False
                
                for npm_path in npm_paths:
                    install_cmd = f"{npm_path} install puppeteer --quiet --no-fund --no-audit > /dev/null 2>&1"
                    if os.system(install_cmd) == 0:
                        logger.info(f"Successfully installed Puppeteer using {npm_path}")
                        install_success = True
                        break
                
                if not install_success:
                    logger.error("Failed to install Puppeteer. Browser scraping will be disabled.")
                    return False
                logger.info("Puppeteer installed successfully!")
            
            return True
        except Exception as e:
            logger.error(f"Error checking environment: {e}")
            return False
    
    def _create_scraper_script(self):
        """Create the Node.js script for browser scraping."""
        script_content = """
        const puppeteer = require('puppeteer');
        const fs = require('fs');

        // Get the URL from command line argument
        const url = process.argv[2];
        const outputFile = process.argv[3];

        if (!url) {
          console.error('URL is required as the first argument');
          process.exit(1);
        }

        if (!outputFile) {
          console.error('Output file path is required as the second argument');
          process.exit(1);
        }

        // Define the scraping function
        async function scrapeUrl(url) {
          const browser = await puppeteer.launch({
            headless: 'new',
            args: [
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-dev-shm-usage',
              '--disable-accelerated-2d-canvas',
              '--disable-gpu'
            ]
          });

          try {
            const page = await browser.newPage();
            
            // Set a realistic user agent
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36');
            
            // Set extra HTTP headers
            await page.setExtraHTTPHeaders({
              'Accept-Language': 'en-US,en;q=0.9',
              'Referer': 'https://www.google.com/',
              'DNT': '1'
            });

            // Navigate to the URL with a timeout of 30 seconds
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
            
            // Wait a bit to allow dynamic content to load
            await page.waitForTimeout(2000);

            // Extract product information
            const result = await page.evaluate(() => {
              // Helper function to safely extract text content
              const getText = (selector) => {
                const element = document.querySelector(selector);
                return element ? element.textContent.trim() : null;
              };
              
              // Helper function to safely extract attribute
              const getAttribute = (selector, attribute) => {
                const element = document.querySelector(selector);
                return element ? element.getAttribute(attribute) : null;
              };
              
              // Extract product information
              let title = null;
              let price = null;
              let imageUrl = null;
              
              // Try various selectors for title
              title = 
                getText('h1') || 
                getText('h1.wt-text-body-01') || 
                getText('.listing-page-title-component') ||
                document.title.split('|')[0].trim();
              
              // Try various selectors for price
              const priceText = 
                getText('.wt-text-title-01 span.money') || 
                getText('.wt-text-title-medium span.money') ||
                getText('.listing-page-price');
                
              if (priceText) {
                // Extract numbers from the price text - FIX: Escape the dot properly
                const priceMatch = priceText.replace(',', '').match(/([0-9]+\\.?[0-9]*)/);
                if (priceMatch) {
                  price = parseFloat(priceMatch[1]);
                }
              }
              
              // Try various selectors for image
              imageUrl = 
                getAttribute('img.wt-max-width-full', 'src') || 
                getAttribute('img[data-src-zoom-image]', 'data-src-zoom-image') ||
                getAttribute('img.carousel-image', 'src') ||
                getAttribute('meta[property="og:image"]', 'content');
                
              // Get meta description
              const metaDesc = getAttribute('meta[name="description"]', 'content');
              
              return {
                title,
                price,
                image_url: imageUrl,
                description: metaDesc || null,
                page_title: document.title,
                url: window.location.href
              };
            });

            await browser.close();
            return result;
          } catch (error) {
            console.error(`Error during scraping: ${error.message}`);
            await browser.close();
            throw error;
          }
        }

        // Execute the scraping and save to file
        scrapeUrl(url)
          .then(result => {
            fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
            console.log(`Scraping completed. Results saved to ${outputFile}`);
            process.exit(0);
          })
          .catch(error => {
            console.error(`Scraping failed: ${error.message}`);
            // Write error to file
            fs.writeFileSync(outputFile, JSON.stringify({ error: error.message }, null, 2));
            process.exit(1);
          });
        """
        
        # Write the script to file
        with open(self.script_path, 'w') as f:
            f.write(script_content.strip())
        
        logger.info(f"Created browser scraper script at {self.script_path}")
    
    async def scrape_url(self, url: str) -> Dict[str, Any]:
        """Scrape a URL using the headless browser.
        
        Args:
            url: The URL to scrape
            
        Returns:
            A dictionary containing the scraped data
        """
        if not self.is_available:
            return {"error": "Browser scraping is not available. Node.js or Puppeteer is missing.", "fallback_needed": True}
        
        try:
            # Create a temporary file to store the result
            with tempfile.NamedTemporaryFile(suffix='.json', delete=False) as tmp:
                output_file = tmp.name
            
            # Run the Node.js script
            logger.info(f"Scraping URL with headless browser: {url}")
            
            # Find the correct Node.js binary
            node_cmd = "node"  # default
            if os.system("which node > /dev/null 2>&1") != 0:
                # Try alternative names/paths
                alternatives = ["nodejs", "/usr/bin/node", "/usr/local/bin/node"]
                for alt in alternatives:
                    if os.system(f"which {alt} > /dev/null 2>&1") == 0:
                        node_cmd = alt
                        break
            
            cmd = f"{node_cmd} {self.script_path} \"{url}\" {output_file}"
            logger.debug(f"Executing command: {cmd}")
            
            # Use asyncio to run the command asynchronously
            try:
                proc = await asyncio.create_subprocess_shell(
                    cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                
                stdout, stderr = await proc.communicate()
                
                if stdout:
                    logger.debug(f"Command stdout: {stdout.decode()}")
                if stderr:
                    logger.warning(f"Command stderr: {stderr.decode()}")
                
                if proc.returncode != 0:
                    logger.error(f"Browser scraping failed: {stderr.decode() if stderr else 'unknown error'}")
                    return {"error": f"Browser scraping failed with exit code {proc.returncode}", "fallback_needed": True}
            except Exception as e:
                logger.error(f"Failed to execute command: {e}")
                return {"error": f"Failed to execute browser scraping command: {str(e)}", "fallback_needed": True}
            
            # Read the result from the temporary file
            try:
                with open(output_file, 'r') as f:
                    result = json.load(f)
            except Exception as e:
                logger.error(f"Failed to read result file: {e}")
                return {"error": f"Failed to read scraping results: {str(e)}", "fallback_needed": True}
            finally:
                # Clean up the temporary file
                try:
                    if os.path.exists(output_file):
                        os.unlink(output_file)
                except Exception as e:
                    logger.warning(f"Failed to delete temporary file: {e}")
            
            # Add the source to the result
            domain = urlparse(url).netloc
            result["source"] = domain
            
            return result
            
        except Exception as e:
            logger.error(f"Error during browser scraping: {e}")
            return {"error": f"Failed to scrape URL: {str(e)}", "fallback_needed": True}
