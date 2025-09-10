const { VertexAI } = require('@google-cloud/vertexai');
const functions = require('@google-cloud/functions-framework');

// Initialize Vertex AI outside the handler for better performance
const vertex_ai = new VertexAI({
  project: 'new-man-app',
  location: 'us-central1'
});

functions.http('getstage3', async (req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  try {
    // Validate request body
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).send({ error: 'Invalid request body' });
    }

    const { virtueName, virtueDef, characterDefectAnalysis, stage1MemoContent, stage2MemoContent, stage3MemoContent, stage1Complete, stage2Complete } = req.body;

    // Validate required fields
    if (!virtueName || !virtueDef || !characterDefectAnalysis) {
      return res.status(400).send({ error: 'Missing required fields: virtueName, virtueDef, and characterDefectAnalysis are required.' });
    }

    // Check if Stage 1 and Stage 2 are complete
    if (!stage1Complete || !stage1MemoContent || stage1MemoContent.trim().length < 50) {
      return res.status(200).send({
        prompt: "Stage 3 (Maintaining) requires completion of Stage 1 (Dismantling) first. Please complete Stage 1 and mark it as complete before proceeding to Stage 3.",
        requiresPreviousStages: true
      });
    }

    if (!stage2Complete || !stage2MemoContent || stage2MemoContent.trim().length < 50) {
      return res.status(200).send({
        prompt: "Stage 3 (Maintaining) requires completion of both Stage 1 and Stage 2 (Building). Please complete Stage 2 and mark it as complete before proceeding to Stage 3.",
        requiresPreviousStages: true
      });
    }

    // --- STAGE 3 MAINTAINING PROMPT ---
    const prompt = `
      You are an empathetic and wise recovery coach. Your task is to generate a focused, reflective writing prompt for a user working on Stage 3 of their virtue development: "Maintaining".

      **Maintaining Virtue Definition:** The practice of maintaining a virtue is an ongoing journey of continuous awareness and application, shifting from building new habits to sustaining them over time. This stage of a virtuous life requires you to consistently embody the virtue, notice subtle ways old character defects might reappear, and find new ways to express the virtue. It involves ongoing introspection and self-assessment, which can be supported by regular journaling. This process helps you integrate the virtue more deeply, allowing it to become a more natural part of who you are. The activities you can perform to support this stage include consciously recognizing when you are living the virtue, remembering the subtle ways old character defects can creep back in, and understanding that the work of building a virtue is a part of maintaining it.

      **USER CONTEXT:**
      - **Virtue:** ${virtueName}
      - **Virtue Definition:** ${virtueDef}
      - **Stage 1 Completed Work:** """${stage1MemoContent}"""
      - **Stage 2 Completed Work:** """${stage2MemoContent}"""
      - **Stage 3 Progress:** """${stage3MemoContent || "The user has not started Stage 3 writing yet."}"""

      **YOUR TASK:**
      Generate a focused writing prompt (limit 200 words) that:
      1. Acknowledges their journey through Stages 1 and 2
      2. Focuses on sustaining and deepening their practice of ${virtueName}
      3. Identifies ONE specific area for reflection: recognizing virtue in action, noticing old patterns creeping back, or finding new expressions of the virtue
      4. Encourages ongoing self-assessment and integration
      5. Ends with a specific question about maintaining long-term growth

      Keep the scope focused on maintenance and sustainability. Frame with wisdom and encouragement for the ongoing journey.
    `;

    // --- Model Execution Logic (Unchanged) ---
    // Use gemini-2.5-flash-lite as primary, with fallbacks
    const modelNames = [
      'gemini-2.5-flash-lite',  // Primary model
      'gemini-2.0-flash-lite',  // Fallback 1
      'gemini-1.5-flash-lite',  // Fallback 2
      'gemini-1.5-flash',       // Fallback 3
      'gemini-pro'              // Final fallback
    ];
    let promptResponseText = '';
    let successfulModel = '';

    for (const modelName of modelNames) {
      try {
        console.log(`Trying model: ${modelName}`);
        const generativeModel = vertex_ai.getGenerativeModel({ model: modelName });
        const result = await generativeModel.generateContent(prompt);
        const response = result.response;

        if (response.candidates && response.candidates[0] && response.candidates[0].content) {
          promptResponseText = response.candidates[0].content.parts[0].text;
          successfulModel = modelName;
          console.log(`Success with model: ${modelName}`);
          break;
        } else {
          throw new Error('Invalid response format from model');
        }
      } catch (error) {
        console.warn(`Model ${modelName} failed:`, error.message);
        continue;
      }
    }

    if (!promptResponseText) {
      console.error('All models failed.');
      // A simple fallback if all AI models fail
      promptResponseText = `Take a quiet moment to reflect on the virtue of ${virtueName}. Consider one specific time this week where you found it challenging to practice. What was the situation? What feelings came up for you? Gently explore this memory without judgment.`;
    }

    res.status(200).send({
      prompt: promptResponseText,
      model: successfulModel || 'fallback'
    });

  } catch (error) {
    console.error('Unexpected error in getstage3 function:', error);
    res.status(500).send({ error: 'Internal server error' });
  }
});
