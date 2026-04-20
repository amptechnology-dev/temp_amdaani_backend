import { HeroSection } from "../models/hero.model.js";
import { compressAndUpload, deleteFileFromR2 } from "../services/image.service.js";
import config from "../config/config.js";

export const createHeroSection = async (data, file) => {
    let uploadedImage;

    try {
        if (file) {
            uploadedImage = await compressAndUpload(file.buffer, { isPublic: true });
            data.phoneImage = `${config.r2.publicEndpoint}/${uploadedImage}`;
        }

        const hero = await HeroSection.create(data);
        return hero;
    } catch (error) {
        if (uploadedImage) await deleteFileFromR2(true, uploadedImage);
        throw error;
    }
};

export const updateHeroSectionById = async (id, data, file) => {
    let uploadedImage;

    try {
        if (file) {
            uploadedImage = await compressAndUpload(file.buffer, { isPublic: true });
            data.phoneImage = `${config.r2.publicEndpoint}/${uploadedImage}`;
        }

        const hero = await HeroSection.findByIdAndUpdate(id, data, { new: true });

        return hero;
    } catch (error) {
        if (uploadedImage) await deleteFileFromR2(true, uploadedImage);
        throw error;
    }
};

export const getHeroSectionById = async (id) => {
    return HeroSection.findById(id);
};

export const getHeroSections = async (filters = {}) => {
    return HeroSection.find(filters).sort({ priority: -1, createdAt: -1 });
};

export const deleteHeroSectionById = async (id) => {
    const hero = await HeroSection.findByIdAndDelete(id);
};