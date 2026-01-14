import Tesseract from "tesseract.js";

export const extractIdText = async (filePath) => {
  try {
    const result = await Tesseract.recognize(filePath, "eng", {
      logger: (m) => console.log(m),
    });

    return result.data.text;
  } catch (error) {
    console.error("OCR ERROR:", error);
    return "";
  }
};
