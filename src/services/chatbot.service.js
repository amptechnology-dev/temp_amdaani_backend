import { Chatbot } from '../models/chatbot.model.js';
import { Conversation } from '../models/conversation.model.js';
import { askGemini } from '../utils/gemini.js';
import { Message } from '../models/message.model.js';
import { getPlanContextForAI } from './planContext.service.js';

const normalizeText = (text) => {
  return text.toLowerCase().trim();
};

export const getChatReply = async (sessionId, message, name = '', phoneNumber = '') => {
  const normalizedMessage = normalizeText(message);

  let conversation = await Conversation.findOne({ sessionId });

  if (!conversation) {
    const trimmedName = String(name || '').trim();
    const trimmedPhone = String(phoneNumber || '').trim();

    if (!trimmedName || !trimmedPhone) {
      throw new ApiError(400, 'Name and phone number are required to start a new conversation.');
    }

    conversation = await Conversation.create({
      sessionId,
      name: trimmedName,
      phoneNumber: trimmedPhone,
    });
  } else {
    let shouldSave = false;

    if (!conversation.name && name) {
      conversation.name = String(name).trim();
      shouldSave = true;
    }

    if (!conversation.phoneNumber && phoneNumber) {
      conversation.phoneNumber = String(phoneNumber).trim();
      shouldSave = true;
    }

    conversation.lastMessageAt = new Date();
    shouldSave = true;

    if (shouldSave) {
      await conversation.save();
    }
  }

  await Message.create({
    conversation: conversation._id,
    role: 'user',
    content: message,
  });

  // Find FAQ
  const faqs = await Chatbot.find({ isActive: true });

  const matchedFaq = faqs.find((faq) =>
    faq.keywords.some((keyword) => normalizedMessage.includes(keyword.toLowerCase()))
  );

  const isPricingQuery = /price|pricing|plan|cost|kotto|koto\s*taka|subscription|package/i.test(normalizedMessage);

  if (matchedFaq && !isPricingQuery) {
    await Message.create({
      conversation: conversation._id,
      role: 'assistant',
      content: matchedFaq.answer,
    });

    return {
      source: 'faq',
      sessionId: conversation.sessionId,
      reply: matchedFaq.answer,
    };
  }

  const history = await Message.find({ conversation: conversation._id }).sort({ createdAt: -1 }).limit(20).lean();

  history.reverse();

  const planContext = await getPlanContextForAI();

  const aiReply = await askGemini(history, planContext);

  // Save AI Reply
  await Message.create({
    conversation: conversation._id,
    role: 'assistant',
    content: aiReply,
  });

  return {
    source: 'ai',
    sessionId: conversation.sessionId,
    reply: aiReply,
  };
};

export const getConversationHistory = async (sessionId) => {
  const conversation = await Conversation.findOne({
    sessionId,
  });

  if (!conversation) {
    return [];
  }

  const messages = await Message.find({
    conversation: conversation._id,
  }).sort({
    createdAt: 1,
  });

  return messages;
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
