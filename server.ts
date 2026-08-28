import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limit for base64 images
  app.use(express.json({ limit: '10mb' }));

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  // API Routes
  app.post('/api/detect-mask', async (req, res) => {
    try {
      const { image } = req.body; // Expecting a base64 encoded image string (e.g., "data:image/jpeg;base64,...")

      if (!image) {
        return res.status(400).json({ error: 'No image provided' });
      }

      // Extract base64 data
      const base64Data = image.replace(/^data:image\/\w+;base64,/, '');

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `Analyze this image and determine if the person is wearing a face mask. 
                Classify it into one of the following statuses:
                - "mask" (properly worn)
                - "no_mask" (no mask worn)
                - "incorrect" (mask worn incorrectly, e.g., below the nose)
                - "no_face" (no person/face clearly visible in the image)
                
                Respond ONLY with a valid JSON object matching this schema:
                {
                  "status": "mask" | "no_mask" | "incorrect" | "no_face",
                  "message": "A short, 1-sentence description of what you observe."
                }`
              },
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: base64Data
                }
              }
            ]
          }
        ],
        config: {
          responseMimeType: 'application/json',
          temperature: 0.1 // Low temperature for consistent classification
        }
      });

      if (!response.text) {
        throw new Error('No response text received from Gemini');
      }

      const result = JSON.parse(response.text);
      res.json(result);
    } catch (error: any) {
      console.error('Error processing image:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
