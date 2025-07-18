const express = require('express');
const { v4: uuidv4 } = require('uuid');

const app = express();
const port = process.env.PORT || 3000;

// Debug logging setup
const debugLog = (message, data = '') => {
  console.log(`[DEBUG] ${new Date().toISOString()} - ${message}`, data ? JSON.stringify(data, null, 2) : '');
};

// Serve static HTML page for location requests
app.get('/location/:id', (req, res) => {
  const uniqueId = req.params.id;
  debugLog(`Received request for location page`, { uniqueId, headers: req.headers });
  
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
        <h3>Raw API Response:</h3>
        <pre id="raw-response"></pre>
        <p>Powered by Google Maps Geocoding API.</p>
        <script>
          async function fetchGeocodeWithDelay(latitude, longitude, uniqueId) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            try {
              const latlng = \`\${latitude},\${longitude}\`;
              console.log('Client-side: Sending geocode request', { latlng, uniqueId });
              const response = await fetch(\`https://maps.googleapis.com/maps/api/geocode/json?latlng=\${latlng}&key=AIzaSyAGJ0i-_qPvcO3sbixxaAUWPDR0mxI-G0U\`, {
                method: 'GET'
              });
              if (!response.ok) {
                throw new Error('Failed to fetch address: ' + response.statusText);
              }
              const data = await response.json();
              console.log('===== Google Maps API Raw Response (ID: ${uniqueId}) =====\\n' + JSON.stringify(data, null, 2) + '\\n====================================');
              
              if (data.status !== 'OK' || !data.results || data.results.length === 0) {
                throw new Error('Address not found: ' + (data.error_message || 'No results'));
              }

              // Parse Google Maps API response
              const result = data.results[0];
              const addressComponents = result.address_components;
              const addressDetails = {
                formattedAddress: result.formatted_address || 'Address not found',
                street: '',
                city: '',
                state: '',
                postcode: '',
                country: ''
              };

              // Extract address components
              for (const component of addressComponents) {
                if (component.types.includes('route')) {
                  addressDetails.street = component.long_name;
                } else if (component.types.includes('locality') || component.types.includes('sublocality')) {
                  addressDetails.city = component.long_name;
                } else if (component.types.includes('administrative_area_level_1')) {
                  addressDetails.state = component.long_name;
                } else if (component.types.includes('postal_code')) {
                  addressDetails.postcode = component.long_name;
                } else if (component.types.includes('country')) {
                  addressDetails.country = component.long_name;
                }
              }

              document.getElementById('location').textContent = 
                \`Location: Latitude \${latitude}, Longitude \${longitude}, Address: \${addressDetails.formattedAddress}\nDetails: Street: \${addressDetails.street}, City: \${addressDetails.city}, State: \${addressDetails.state}, Postcode: \${addressDetails.postcode}, Country: \${addressDetails.country}\`;
              document.getElementById('raw-response').textContent = JSON.stringify(data, null, 2);
              document.getElementById('status').textContent = 'Location fetched!';
            } catch (error) {
              console.error('Client-side: Error fetching address:', error.message);
              document.getElementById('status').textContent = 'Error: ' + error.message;
              document.getElementById('raw-response').textContent = 'Error: ' + error.message;
            }
          }

          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              async (position) => {
                const { latitude, longitude } = position.coords;
                console.log('Client-side: Location obtained', { latitude, longitude });
                document.getElementById('status').textContent = 'Fetching address...';
                fetchGeocodeWithDelay(latitude, longitude, '${uniqueId}');
              },
              (error) => {
                console.error('Client-side: Geolocation error:', error.message);
                document.getElementById('status').textContent = 'Error: ' + error.message;
                document.getElementById('raw-response').textContent = 'Error: ' + error.message;
              }
            );
          } else {
            console.error('Client-side: Geolocation not supported by browser');
            document.getElementById('status').textContent = 'Geolocation is not supported by this browser.';
            document.getElementById('raw-response').textContent = 'Geolocation not supported.';
          }
        </script>
      </body>
      </html>
    `);
    debugLog(`Served location page`, { uniqueId });
  } catch (error) {
    debugLog(`Error serving location page`, { uniqueId, error: error.message, stack: error.stack });
    res.status(500).send('Internal Server Error');
  }
});

// API endpoint to generate a shareable link
app.get('/api/generate-link', (req, res) => {
  debugLog('Received request to generate shareable link', { headers: req.headers });
  try {
    const uniqueId = uuidv4();
    const link = `https://${req.get('host')}/location/${uniqueId}`;
    debugLog(`Generated link`, { link, uniqueId });
    res.json({ link });
  } catch (error) {
    debugLog('Error generating link', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to generate link' });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  debugLog('Unhandled error', { error: err.message, stack: err.stack, path: req.path });
  res.status(500).json({ error: 'Internal Server Error' });
});

// Start the server
try {
  app.listen(port, () => {
    debugLog(`Server running`, { port });
  });
} catch (error) {
  debugLog('Failed to start server', { error: error.message, stack: error.stack });
  process.exit(1);
}
