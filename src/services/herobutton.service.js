import { HeroButton } from "../models/heroButton.model.js";

// Create Hero Button (only one allowed)
export const createHeroButton = async (data) => {

    const existingButton = await HeroButton.findOne();

    if (existingButton) {
        throw new Error("Hero button already exists. You can edit it instead.");
    }

    return HeroButton.create(data);
};

// Get all hero buttons
export const getAllHeroButtons = async () => {
    return HeroButton.find();
};

// Get active hero button
export const getActiveHeroButton = async () => {
    return HeroButton.findOne({ isActive: true });
};

// Get by ID
export const getHeroButtonById = async (id) => {
    return HeroButton.findById(id);
};

// Update hero button
export const updateHeroButton = async (id, data) => {
    return HeroButton.findByIdAndUpdate(id, data, { new: true });
};

// Delete hero button
export const deleteHeroButton = async (id) => {
    return HeroButton.findByIdAndDelete(id);
};

// Toggle active / inactive
export const toggleHeroButtonStatus = async (id) => {

    const button = await HeroButton.findById(id);

    if (!button) {
        throw new Error("Hero button not found");
    }

    button.isActive = !button.isActive;

    await button.save();

    return button;
};