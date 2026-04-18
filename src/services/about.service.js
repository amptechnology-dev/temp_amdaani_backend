import { About } from "../models/about.model.js";

export const createAbout = async (data) => {
  const existingAbout = await About.findOne();

  if (existingAbout) {
    throw new Error("About section already present, you can edit it.");
  }

  return About.create(data);
};

export const updateAboutById = async (id, data) => {
  return About.findByIdAndUpdate(id, data, { new: true });
};

export const getAbout = async () => {
  return About.find();
};

export const getAboutById = async (id) => {
  return About.findById(id);
};