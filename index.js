require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const mqtt = require("mqtt");

const app = express();
const port = process.env.PORT || 3000;
let lastPing = Date.now();
let ack = false;

mongoose.connect(
  `mongodb+srv://dark:${process.env.dbPass}@cluster0.2hyuk3e.mongodb.net/?retryWrites=true&w=majority`
);
const Message = mongoose.model("Message", { content: String, timestamp: Date });

const mqttClient = mqtt.connect(process.env.mqttBroker);
const mqttPublishTopic = process.env.mqttPublishTopic;
const mqttSubscribeTopic = process.env.mqttSubscribeTopic;

mqttClient.on("connect", () => {
  mqttClient.subscribe(mqttSubscribeTopic);
});
mqttClient.on("message", (topic, message) => {
  if (message.toString().startsWith("H")) lastPing = Date.now();
  else ack = true;
  console.log(lastPing, ack);
});

app.use(express.json());
app.use(express.static("public"));

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

app.get("/messages", async (req, res) => {
  try {
    const messages = await Message.find().sort({ timestamp: "desc" });
    res.status(200).json(messages);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.delete("/messages/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deletedMessage = await Message.findByIdAndDelete(id);

    if (!deletedMessage) {
      return res.status(404).json({ error: "Message not found" });
    }

    res.status(200).json({ message: "Message deleted successfully" });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/publish", async (req, res) => {
  ack = false;
  let message = { message: "Message saved and published successfully" };
  try {
    const { content } = req.body;

    const newMessage = new Message({ content, timestamp: new Date() });
    await newMessage.save();

    await mqttClient.publishAsync(mqttPublishTopic, content);

    if (!ack) {
      message = { message: "Message NOT saved and published successfully" };
    }

    res.status(200).json(message);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
