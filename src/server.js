const express = require('express');
const NodeGeocoder = require('node-geocoder');
const { v4: uuidv4 } = require('uuid');
// const rateLimit = require('express-rate-limit'); // Uncomment if using server-side rate limiting

const app = express();
const port = process.env.PORT || 3000;

// Configure node-geocoder with Geoapify
let geocoder;
try {
  console.log('Initializing geocoder with Geoapify provider');
  geocoder = NodeGeocoder({
    provider: 'geoapify',
    httpAdapter: 'https',
    apiKey: process.env.GEOAPIFY_API_KEY, // Set in Vercel environment variables
    formatter: null,
    httpOptions: {
      headers: {
        'User-Agent': 'LocationAPI/1.0 (kundanrj.singh@gmail.com)' // Replace with your email
      }
    }
  });
} catch (error) {
  console.error('Failed to initialize geocoder:', error.message);
  process.exit(1);
}

// Middleware to parse JSON bodies
app.use(express.json());

// Optional server-side rate limiting for /api/geocode/:id
// const geocodeLimiter = rateLimit({
//   windowMs: 1000, // 1 second
//   max: 1, // 1 request per second
//   message: 'Too many requests, please try again after 1 second.'
// });
// app.use('/api/geocode/:id', geocodeLimiter);

// Serve static HTML page for location requests
app.get('/location/:id', (req, res) => {
  const uniqueId = req.params.id;
  console.log(`Received request for location page with ID: ${uniqueId}`);
  
  try {
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Get Location</title>
      </head>
      <body>
        <h1>Share Your Location</h1>
        <p id="status">Requesting location...</p>
        <p id="location"></p>
        <script>
          async function fetchGeocodeWithDelay(latitude, longitude, uniqueId) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            try {
              const response = await fetch('/api/geocode/${uniqueId}', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ latitude, longitude })
              });
              if (!response.ok) {
                throw new Error('Failed to fetch address: ' + response.statusText);
              }
              const data = await response.json();
              document.getElementById('location').textContent = 
                \`Location: Latitude \${latitude}, Longitude \${longitude}, Address: \${data.address || 'Unknown'}\`;
              document.getElementById('status').textContent = 'Location fetched!';
            } catch (error) {
              console.error('Client-side: Error fetching address:', error.message);
              document.getElementById('status').textContent = 'Error: ' + error.message;
            }
          }

          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              async (position) => {
                const { latitude, longitude } = position.coords;
                console.log('Client-side: Location obtained', latitude, longitude);
                document.getElementById('status').textContent = 'Fetching address...';
                fetchGeocodeWithDelay(latitude, longitude, '${uniqueId}');
              },
              (error) => {
                console.error('Client-side: Geolocation error:', error.message);
                document.getElementById('status').textContent = 'Error: ' + error.message;
              }
            );
          } else {
            console.error('Client-side: Geolocation not supported by browser');
            document.getElementById('status').textContent = 'Geolocation is not supported by this browser.';
          }
        </script>
      </body>
      </html>
    `);
    console.log(`Served location page for ID: ${uniqueId}`);
  } catch (error) {
    console.error(`Error serving location page for ID: ${uniqueId}`, error.message);
    res.status(500).send('Internal Server Error');
  }
});

// API endpoint to generate a shareable link
app.get('/api/generate-link', (req, res) => {
  console.log('Received request to generate shareable link');
  try {
    const uniqueId = uuidv4();
    const link = `https://${req.get('host')}/location/${uniqueId}`;
    console.log(`Generated link: ${link}`);
    res.json({ link });
  } catch (error) {
    console.error('Error generating link:', error.message);
    res.status(500).json({ error: 'Failed to generate link' });
  }
});

// API endpoint for reverse geocoding
app.post('/api/geocode/:id', async (req, res) => {
  const uniqueId = req.params.id;
  console.log(`Received geocode request for ID: ${uniqueId}`);
  
  try {
    const { latitude, longitude } = req.body;
    
    if (!latitude || !longitude || isNaN(latitude) || isNaN(longitude)) {
      console.warn(`Invalid coordinates for ID: ${uniqueId}`, req.body);
      return res.status(400).json({ error: 'Invalid or missing coordinates' });
    }

    console.log(`Geocoding coordinates: lat=${latitude}, lon=${longitude}`);
    const result = await geocoder.reverse({ lat: latitude, lon: longitude });
    
    console.log(`Geocoder raw response for ID: ${uniqueId}:`, JSON.stringify(result, null, 2));
    
    if (!result || result.length === 0) {
      console.warn(`No geocoding results for ID: ${uniqueId}`);
      return res.status(404).json({ error: 'Address not found' });
    }

    const address = result[0]?.formattedAddress || result[0]?.address || 'Address not found';
    console.log(`Geocoded address for ID: ${uniqueId}: ${address}`);
    
    res.json({
      latitude,
      longitude,
      address
    });
  } catch (error) {
    console.error(`Error in geocode endpoint for ID: ${uniqueId}`, error.message, error.stack);
    res.status(500).json({ error: 'Failed to geocode location', details: error.message });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message, err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Start the server
try {
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
} catch (error) {
  console.error('Failed to start server:', error.message);
  process.exit(1);
}
