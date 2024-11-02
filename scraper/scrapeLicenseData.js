const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
// Path to the cache file
const cacheFilePath = path.join(__dirname, 'cache.json');

// Function to load cache from the file
function loadCache() {
  if (fs.existsSync(cacheFilePath)) {
    try {
      const cacheData = fs.readFileSync(cacheFilePath, 'utf8');
      return JSON.parse(cacheData);
    } catch (error) {
      console.error('Error loading cache:', error);
      return {};
    }
  }
  return {};
}

// Function to save cache to the file
function saveCache(cache) {
  try {
    fs.writeFileSync(cacheFilePath, JSON.stringify(cache, null, 2), 'utf8');
  } catch (error) {
    console.error('Error saving cache:', error);
  }
}

// Main function to scrape license data
async function scrapeLicenseData(refNo) {
  let browser;
  const cache = loadCache();

  // Check if data for the reference number is already cached
  if (cache[refNo]) {
    console.log(`Data for reference number ${refNo} found in cache.`);
    return cache[refNo];
  }

  try {
    // Launch Puppeteer browser instance
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: { width: 1920, height: 1080 },
    });

    const page = await browser.newPage();

    // Optimize request handling to speed up the scraping process
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const resourceType = request.resourceType();
      if (['image', 'stylesheet', 'font'].includes(resourceType)) {
        request.abort();
      } else {
        request.continue();
      }
    });

    // Navigate to the page with specified options
    await page.goto(`${process.env.url}refno=${refNo}`, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    });

    // Wait for the specific element to ensure the page is loaded
    await page.waitForSelector('#registerno', { timeout: 5000 });

    // Extract data from the page
    const data = await page.evaluate(() => {
      const getInputValue = (id) => {
        const element = document.getElementById(id);
        return element ? element.value || '' : '';
      };

      const getTextContent = (id) => {
        const element = document.getElementById(id);
        return element ? element.textContent.trim() || '' : '';
      };

      const photoElement = document.getElementById('photoId');
      const photoSrc = photoElement ? photoElement.src || '' : '';

      return {
        referenceNo: getInputValue('registerno') || getTextContent('registerno'),
        referenceDate: getInputValue('refDate') || getTextContent('refDate'),
        licenseType: getInputValue('licetype') || getTextContent('licetype'),
        vehicleClass: getInputValue('vehicle') || getTextContent('vehicle'),
        personalInfo: {
          name: getInputValue('name') || getTextContent('name'),
          fatherName: getInputValue('fathername') || getTextContent('fathername'),
          motherName: getInputValue('mothername') || getTextContent('mothername'),
          dateOfBirth: getInputValue('dateofbirth') || getTextContent('dateofbirth'),
          bloodGroup: getInputValue('bloodgrp') || getTextContent('bloodgrp'),
          mobileNo: getInputValue('mobilenumber') || getTextContent('mobilenumber'),
          nidNumber: getInputValue('nidnumber') || getTextContent('nidnumber'),
          permanentAddress: getInputValue('permanentaddress') || getTextContent('permanentaddress'),
          presentAddress: getInputValue('presentaddress') || getTextContent('presentaddress'),
          licensingAuthority: getInputValue('office') || getTextContent('office'),
        },
        photo: photoSrc,
      };
    });

    // Validate the scraped data
    const hasData = Object.values(data).some((value) => value && value.trim() !== '');

    if (!hasData) {
      throw new Error('No data was found on the page. Please verify the reference number and try again.');
    }

    // Cache the data and save it
    cache[refNo] = data;
    saveCache(cache);

    console.log('Scraped data:', JSON.stringify(data, null, 2));
    return data;

  } catch (error) {
    console.error('Detailed scraping error:', {
      message: error.message,
      stack: error.stack,
      refNo,
    });
    throw new Error(`Failed to scrape data: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Export the function
module.exports = scrapeLicenseData;

// Optional: Test the function directly
if (require.main === module) {
  const testRefNo = 'YOUR_TEST_REFERENCE_NUMBER';
  scrapeLicenseData(testRefNo)
    .then((data) => console.log('Test result:', data))
    .catch((error) => console.error('Test error:', error));
}
