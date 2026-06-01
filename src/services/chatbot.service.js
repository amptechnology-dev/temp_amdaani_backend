import { Chatbot } from '../models/chatbot.model.js';

import { askGemini } from '../utils/gemini.js';

const normalizeText = (text) => {
  return text.toLowerCase().trim();
};

export const getChatReply = async (message) => {
  const normalizedMessage = normalizeText(message);

  const faqs = await Chatbot.find({
    isActive: true,
  });

  const matchedFaq = faqs.find((faq) =>
    faq.keywords.some((keyword) => normalizedMessage.includes(keyword.toLowerCase()))
  );

  // FAQ match found
  if (matchedFaq) {
    return {
      source: 'faq',
      reply: matchedFaq.answer,
    };
  }

  // Gemini fallback
  const aiReply = await askGemini(message);

  return {
    source: 'ai',
    reply: aiReply,
  };
};

export const createChatbot = async (data) => {
  return Chatbot.create(data);
};

export const getAllChatbots = async () => {
  return Chatbot.find().sort({
    createdAt: -1,
  });
};

export const getChatbotById = async (id) => {
  return Chatbot.findById(id);
};

export const updateChatbot = async (id, data) => {
  return Chatbot.findByIdAndUpdate(id, data, { new: true });
};

export const deleteChatbot = async (id) => {
  return Chatbot.findByIdAndDelete(id);
};
