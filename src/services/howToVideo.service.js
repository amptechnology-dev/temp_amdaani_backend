import { HowToVideo } from '../models/howToVideo.model.js';

export const createHowToVideo = async (videoData) => {
  return HowToVideo.create(videoData);
};

export const getAllHowToVideos = async () => {
  return HowToVideo.find().sort('order').lean();
};

export const getHowToVideosByTag = async (tag) => {
  return HowToVideo.find({ tags: { $in: [tag] } })
    .sort('order')
    .lean();
};

export const getHowToVideoById = async (videoId) => {
  return HowToVideo.findById(videoId).lean();
};

export const updateHowToVideo = async (videoId, updateData) => {
  return await HowToVideo.findByIdAndUpdate(videoId, updateData, { new: true }).lean();
};

export const deleteHowToVideo = async (videoId) => {
  return HowToVideo.findByIdAndDelete(videoId);
};

/*
export const reorderVideos = async (videos) => {
  const bulkOps = videos.map(({ id, order }) => ({
    updateOne: {
      filter: { _id: id },
      update: { $set: { order } },
    },
  }));

  await HowToVideo.bulkWrite(bulkOps);
};
*/

export const getActiveHowToVideos = async () => {
  return HowToVideo.find({ isActive: true }).sort('order').lean();
};
