import Wallet from "../models/Wallet.js";

export const loadWallet = async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ message: "Invalid amount" });

    let wallet = await Wallet.findOne({ clientId: req.client._id });

    if (!wallet) wallet = await Wallet.create({ clientId: req.client._id });

    wallet.balance += Number(amount);
    wallet.lastTransaction = new Date();
    await wallet.save();

    res.status(200).json({ success: true, balance: wallet.balance });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getWalletBalance = async (req, res) => {
  try {
    const wallet = await Wallet.findOne({ clientId: req.client._id });
    res.status(200).json({ balance: wallet?.balance || 0 });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
