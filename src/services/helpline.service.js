import { Helpline } from "../models/helpline.model.js";

export const createHelpline = async (data) => {
    await Helpline.updateMany(
        { isPrimary: true },
        { $set: { isPrimary: false } }
    );
    data.isPrimary = true;
    return Helpline.create(data);
};

export const getPrimaryHelpline = async () => {
    return Helpline.findOne({ isPrimary: true });
};

export const getAllHelpline = async () => {
    return Helpline.find();
};

export const getHelplineById = async (id) => {
    return Helpline.findById(id);
};

export const updateHelpline = async (id, data) => {
    if (data.isPrimary === true) {
        await Helpline.updateMany(
            { isPrimary: true },
            { $set: { isPrimary: false } }
        );
    }
    return Helpline.findByIdAndUpdate(id, data, { new: true });
};

export const deleteHelpline = async (id) => {
    return Helpline.findByIdAndDelete(id);
};