import axios from 'axios';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const askGemini = async (message) => {
  const makeRequest = async () => {
    return axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'openai/gpt-oss-20b:free',

        messages: [
          {
            role: 'system',
            content: `
You are an assistant for Amdaani Billing Software.

Rules:
1. Only answer related to Amdaani Billing Software.
2. Keep answers short and professional.
3. Available Features:
- Billing
- Inventory
- Stock Management
- Barcode
- Reports
- POS

If unrelated:
Say:
"I can only help regarding Amdaani Billing Software."
`,
          },
          {
            role: 'user',
            content: message,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,

          'Content-Type': 'application/json',
        },
      }
    );
  };

  try {
    const response = await makeRequest();

    return response.data.choices[0].message.content;
  } catch (error) {
    // Retry once if rate limited
    if (error.response?.status === 429) {
      // console.log('AI busy. Retrying...');

      await sleep(3000);

      const retryResponse = await makeRequest();

      return retryResponse.data.choices[0].message.content;
    }

    console.log('OpenRouter Error:', error.response?.data || error.message);

    return 'Sorry, AI is unavailable right now.';
  }
};
