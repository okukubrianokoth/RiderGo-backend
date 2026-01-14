import africastalking from "africastalking";

const africastalkingClient = africastalking({
  apiKey: process.env.AT_API_KEY,
  username: process.env.AT_USERNAME,
});

export default africastalkingClient;
