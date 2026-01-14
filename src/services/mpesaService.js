// src/services/mpesaService.js
import axios from "axios";
import mpesaConfig from "../config/mpesa.js";

const getAccessToken = async () => {
  const auth = Buffer.from(
    `${mpesaConfig.consumerKey}:${mpesaConfig.consumerSecret}`
  ).toString("base64");

  const response = await axios.get(
    `${mpesaConfig.baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${auth}` } }
  );

  return response.data.access_token;
};

export const stkPushRequest = async (phone, amount, accountRef, desc) => {
  const token = await getAccessToken();

  const timestamp = new Date().toISOString().replace(/[-T:\.Z]/g, "").slice(0, 14);

  const password = Buffer.from(
    `${mpesaConfig.shortCode}${mpesaConfig.passkey}${timestamp}`
  ).toString("base64");

  const body = {
    BusinessShortCode: mpesaConfig.shortCode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: "CustomerPayBillOnline",
    Amount: amount,
    PartyA: phone,
    PartyB: mpesaConfig.shortCode,
    PhoneNumber: phone,
    CallBackURL: mpesaConfig.callbackURL,
    AccountReference: accountRef,
    TransactionDesc: desc,
  };

  const response = await axios.post(
    `${mpesaConfig.baseUrl}/mpesa/stkpush/v1/processrequest`,
    body,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  return response.data;
};
