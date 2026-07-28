import axios from 'axios';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const buildSystemPrompt = (planContext = '') => {
  const basePrompt = `
You are an assistant for Amdaani Billing Software.

Rules:
1. Only answer related to Amdaani Billing Software.
2. Keep answers short and professional.
3. Remember previous conversation.
4. If user asks follow-up questions, answer using previous chat context.
5. When answering pricing questions, ONLY use the plan data provided below
   under "CURRENT PRICING PLANS". Never invent prices, features, or plan
   names that are not listed there.
6. When a user asks which plan is best for them, consider their business
   size / monthly invoice volume (ask if not mentioned), then recommend the
   most suitable and cost-effective plan with a short reason.

Available Features:
- Billing
- Inventory
- Stock Management
- Barcode
- Reports
- POS

If unrelated:
Reply:
"I can only help regarding Amdaani Billing Software."
`;

  if (!planContext) {
    return basePrompt;
  }

  return `${basePrompt}\n\nCURRENT PRICING PLANS:\n${planContext}`;
};

export const askGemini = async (history, planContext = '') => {
  const makeRequest = async () => {
    const aiMessages = [
      {
        role: 'system',
        content: buildSystemPrompt(planContext),
      },

      ...history.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
    ];

    return axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'openai/gpt-oss-20b:free',
        messages: aiMessages,
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
    if (error.response?.status === 429) {
      await sleep(3000);

      const retryResponse = await makeRequest();

      return retryResponse.data.choices[0].message.content;
    }

    console.log('OpenRouter Error:', error.response?.data || error.message);

    return 'Sorry, AI is unavailable right now.';
  }
};