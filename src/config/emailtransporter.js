import nodemailer from "nodemailer";
import config from "../config/config.js"; 

const transporter = nodemailer.createTransport({
  host: config.email.host,
  port: config.email.port,
  secure: config.email.port == 465, 
  auth: {
    user: config.email.user,
    pass: config.email.pass,
  },
});

export default transporter;